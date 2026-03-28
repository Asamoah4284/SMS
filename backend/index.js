require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');
const prisma = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

/** Comma-separated browser origins allowed for CORS. Prefer CORS_ORIGINS when FRONTEND_URL is a single public URL (invite links). */
const allowedCorsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
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
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
