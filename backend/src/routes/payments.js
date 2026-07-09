const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { getWalletBalance, debitSchoolWallet } = require('../services/schoolWallet');
const { FEE_COMMISSION_RATE, BOOK_COMMISSION_RATE } = require('../utils/commission');
const { sendSMS, templates } = require('../services/sms');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

function payoutAlertPhones() {
  const raw = process.env.PAYOUT_ALERT_PHONES || process.env.TEST_SMS_PHONE || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function notifyPayoutRequested(payout, requester, amountGhs, note) {
  const phones = payoutAlertPhones();
  if (phones.length === 0) {
    console.warn('PAYOUT_ALERT_PHONES not set — no SMS sent for payout', payout.id);
    return;
  }

  const schoolName = process.env.SCHOOL_NAME || 'School';
  const requesterName = requester
    ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Admin'
    : 'Admin';

  const message = templates.payoutRequested({
    schoolName,
    amountGhs,
    requesterName,
    note: note || null,
    payoutId: payout.id,
  });

  try {
    await sendSMS(phones, message);
  } catch (err) {
    console.error('Payout alert SMS failed:', err.message);
  }
}

async function fetchSuccessfulTransactions({ limit = 100, offset = 0 } = {}) {
  const [feeIntents, bookIntents] = await Promise.all([
    prisma.paystackIntent.findMany({
      where: { status: 'SUCCESS' },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
        term: { select: { name: true, year: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.bookPaystackIntent.findMany({
      where: { status: 'SUCCESS' },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
        term: { select: { name: true, year: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
  ]);

  const feeRows = feeIntents.map((i) => ({
    id: i.id,
    reference: i.reference,
    type: 'FEE',
    schoolAmountGhs: i.schoolAmountGhs > 0 ? i.schoolAmountGhs : i.amountGhs,
    platformFeeGhs: i.platformFeeGhs,
    grossAmountGhs: i.amountGhs,
    paidAt: i.updatedAt,
    student: i.student,
    term: i.term,
  }));

  const bookRows = bookIntents.map((i) => ({
    id: i.id,
    reference: i.reference,
    type: 'BOOK',
    schoolAmountGhs: i.schoolAmountGhs > 0 ? i.schoolAmountGhs : i.amountGhs,
    platformFeeGhs: i.platformFeeGhs,
    grossAmountGhs: i.amountGhs,
    paidAt: i.updatedAt,
    student: i.student,
    term: i.term,
  }));

  return [...feeRows, ...bookRows]
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
    .slice(offset, offset + limit);
}

// GET /payments/summary
router.get('/summary', async (req, res, next) => {
  try {
    const [availableBalanceGhs, feeAgg, bookAgg, pendingPayouts, payouts] = await Promise.all([
      getWalletBalance(),
      prisma.paystackIntent.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { schoolAmountGhs: true, platformFeeGhs: true, amountGhs: true },
        _count: true,
      }),
      prisma.bookPaystackIntent.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { schoolAmountGhs: true, platformFeeGhs: true, amountGhs: true },
        _count: true,
      }),
      prisma.payoutRequest.aggregate({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        _sum: { amountGhs: true },
        _count: true,
      }),
      prisma.payoutRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { requestedBy: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const feeSchool = feeAgg._sum.schoolAmountGhs || 0;
    const bookSchool = bookAgg._sum.schoolAmountGhs || 0;

    res.json({
      availableBalanceGhs,
      commissionRates: {
        feesPercent: FEE_COMMISSION_RATE * 100,
        booksPercent: BOOK_COMMISSION_RATE * 100,
      },
      totals: {
        feePayments: feeAgg._count,
        bookPayments: bookAgg._count,
        schoolCollectedGhs: feeSchool + bookSchool,
        platformFeesGhs: (feeAgg._sum.platformFeeGhs || 0) + (bookAgg._sum.platformFeeGhs || 0),
        grossCollectedGhs: (feeAgg._sum.amountGhs || 0) + (bookAgg._sum.amountGhs || 0),
      },
      pendingPayoutsGhs: pendingPayouts._sum.amountGhs || 0,
      pendingPayoutCount: pendingPayouts._count,
      payouts,
      payoutAlertsConfigured: payoutAlertPhones().length > 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /payments/transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const transactions = await fetchSuccessfulTransactions({ limit, offset });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

// POST /payments/payout — records request, deducts balance, alerts ops via SMS (manual settlement)
router.post('/payout', async (req, res, next) => {
  try {
    const { amountGhs, note } = req.body;
    const amount = typeof amountGhs === 'number' ? amountGhs : parseFloat(String(amountGhs));
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ message: 'Minimum payout is GH₵1.00' });
    }

    const requester = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { firstName: true, lastName: true },
    });

    const payout = await prisma.$transaction(async (tx) => {
      await debitSchoolWallet(tx, amount);

      return tx.payoutRequest.create({
        data: {
          amountGhs: amount,
          note: note || null,
          requestedById: req.user.id,
          status: 'PENDING',
        },
      });
    });

    void notifyPayoutRequested(payout, requester, amount, note);

    const availableBalanceGhs = await getWalletBalance();

    res.status(201).json({
      payout,
      availableBalanceGhs,
      message:
        'Payout request submitted. The amount has been deducted from your available balance. Our team will process the transfer manually.',
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ message: 'Insufficient available balance for this payout' });
    }
    next(err);
  }
});

module.exports = router;
