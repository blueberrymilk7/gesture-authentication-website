const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Shared secret the ESP32 sends in X-ESP-Secret header ──────────────
const ESP_SECRET = process.env.ESP_SECRET || 'ily33';

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

// ── ESP Secret middleware ─────────────────────────────────────────────
function requireEspSecret(req, res, next) {
  if (req.headers['x-esp-secret'] !== ESP_SECRET) {
    return res.status(403).json({ error: 'Invalid ESP secret' });
  }
  next();
}

// ── Database Initialization ──────────────────────────────────────────
async function initDB() {
  // Users table — username-based, gesture password
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      gesture_password INTEGER[],
      role VARCHAR(50) NOT NULL DEFAULT 'student'
    )
  `);

  // Grades table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      grade VARCHAR(10) NOT NULL
    )
  `);

  // ESP command queue
  await pool.query(`
    CREATE TABLE IF NOT EXISTS esp_commands (
      id SERIAL PRIMARY KEY,
      cmd VARCHAR(20) NOT NULL,
      username VARCHAR(255) NOT NULL,
      token VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      role VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed admin if not exists (default gesture password: 1,1,1,1,1,1 = six UP gestures)
  const adminCheck = await pool.query("SELECT id FROM users WHERE username = 'admin'");
  if (adminCheck.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (name, username, gesture_password, role) VALUES ('Admin', 'admin', '{1,1,1,1,1,1}', 'admin')"
    );
    console.log('✔ Database seeded with admin (username: admin, gesture: 1,1,1,1,1,1)');
  }
}

// ── Auth Routes ──────────────────────────────────────────────────────

// POST /login — browser sends { username }, server queues an auth command
app.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    // Check user exists
    const userResult = await pool.query('SELECT id, name, username, role, gesture_password FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check that user has a gesture password set
    if (!user.gesture_password || user.gesture_password.length !== 6) {
      return res.status(400).json({ error: 'Gesture password not configured for this user' });
    }

    // Generate a unique token for this auth session
    const token = crypto.randomUUID();

    // Clear any stale pending commands for this user
    await pool.query(
      "DELETE FROM esp_commands WHERE username = $1 AND status = 'pending'",
      [username]
    );

    // Queue the auth command
    await pool.query(
      "INSERT INTO esp_commands (cmd, username, token, status, role) VALUES ('auth', $1, $2, 'pending', $3)",
      [username, token, user.role]
    );

    res.json({ token, status: 'waiting' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/status?token=xxx — browser polls this for auth result
app.get('/auth/status', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const result = await pool.query(
      'SELECT status, role, username FROM esp_commands WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const cmd = result.rows[0];

    if (cmd.status === 'success') {
      // Auth succeeded — create session
      const userResult = await pool.query(
        'SELECT id, name, username, role FROM users WHERE username = $1',
        [cmd.username]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role };
      }

      // Clean up the command
      await pool.query('DELETE FROM esp_commands WHERE token = $1', [token]);

      return res.json({ status: 'success', role: cmd.role });
    }

    if (cmd.status === 'fail') {
      // Clean up the command
      await pool.query('DELETE FROM esp_commands WHERE token = $1', [token]);
      return res.json({ status: 'fail' });
    }

    // Still pending or processing
    return res.json({ status: cmd.status });
  } catch (err) {
    console.error('Auth status error:', err);
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

// ── ESP32 Routes ─────────────────────────────────────────────────────

// GET /esp/command — ESP32 polls for pending commands
app.get('/esp/command', requireEspSecret, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, cmd, username, token FROM esp_commands WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.json({ none: true });
    }

    const cmd = result.rows[0];

    // Mark as processing so it's not sent again
    await pool.query(
      "UPDATE esp_commands SET status = 'processing' WHERE id = $1",
      [cmd.id]
    );

    res.json({
      cmd: cmd.cmd,
      username: cmd.username,
      token: cmd.token || undefined,
    });
  } catch (err) {
    console.error('ESP command poll error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /user/password?username=xxx — ESP32 fetches gesture password
app.get('/user/password', requireEspSecret, async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const result = await pool.query(
      'SELECT gesture_password FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0 || !result.rows[0].gesture_password) {
      return res.status(404).json({ error: 'User not found or no password set' });
    }

    res.json({ gesture_password: result.rows[0].gesture_password });
  } catch (err) {
    console.error('Fetch password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/result — ESP32 posts auth result
app.post('/auth/result', requireEspSecret, async (req, res) => {
  const { token, success } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const newStatus = success ? 'success' : 'fail';
    await pool.query(
      'UPDATE esp_commands SET status = $1 WHERE token = $2',
      [newStatus, token]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Auth result error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /users/create-password — ESP32 posts new gesture password after create mode
app.post('/users/create-password', requireEspSecret, async (req, res) => {
  const { username, gestures } = req.body;
  if (!username || !gestures || gestures.length !== 6) {
    return res.status(400).json({ error: 'Username and 6 gestures are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET gesture_password = $1 WHERE username = $2 RETURNING id, name, username',
      [gestures, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clean up any create commands for this user
    await pool.query(
      "DELETE FROM esp_commands WHERE username = $1 AND cmd = 'create'",
      [username]
    );

    console.log(`✔ Gesture password set for user: ${username}`);
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('Create password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /esp/command — admin queues a create command from the dashboard
app.post('/esp/command', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { cmd, username } = req.body;
  if (!cmd || !username) return res.status(400).json({ error: 'cmd and username are required' });

  try {
    // Clear any stale pending commands for this user
    await pool.query(
      "DELETE FROM esp_commands WHERE username = $1 AND status = 'pending'",
      [username]
    );

    await pool.query(
      "INSERT INTO esp_commands (cmd, username, status) VALUES ($1, $2, 'pending')",
      [cmd, username]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Queue command error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Student Routes ───────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query(
      "SELECT id, name, username, (gesture_password IS NOT NULL) as has_password FROM users WHERE role = 'student' ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/students', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, username } = req.body;
  if (!name || !username) return res.status(400).json({ error: 'Name and username are required' });
  try {
    const result = await pool.query(
      "INSERT INTO users (name, username, role) VALUES ($1, $2, 'student') RETURNING id, name, username",
      [name, username]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
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
