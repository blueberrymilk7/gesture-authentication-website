/**
 * Authentication Middleware
 * -------------------------
 * Verifies JWT tokens and enforces role-based access control.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'school-portal-secret-key-2026';

/**
 * Verify that the request carries a valid JWT token.
 * Attaches decoded user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Factory: require a specific role (e.g. 'admin' or 'student').
 * Must be used AFTER authenticateToken.
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. ${role} role required.` });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
