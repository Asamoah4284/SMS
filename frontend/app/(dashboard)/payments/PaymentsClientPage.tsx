'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminOnly, Alert, Badge, Button, PageHeader } from '@/components/ui';
import {
  Banknote,
  Loader2,
  RefreshCw,
  Wallet,
  ArrowDownToLine,
  Receipt,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface PayoutRequest {
  id: string;
  amountGhs: number;
  status: PayoutStatus;
  note: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  requestedBy: { firstName: string; lastName: string };
}

interface Transaction {
  id: string;
  reference: string;
  type: 'FEE' | 'BOOK';
  schoolAmountGhs: number;
  paidAt: string;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    class: { name: string } | null;
  };
  term: { name: string; year: number } | null;
}

interface Summary {
  availableBalanceGhs: number;
  commissionRates: { feesPercent: number; booksPercent: number };
  totals: {
    feePayments: number;
    bookPayments: number;
    schoolCollectedGhs: number;
    platformFeesGhs: number;
    grossCollectedGhs: number;
  };
  pendingPayoutsGhs: number;
  pendingPayoutCount: number;
  payouts: PayoutRequest[];
  payoutAlertsConfigured: boolean;
}

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; variant: 'warning' | 'info' | 'success' | 'error' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  PROCESSING: { label: 'Processing', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'error' },
};

function formatGhs(n: number) {
  return `GH₵${n.toFixed(2)}`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function PaymentsClientPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryRes, txRes] = await Promise.all([
        fetch(`${API}/payments/summary`, { headers }),
        fetch(`${API}/payments/transactions?limit=100`, { headers }),
      ]);
      if (!summaryRes.ok) throw new Error('Failed to load payments summary');
      if (!txRes.ok) throw new Error('Failed to load transactions');
      setSummary(await summaryRes.json());
      const txJson = await txRes.json();
      setTransactions(txJson.transactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      setPayoutMessage('Enter at least GH₵1.00 to request a payout.');
      return;
    }
    if (summary && amount > summary.availableBalanceGhs + 0.004) {
      setPayoutMessage('Amount exceeds available balance.');
      return;
    }

    setPayoutLoading(true);
    setPayoutMessage('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/payments/payout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amountGhs: amount, note: payoutNote || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Payout request failed');

      setPayoutAmount('');
      setPayoutNote('');
      setPayoutMessage(data.message || 'Payout requested successfully.');
      await loadData();
    } catch (err) {
      setPayoutMessage(err instanceof Error ? err.message : 'Payout request failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <AdminOnly>
      <div className="space-y-6">
        <PageHeader
          title="Payments"
          subtitle="Online fee and library payments collected via Paystack. Amounts shown are what the school receives (before platform service fees paid by parents)."
          actions={
            <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          }
        />

        {error && <Alert type="error" message={error} dismissible={false} />}

        {loading && !summary ? (
          <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payments…
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
                <div className="flex items-center gap-2 text-teal-800 mb-2">
                  <Wallet className="h-5 w-5" />
                  <span className="text-sm font-semibold">Available balance</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{formatGhs(summary.availableBalanceGhs)}</p>
                <p className="text-xs text-gray-600 mt-2">Ready for payout to your registered account</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <Receipt className="h-5 w-5" />
                  <span className="text-sm font-semibold">School collected</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatGhs(summary.totals.schoolCollectedGhs)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {summary.totals.feePayments} fee · {summary.totals.bookPayments} library payments
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <Banknote className="h-5 w-5" />
                  <span className="text-sm font-semibold">Service fees (parents)</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatGhs(summary.totals.platformFeesGhs)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Fees {summary.commissionRates.feesPercent}% · Library {summary.commissionRates.booksPercent}%
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowDownToLine className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900">Request payout</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  The requested amount is deducted from your available balance immediately. Our team is notified by SMS
                  and will process the transfer to your school account manually (Paystack, Moolre, or bank).
                  {!summary.payoutAlertsConfigured && (
                    <span className="text-amber-700">
                      {' '}
                      (Payout alert SMS is not configured on the server — contact support if you do not receive confirmation.)
                    </span>
                  )}
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GH₵)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3"
                  placeholder="e.g. 500"
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-4"
                  placeholder="e.g. Term 2 collections"
                />

                {payoutMessage && (
                  <p className={`text-sm mb-3 ${payoutMessage.includes('failed') || payoutMessage.includes('exceeds') ? 'text-red-600' : 'text-teal-700'}`}>
                    {payoutMessage}
                  </p>
                )}

                <Button onClick={() => void requestPayout()} disabled={payoutLoading || summary.availableBalanceGhs < 1}>
                  {payoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Request payout
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recent payout requests</h2>
                {summary.payouts.length === 0 ? (
                  <p className="text-sm text-gray-500">No payout requests yet.</p>
                ) : (
                  <ul className="space-y-3 max-h-64 overflow-y-auto">
                    {summary.payouts.map((p) => {
                      const st = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.PENDING;
                      return (
                        <li key={p.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0">
                          <div>
                            <p className="font-semibold text-gray-900">{formatGhs(p.amountGhs)}</p>
                            <p className="text-xs text-gray-500">{formatWhen(p.createdAt)}</p>
                            {p.note && <p className="text-xs text-gray-600 mt-1">{p.note}</p>}
                            {p.failureReason && <p className="text-xs text-red-600 mt-1">{p.failureReason}</p>}
                          </div>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">All payments</h2>
                <p className="text-sm text-gray-500">Successful online payments — school amount only</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-5 py-3 font-semibold">When</th>
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Amount</th>
                      <th className="px-5 py-3 font-semibold">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                          No online payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={`${tx.type}-${tx.id}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                          <td className="px-5 py-3 whitespace-nowrap text-gray-600">{formatWhen(tx.paidAt)}</td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">
                              {tx.student.firstName} {tx.student.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.student.studentId}
                              {tx.student.class ? ` · ${tx.student.class.name}` : ''}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={tx.type === 'FEE' ? 'info' : 'default'}>
                              {tx.type === 'FEE' ? 'Fees' : 'Library'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-900">{formatGhs(tx.schoolAmountGhs)}</td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-500">{tx.reference}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminOnly>
  );
}
