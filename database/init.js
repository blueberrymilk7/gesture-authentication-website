/**
 * Database Initialization & Seeding
 * ----------------------------------
 * Creates all tables and seeds with:
 *   - 1 admin account
 *   - 3 sample students
 *   - 5 subjects
 *   - Sample grades & attendance records
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'school.db');

function initializeDatabase() {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Create Tables ─────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      student_id TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      grade TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      score REAL,
      max_score REAL DEFAULT 100,
      term TEXT DEFAULT 'Term 1',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      UNIQUE(user_id, subject_id, term)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      posted_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (posted_by) REFERENCES users(id)
    );
  `);

  // ── Seed Data (only if users table is empty) ──────────────────

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('🌱 Seeding database...');
    seedDatabase(db);
    console.log('✅ Database seeded successfully!');
  }

  return db;
}

function seedDatabase(db) {
  const salt = bcrypt.genSaltSync(10);

  // ── Insert Admin ────────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, student_id, password, role, grade)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminPass = bcrypt.hashSync('admin123', salt);
  insertUser.run('Admin User', 'admin@school.com', null, adminPass, 'admin', null);

  // ── Insert Students ─────────────────────────────────────────
  const studentPass = bcrypt.hashSync('student123', salt);

  insertUser.run('Alice Johnson', 'alice@school.com', 'STU001', studentPass, 'student', '10-A');
  insertUser.run('Bob Williams', 'bob@school.com', 'STU002', studentPass, 'student', '10-A');
  insertUser.run('Carol Davis', 'carol@school.com', 'STU003', studentPass, 'student', '10-B');

  // ── Insert Subjects ─────────────────────────────────────────
  const insertSubject = db.prepare(`
    INSERT INTO subjects (name, code) VALUES (?, ?)
  `);

  const subjects = [
    ['Mathematics', 'MATH101'],
    ['English', 'ENG101'],
    ['Science', 'SCI101'],
    ['History', 'HIS101'],
    ['Computer Science', 'CS101']
  ];

  subjects.forEach(([name, code]) => insertSubject.run(name, code));

  // ── Insert Sample Grades ────────────────────────────────────
  const insertGrade = db.prepare(`
    INSERT INTO grades (user_id, subject_id, score, max_score, term)
    VALUES (?, ?, ?, 100, ?)
  `);

  // Alice (id=2), Bob (id=3), Carol (id=4)
  const sampleGrades = [
    // Alice - Term 1
    [2, 1, 92, 'Term 1'], [2, 2, 88, 'Term 1'], [2, 3, 95, 'Term 1'],
    [2, 4, 78, 'Term 1'], [2, 5, 97, 'Term 1'],
    // Bob - Term 1
    [3, 1, 75, 'Term 1'], [3, 2, 82, 'Term 1'], [3, 3, 68, 'Term 1'],
    [3, 4, 90, 'Term 1'], [3, 5, 85, 'Term 1'],
    // Carol - Term 1
    [4, 1, 88, 'Term 1'], [4, 2, 91, 'Term 1'], [4, 3, 84, 'Term 1'],
    [4, 4, 76, 'Term 1'], [4, 5, 93, 'Term 1']
  ];

  sampleGrades.forEach(([uid, sid, score, term]) =>
    insertGrade.run(uid, sid, score, term)
  );

  // ── Insert Sample Attendance ────────────────────────────────
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)
  `);

  // Generate 20 days of attendance for each student
  const statuses = ['present', 'present', 'present', 'present', 'late', 'absent'];
  const students = [2, 3, 4];

  students.forEach(studentId => {
    for (let i = 1; i <= 20; i++) {
      const day = String(i).padStart(2, '0');
      const date = `2026-04-${day}`;
      // Pseudo-random status based on student and day
      const statusIdx = (studentId * 3 + i * 7) % statuses.length;
      insertAttendance.run(studentId, date, statuses[statusIdx]);
    }
  });

  // ── Insert Sample Announcements ─────────────────────────────
  const insertAnnouncement = db.prepare(`
    INSERT INTO announcements (title, content, posted_by, created_at)
    VALUES (?, ?, 1, ?)
  `);

  insertAnnouncement.run(
    'Welcome to the New Academic Year!',
    'We are excited to welcome all students back for the 2026 academic year. Please check your schedules and make sure to attend orientation on the first day.',
    '2026-04-01 09:00:00'
  );
  insertAnnouncement.run(
    'Mid-Term Exams Schedule',
    'Mid-term examinations will be held from April 15th to April 22nd. Please review the detailed schedule posted on the notice board and prepare accordingly.',
    '2026-04-10 14:30:00'
  );
  insertAnnouncement.run(
    'Annual Sports Day',
    'The annual sports day will be held on May 5th. All students are encouraged to participate. Registration forms are available at the front office.',
    '2026-04-18 10:00:00'
  );
}

module.exports = { initializeDatabase, DB_PATH };
