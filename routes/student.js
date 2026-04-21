/**
 * Student Routes
 * ---------------
 * All routes require student role.
 * Read-only access to own profile, grades, attendance, and announcements.
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

module.exports = function (db) {
  // Apply auth middleware to all student routes
  router.use(authenticateToken, requireRole('student'));

  /** GET /api/student/profile — Own profile with enrolled subjects */
  router.get('/profile', (req, res) => {
    try {
      const user = db.prepare(
        'SELECT id, name, email, student_id, grade, created_at FROM users WHERE id = ?'
      ).get(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      // Get subjects this student has grades for
      const subjects = db.prepare(`
        SELECT DISTINCT s.id, s.name, s.code
        FROM subjects s
        JOIN grades g ON g.subject_id = s.id
        WHERE g.user_id = ?
        ORDER BY s.name
      `).all(req.user.id);

      res.json({ ...user, subjects });
    } catch (err) {
      console.error('Profile error:', err);
      res.status(500).json({ error: 'Failed to fetch profile.' });
    }
  });

  /** GET /api/student/grades — Own grades */
  router.get('/grades', (req, res) => {
    try {
      const grades = db.prepare(`
        SELECT g.*, s.name as subject_name, s.code as subject_code
        FROM grades g
        JOIN subjects s ON g.subject_id = s.id
        WHERE g.user_id = ?
        ORDER BY g.term, s.name
      `).all(req.user.id);

      res.json(grades);
    } catch (err) {
      console.error('Student grades error:', err);
      res.status(500).json({ error: 'Failed to fetch grades.' });
    }
  });

  /** GET /api/student/attendance — Own attendance records */
  router.get('/attendance', (req, res) => {
    try {
      const records = db.prepare(`
        SELECT * FROM attendance
        WHERE user_id = ?
        ORDER BY date DESC
      `).all(req.user.id);

      // Also compute summary stats
      const summary = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
        FROM attendance WHERE user_id = ?
      `).get(req.user.id);

      res.json({ records, summary });
    } catch (err) {
      console.error('Student attendance error:', err);
      res.status(500).json({ error: 'Failed to fetch attendance.' });
    }
  });

  /** GET /api/student/announcements — All announcements */
  router.get('/announcements', (req, res) => {
    try {
      const announcements = db.prepare(`
        SELECT a.*, u.name as author_name
        FROM announcements a
        JOIN users u ON a.posted_by = u.id
        ORDER BY a.created_at DESC
      `).all();

      res.json(announcements);
    } catch (err) {
      console.error('Student announcements error:', err);
      res.status(500).json({ error: 'Failed to fetch announcements.' });
    }
  });

  return router;
};
