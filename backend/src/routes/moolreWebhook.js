const {

  getMoolreWebhookPayload,

  parseMoolrePaymentEvent,

} = require('../services/moolreWebhook');

const { verifyMoolreWebhook } = require('../services/moolreAuth');

const {

  finalizeBookMoolreIntentByReference,

  markBookIntentFailed,

} = require('../services/bookPaystackFinalize');

const {

  finalizeFeeMoolreIntentByReference,

  markIntentFailed,

} = require('../services/paystackFinalize');

const { checkMoolrePaymentStatus } = require('../services/moolrePaymentStatus');

const prisma = require('../config/db');



async function resolveMoolreIntentKind(reference) {

  if (!reference) return null;

  const [fee, book] = await Promise.all([

    prisma.paystackIntent.findUnique({ where: { reference }, select: { id: true } }),

    prisma.bookPaystackIntent.findUnique({ where: { reference }, select: { id: true } }),

  ]);

  if (fee) return 'fee';

  if (book) return 'book';

  // Heuristic for orphan refs before intents are stored

  if (String(reference).startsWith('SMS-BOOK-')) return 'book';

  if (String(reference).startsWith('SMS-FEE-') || String(reference).startsWith('EDU_')) return 'fee';

  return null;

}



/**

 * POST /api/v1/webhooks/moolre — Moolre wallet / payment callback (fees + books)

 */

async function moolreWebhookHandler(req, res) {

  try {

    const payload = getMoolreWebhookPayload(req);

    if (!verifyMoolreWebhook(payload, req.headers)) {

      console.warn('[moolre-webhook] invalid secret');

      return res.status(401).json({ ok: false, error: 'Unauthorized' });

    }



    const event = parseMoolrePaymentEvent(payload);

    console.log('[moolre-webhook]', {

      reference: event.reference,

      isSuccess: event.isSuccess,

      isFailed: event.isFailed,

      code: event.code,

    });



    if (!event.reference) {

      return res.status(200).json({ received: true });

    }



    const kind = await resolveMoolreIntentKind(event.reference);

    if (!kind) {

      console.warn('[moolre-webhook] unknown reference', event.reference);

      return res.status(200).json({ received: true, status: 'UNKNOWN_REFERENCE' });

    }



    if (event.isFailed) {

      if (kind === 'fee') await markIntentFailed(event.reference);

      else await markBookIntentFailed(event.reference);

      return res.status(200).json({ received: true, status: 'FAILED', kind });

    }



    if (event.isSuccess) {

      const status = await checkMoolrePaymentStatus(event.reference);

      const amountGhs = Number(status.data?.amount ?? status.data?.Amount ?? 0) || undefined;

      const result =

        kind === 'fee'

          ? await finalizeFeeMoolreIntentByReference(event.reference, amountGhs)

          : await finalizeBookMoolreIntentByReference(event.reference, amountGhs);

      if (!result.ok && result.reason === 'AMOUNT_MISMATCH') {

        return res.status(400).json({ received: true, error: result.reason, kind });

      }

      return res.status(200).json({ received: true, status: 'SUCCESS', kind });

    }



    return res.status(200).json({ received: true, status: 'PENDING', kind });

  } catch (err) {

    console.error('[moolre-webhook] error:', err);

    return res.status(500).json({ received: false });

  }

}



/**

 * GET /api/v1/webhooks/moolre/payment-success?externalref=...

 * Served inside the WebView after MoMo approval — posts message to parent and shows a simple page.

 */

async function moolrePaymentSuccessHandler(req, res) {

  const externalref = String(req.query.externalref || req.query.reference || '').trim();



  // Best-effort reconcile (fee or book)

  if (externalref) {

    try {

      const kind = await resolveMoolreIntentKind(externalref);

      const status = await checkMoolrePaymentStatus(externalref);

      if (status.isPaid) {

        const amountGhs = Number(status.data?.amount ?? status.data?.Amount ?? 0) || undefined;

        if (kind === 'fee') {

          await finalizeFeeMoolreIntentByReference(externalref, amountGhs);

        } else if (kind === 'book') {

          await finalizeBookMoolreIntentByReference(externalref, amountGhs);

        }

      }

    } catch (err) {

      console.error('[moolre-success] reconcile error:', err.message);

    }

  }



  const safeRef = externalref.replace(/[^a-zA-Z0-9_-]/g, '');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  res.send(`<!DOCTYPE html>

<html>

<head>

  <meta charset="utf-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>Payment received</title>

  <style>

    body { font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center;

      min-height:100vh; margin:0; background:#f4f6fb; color:#0f172a; }

    .card { background:#fff; border-radius:16px; padding:28px 24px; text-align:center;

      box-shadow:0 8px 30px rgba(15,23,42,.08); max-width:320px; }

    h1 { font-size:18px; margin:0 0 8px; }

    p { font-size:13px; color:#64748b; margin:0; line-height:1.5; }

  </style>

</head>

<body>

  <div class="card">

    <h1>Payment received</h1>

    <p>You can close this window. Your payment is being confirmed.</p>

  </div>

  <script>

    try {

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {

        window.ReactNativeWebView.postMessage(JSON.stringify({

          type: 'moolre-payment-success',

          reference: ${JSON.stringify(safeRef)},

          externalref: ${JSON.stringify(safeRef)}

        }));

      }

      if (window.parent && window.parent !== window) {

        window.parent.postMessage({

          type: 'moolre-payment-success',

          reference: ${JSON.stringify(safeRef)},

          externalref: ${JSON.stringify(safeRef)}

        }, '*');

      }

    } catch (e) {}

  </script>

</body>

</html>`);

}



module.exports = {

  moolreWebhookHandler,

  moolrePaymentSuccessHandler,

};


