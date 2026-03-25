/**
 * Central error handler middleware.
 * Must be registered last with app.use(errorHandler).
 */
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      message: 'A record with that value already exists',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found' });
  }

  // Validation errors (express-validator)
  if (err.type === 'validation') {
    return res.status(422).json({ message: 'Validation failed', errors: err.errors });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  res.status(status).json({ message });
}

module.exports = { errorHandler };
