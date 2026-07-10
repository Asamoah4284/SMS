/**
 * Resolve public URLs for Moolre embed init (webhook + redirect).
 */

function stripTrailingSlashes(raw) {
  return String(raw || '').replace(/\/+$/, '');
}

function collapseDuplicateSlashes(url) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}

function resolveMoolreBackendBaseUrl() {
  const fromBackend = stripTrailingSlashes(process.env.BACKEND_URL || process.env.API_URL || '');
  if (fromBackend) return fromBackend;

  const callback = stripTrailingSlashes(process.env.MOOLRE_PAYMENT_CALLBACK_URL || '');
  if (callback) {
    const idx = callback.indexOf('/api/');
    if (idx > 0) return callback.slice(0, idx);
    return callback;
  }

  const port = process.env.PORT || 5000;
  return `http://127.0.0.1:${port}`;
}

function resolveMoolreWebhookUrl() {
  const explicit = process.env.MOOLRE_PAYMENT_CALLBACK_URL;
  if (explicit && String(explicit).trim()) {
    return collapseDuplicateSlashes(stripTrailingSlashes(String(explicit).trim()));
  }
  return `${resolveMoolreBackendBaseUrl()}/api/v1/webhooks/moolre`;
}

function resolveMoolreRedirectUrl() {
  const explicit = process.env.MOOLRE_REDIRECT_URL;
  if (explicit && String(explicit).trim()) {
    return collapseDuplicateSlashes(stripTrailingSlashes(String(explicit).trim()));
  }
  return `${resolveMoolreBackendBaseUrl()}/api/v1/webhooks/moolre/payment-success`;
}

module.exports = {
  resolveMoolreBackendBaseUrl,
  resolveMoolreWebhookUrl,
  resolveMoolreRedirectUrl,
};
