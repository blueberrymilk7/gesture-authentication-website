const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'school-portal-dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 },
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── Database Initialization ──────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'student'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      grade VARCHAR(10) NOT NULL
    )
  `);

  const adminCheck = await pool.query("SELECT id FROM users WHERE email = 'admin@school.com'");
  if (adminCheck.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@school.com', 'admin123', 'admin')"
    );
    const s1 = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Alice Johnson', 'alice@school.com', 'alice123', 'student') RETURNING id"
    );
    const s2 = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Bob Smith', 'bob@school.com', 'bob123', 'student') RETURNING id"
    );
    await pool.query(
      "INSERT INTO grades (student_id, subject, grade) VALUES ($1,'Mathematics','A'),($1,'Science','B+'),($1,'English','A-')",
      [s1.rows[0].id]
    );
    await pool.query(
      "INSERT INTO grades (student_id, subject, grade) VALUES ($1,'Mathematics','B'),($1,'Science','A'),($1,'English','B+')",
      [s2.rows[0].id]
    );
    console.log('✔ Database seeded with admin and sample students');
  }
}

// ── Auth Routes ──────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// ── Student Routes ───────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query("SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/students', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  try {
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'student') RETURNING id, name, email",
      [name, email, password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Grade Routes ─────────────────────────────────────────────────────
app.get('/api/grades/:studentId', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const studentId = parseInt(req.params.studentId);
  if (req.session.user.role === 'student' && req.session.user.id !== studentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await pool.query('SELECT id, subject, grade FROM grades WHERE student_id = $1 ORDER BY subject', [studentId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/grades', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { student_id, subject, grade } = req.body;
  if (!student_id || !subject || !grade) return res.status(400).json({ error: 'All fields are required' });
  try {
    const existing = await pool.query('SELECT id FROM grades WHERE student_id = $1 AND subject = $2', [student_id, subject]);
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query('UPDATE grades SET grade = $1 WHERE student_id = $2 AND subject = $3 RETURNING *', [grade, student_id, subject]);
    } else {
      result = await pool.query('INSERT INTO grades (student_id, subject, grade) VALUES ($1, $2, $3) RETURNING *', [student_id, subject, grade]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Start Server ─────────────────────────────────────────────────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 School Portal running on http://localhost:${PORT}`)))
  .catch(err => { console.error('Failed to initialize database:', err); process.exit(1); });
