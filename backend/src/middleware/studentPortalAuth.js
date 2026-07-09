const jwt = require('jsonwebtoken');

/**
 * JWT student auth for student portal routes.
 * Sets req.studentDbId and req.schoolStudentId.
 */
function authenticateStudent(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'STUDENT') return res.status(403).json({ error: 'Access denied' });
    req.studentUserId = decoded.id;
    req.studentDbId = decoded.studentDbId;
    req.schoolStudentId = decoded.schoolStudentId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateStudent };
