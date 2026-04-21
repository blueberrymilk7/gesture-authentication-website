/**
 * Admin Routes
 * -------------
 * All routes require admin role.
 * Handles CRUD for students, announcements, grades, and attendance.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

module.exports = function (db) {
  // Apply auth middleware to all admin routes
  router.use(authenticateToken, requireRole('admin'));

  // ═══════════════════════════════════════════════════════════════
  //  DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════

  router.get('/stats', (req, res) => {
    try {
      const totalStudents = db.prepare(
        "SELECT COUNT(*) as count FROM users WHERE role = 'student'"
      ).get().count;

      const totalAnnouncements = db.prepare(
        'SELECT COUNT(*) as count FROM announcements'
      ).get().count;

      const avgAttendance = db.prepare(`
        SELECT ROUND(
          CAST(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS REAL) /
          NULLIF(COUNT(*), 0) * 100, 1
        ) as rate
        FROM attendance
      `).get().rate || 0;

      const avgGrade = db.prepare(
        'SELECT ROUND(AVG(score), 1) as avg FROM grades'
      ).get().avg || 0;

      const recentAnnouncements = db.prepare(
        'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 3'
      ).all();

      res.json({
        totalStudents,
        totalAnnouncements,
        avgAttendance,
        avgGrade,
        recentAnnouncements
      });
    } catch (err) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  STUDENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/admin/students — List all students */
  router.get('/students', (req, res) => {
    try {
      const students = db.prepare(
        "SELECT id, name, email, student_id, grade, created_at FROM users WHERE role = 'student' ORDER BY name"
      ).all();
      res.json(students);
    } catch (err) {
      console.error('List students error:', err);
      res.status(500).json({ error: 'Failed to fetch students.' });
    }
  });

  /** POST /api/admin/students — Create a new student */
  router.post('/students', (req, res) => {
    try {
      const { name, email, student_id, password, grade } = req.body;

      // Validate required fields
      if (!name || !email || !student_id || !password || !grade) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      // Check for duplicate email
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }

      // Check for duplicate student ID
      const existingId = db.prepare('SELECT id FROM users WHERE student_id = ?').get(student_id);
      if (existingId) {
        return res.status(409).json({ error: 'A student with this ID already exists.' });
      }

      // Hash password and insert
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, student_id, password, role, grade)
        VALUES (?, ?, ?, ?, 'student', ?)
      `).run(name, email, student_id, hashedPassword, grade);

      res.status(201).json({
        message: 'Student created successfully.',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Create student error:', err);
      res.status(500).json({ error: 'Failed to create student.' });
    }
  });

  /** PUT /api/admin/students/:id — Update a student */
  router.put('/students/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, student_id, grade, password } = req.body;

      // Check student exists
      const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(id);
      if (!student) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      // Check uniqueness constraints (excluding current student)
      if (email && email !== student.email) {
        const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
        if (dup) return res.status(409).json({ error: 'Email already in use.' });
      }
      if (student_id && student_id !== student.student_id) {
        const dup = db.prepare('SELECT id FROM users WHERE student_id = ? AND id != ?').get(student_id, id);
        if (dup) return res.status(409).json({ error: 'Student ID already in use.' });
      }

      // Build update query
      if (password) {
        const hashed = bcrypt.hashSync(password, 10);
        db.prepare(`
          UPDATE users SET name = ?, email = ?, student_id = ?, grade = ?, password = ?
          WHERE id = ?
        `).run(
          name || student.name,
          email || student.email,
          student_id || student.student_id,
          grade || student.grade,
          hashed,
          id
        );
      } else {
        db.prepare(`
          UPDATE users SET name = ?, email = ?, student_id = ?, grade = ?
          WHERE id = ?
        `).run(
          name || student.name,
          email || student.email,
          student_id || student.student_id,
          grade || student.grade,
          id
        );
      }

      res.json({ message: 'Student updated successfully.' });
    } catch (err) {
      console.error('Update student error:', err);
      res.status(500).json({ error: 'Failed to update student.' });
    }
  });

  /** DELETE /api/admin/students/:id — Delete a student */
  router.delete('/students/:id', (req, res) => {
    try {
      const { id } = req.params;
      const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(id);
      if (!student) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ message: 'Student deleted successfully.' });
    } catch (err) {
      console.error('Delete student error:', err);
      res.status(500).json({ error: 'Failed to delete student.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/admin/announcements — List all announcements */
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
      console.error('List announcements error:', err);
      res.status(500).json({ error: 'Failed to fetch announcements.' });
    }
  });

  /** POST /api/admin/announcements — Create announcement */
  router.post('/announcements', (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required.' });
      }

      const result = db.prepare(`
        INSERT INTO announcements (title, content, posted_by) VALUES (?, ?, ?)
      `).run(title, content, req.user.id);

      res.status(201).json({
        message: 'Announcement posted successfully.',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Create announcement error:', err);
      res.status(500).json({ error: 'Failed to create announcement.' });
    }
  });

  /** DELETE /api/admin/announcements/:id — Delete announcement */
  router.delete('/announcements/:id', (req, res) => {
    try {
      const { id } = req.params;
      const ann = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
      if (!ann) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
      res.json({ message: 'Announcement deleted successfully.' });
    } catch (err) {
      console.error('Delete announcement error:', err);
      res.status(500).json({ error: 'Failed to delete announcement.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  GRADES
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/admin/subjects — List all subjects */
  router.get('/subjects', (req, res) => {
    try {
      const subjects = db.prepare('SELECT * FROM subjects ORDER BY name').all();
      res.json(subjects);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch subjects.' });
    }
  });

  /** GET /api/admin/grades — All grades (optionally filter by student) */
  router.get('/grades', (req, res) => {
    try {
      const { student_id } = req.query;
      let query = `
        SELECT g.*, u.name as student_name, u.student_id as student_code,
               u.grade as student_grade, s.name as subject_name, s.code as subject_code
        FROM grades g
        JOIN users u ON g.user_id = u.id
        JOIN subjects s ON g.subject_id = s.id
      `;
      const params = [];

      if (student_id) {
        query += ' WHERE g.user_id = ?';
        params.push(student_id);
      }

      query += ' ORDER BY u.name, s.name';

      const grades = db.prepare(query).all(...params);
      res.json(grades);
    } catch (err) {
      console.error('List grades error:', err);
      res.status(500).json({ error: 'Failed to fetch grades.' });
    }
  });

  /** POST /api/admin/grades — Add or update a grade */
  router.post('/grades', (req, res) => {
    try {
      const { user_id, subject_id, score, max_score, term } = req.body;

      if (!user_id || !subject_id || score === undefined) {
        return res.status(400).json({ error: 'Student, subject, and score are required.' });
      }

      if (score < 0 || score > (max_score || 100)) {
        return res.status(400).json({ error: 'Score must be between 0 and the maximum score.' });
      }

      // Upsert: update if exists, insert if not
      const existing = db.prepare(
        'SELECT id FROM grades WHERE user_id = ? AND subject_id = ? AND term = ?'
      ).get(user_id, subject_id, term || 'Term 1');

      if (existing) {
        db.prepare(
          'UPDATE grades SET score = ?, max_score = ? WHERE id = ?'
        ).run(score, max_score || 100, existing.id);
        res.json({ message: 'Grade updated successfully.' });
      } else {
        db.prepare(`
          INSERT INTO grades (user_id, subject_id, score, max_score, term)
          VALUES (?, ?, ?, ?, ?)
        `).run(user_id, subject_id, score, max_score || 100, term || 'Term 1');
        res.status(201).json({ message: 'Grade added successfully.' });
      }
    } catch (err) {
      console.error('Add/update grade error:', err);
      res.status(500).json({ error: 'Failed to save grade.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  ATTENDANCE
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/admin/attendance — All attendance records */
  router.get('/attendance', (req, res) => {
    try {
      const { student_id, date } = req.query;
      let query = `
        SELECT a.*, u.name as student_name, u.student_id as student_code, u.grade as student_grade
        FROM attendance a
        JOIN users u ON a.user_id = u.id
      `;
      const conditions = [];
      const params = [];

      if (student_id) {
        conditions.push('a.user_id = ?');
        params.push(student_id);
      }
      if (date) {
        conditions.push('a.date = ?');
        params.push(date);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY a.date DESC, u.name';

      const records = db.prepare(query).all(...params);
      res.json(records);
    } catch (err) {
      console.error('List attendance error:', err);
      res.status(500).json({ error: 'Failed to fetch attendance.' });
    }
  });

  /** POST /api/admin/attendance — Mark attendance (upsert) */
  router.post('/attendance', (req, res) => {
    try {
      const { user_id, date, status } = req.body;

      if (!user_id || !date || !status) {
        return res.status(400).json({ error: 'Student, date, and status are required.' });
      }

      if (!['present', 'absent', 'late'].includes(status)) {
        return res.status(400).json({ error: 'Status must be present, absent, or late.' });
      }

      // Upsert
      const existing = db.prepare(
        'SELECT id FROM attendance WHERE user_id = ? AND date = ?'
      ).get(user_id, date);

      if (existing) {
        db.prepare('UPDATE attendance SET status = ? WHERE id = ?').run(status, existing.id);
        res.json({ message: 'Attendance updated.' });
      } else {
        db.prepare(
          'INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)'
        ).run(user_id, date, status);
        res.status(201).json({ message: 'Attendance recorded.' });
      }
    } catch (err) {
      console.error('Mark attendance error:', err);
      res.status(500).json({ error: 'Failed to record attendance.' });
    }
  });

  return router;
};
