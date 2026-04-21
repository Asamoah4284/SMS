const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const paystackSk = process.env.PAYSTACK_SECRET_KEY;
if (paystackSk && String(paystackSk).trim()) {
  const mode = String(paystackSk).startsWith('sk_live') ? 'live' : 'test';
  console.log(`Paystack: enabled (${mode} key loaded from .env)`);
} else {
  console.warn('Paystack: PAYSTACK_SECRET_KEY missing — parent app “Pay with Paystack” will return 503 until set. Restart server after editing .env.');
}

const express = require('express');
const cors = require('cors');

const routes = require('./src/routes');
const { paystackWebhookHandler } = require('./src/routes/paystackWebhook');
const { errorHandler } = require('./src/middleware/errorHandler');
const prisma = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * CORS allowlist. If CORS_ORIGINS is set → use that list only (comma-separated).
 * Otherwise → http://localhost:3000 + FRONTEND_URL so local Next dev can call a deployed API (e.g. Render)
 * without missing Access-Control-Allow-Origin on preflight.
 */
function buildAllowedCorsOrigins() {
  const explicit = process.env.CORS_ORIGINS?.trim();
  if (explicit) {
    return explicit.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const localhost = 'http://localhost:3000';
  const frontend = process.env.FRONTEND_URL?.trim();
  const origins = new Set([localhost]);
  if (frontend) origins.add(frontend);
  return [...origins];
}

const allowedCorsOrigins = buildAllowedCorsOrigins();

/** Any https://*.netlify.app (production + deploy previews + branch deploys). */
function isNetlifyAppOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    return hostname === 'netlify.app' || hostname.endsWith('.netlify.app');
  } catch {
    return false;
  }
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedCorsOrigins.includes(origin)) return callback(null, true);
    if (isNetlifyAppOrigin(origin)) return callback(null, true);
    console.warn(`CORS rejected origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
}));
// Paystack webhook must verify HMAC on the raw body (do not parse JSON globally first)
app.post('/api/v1/webhooks/paystack', express.raw({ type: 'application/json' }), (req, res, next) => {
  Promise.resolve(paystackWebhookHandler(req, res)).catch(next);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// API routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectDatabaseWithRetry(maxRetries = 5, retryDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await prisma.$connect();
      console.log('Database connection established');
      return;
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        await delay(retryDelayMs);
      }
    }
  }

  throw new Error('Unable to connect to database after multiple attempts');
}

async function startServer() {
  try {
    await connectDatabaseWithRetry();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origins: ${allowedCorsOrigins.join(', ')}`);
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
