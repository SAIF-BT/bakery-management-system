const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const verifyManager = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'Manager') {
      next();
    } else {
      return res.status(403).json({ success: false, message: 'Access denied. Managers only.' });
    }
  });
};

module.exports = { verifyToken, verifyManager };