const crypto = require('crypto');
const { finalizePaystackIntentByReference, markIntentFailed } = require('../services/paystackFinalize');

/**
 * Express handler — mount with express.raw({ type: 'application/json' }) so req.body is a Buffer for HMAC.
 */
async function paystackWebhookHandler(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('PAYSTACK_SECRET_KEY missing — webhook disabled');
    return res.status(503).send('Paystack not configured');
  }

  const signature = req.headers['x-paystack-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');

  if (!signature) {
    return res.status(400).send('Invalid payload');
  }

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  if (hash !== signature) {
    console.warn('Paystack webhook: bad signature');
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  try {
    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data?.reference;
      const amount = data?.amount;
      if (!reference || amount == null) {
        return res.status(200).json({ received: true });
      }

      const result = await finalizePaystackIntentByReference(reference, Number(amount));
      if (!result.ok && result.reason === 'AMOUNT_MISMATCH') {
        return res.status(400).json({ received: true, error: result.reason });
      }
    }

    if (event.event === 'charge.failed') {
      const ref = event.data?.reference;
      if (ref) await markIntentFailed(ref);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Paystack webhook error:', err);
    return res.status(500).json({ received: false });
  }
}

module.exports = { paystackWebhookHandler };
