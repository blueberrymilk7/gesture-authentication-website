/**
 * School Portal — Express Server
 * ================================
 * Entry point for the application.
 * Serves static frontend files and mounts API routes.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Initialize Database ──────────────────────────────────────────
const db = initializeDatabase();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve Static Frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/admin', require('./routes/admin')(db));
app.use('/api/student', require('./routes/student')(db));

// ── SPA Fallback for HTML5 routing ───────────────────────────────
// Serve specific HTML files for admin and student routes
app.get('/admin/*', (req, res) => {
  const page = req.path.replace('/admin/', '').replace(/\/$/, '') || 'dashboard';
  const filePath = path.join(__dirname, 'public', 'admin', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
  });
});

app.get('/student/*', (req, res) => {
  const page = req.path.replace('/student/', '').replace(/\/$/, '') || 'dashboard';
  const filePath = path.join(__dirname, 'public', 'student', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'student', 'dashboard.html'));
  });
});

// ── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏫 School Portal running at http://localhost:${PORT}`);
  console.log(`\n📋 Default credentials:`);
  console.log(`   Admin:   admin@school.com / admin123`);
  console.log(`   Student: alice@school.com / student123`);
  console.log(`            bob@school.com   / student123`);
  console.log(`            carol@school.com / student123\n`);
});

// ── Graceful Shutdown ────────────────────────────────────────────
process.on('SIGINT', () => {
  db.close();
  console.log('\n🔒 Database connection closed. Goodbye!');
  process.exit(0);
});
