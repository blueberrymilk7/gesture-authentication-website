/**
 * Auth Routes
 * ------------
 * POST /api/auth/login — Authenticate user and return JWT token
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

module.exports = function (db) {
  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { token, user: { id, name, email, role, ... } }
   */
  router.post('/login', (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      // Find user by email
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Verify password
      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Generate JWT token (expires in 24 hours)
      const tokenPayload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        grade: user.grade
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

      // Return token and user info (excluding password)
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          student_id: user.student_id,
          grade: user.grade
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  return router;
};
