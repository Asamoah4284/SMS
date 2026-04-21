const jwt = require('jsonwebtoken');

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : null;
}

/**
 * JWT parent auth for portal + Paystack routes.
 * Sets req.parentPhone (decoded phone from token).
 */
function authenticateParent(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PARENT') return res.status(403).json({ error: 'Access denied' });
    req.parentPhone = decoded.phone;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function parentPhoneVariants(parentPhone) {
  const localPhone = normalisePhone(parentPhone) || parentPhone;
  const e164Phone = '+233' + localPhone.slice(1);
  return [...new Set([localPhone, e164Phone, parentPhone])];
}

module.exports = { authenticateParent, normalisePhone, parentPhoneVariants };
