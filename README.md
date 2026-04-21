# 🎓 School Portal

A minimal, clean School Portal website built with Node.js, Express, and PostgreSQL. Supports **Admin** and **Student** roles with session-based authentication.

## Features

### Admin
- Login with pre-seeded credentials
- Add new student accounts (name, email, password)
- View all registered students
- Add or update grades for any student

### Student
- Login with credentials created by Admin
- View personal profile (name, email)
- View own grades

> **Note:** Students cannot self-register — only Admins can create student accounts.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | Node.js + Express                 |
| Database  | PostgreSQL                        |
| Frontend  | Plain HTML + CSS + Vanilla JS     |
| Sessions  | express-session                   |

---

## File Structure

```
/project
├── server.js                  # Express server, API routes, DB init
├── package.json
├── .gitignore
└── /public
    ├── login.html             # Shared login page
    ├── admin-dashboard.html   # Admin: manage students & grades
    ├── student-dashboard.html # Student: view profile & grades
    └── style.css              # Shared stylesheet
```

---

## Database Schema

### `users`
| Column   | Type         | Notes                    |
|----------|--------------|--------------------------|
| id       | SERIAL (PK)  | Auto-increment           |
| name     | VARCHAR(255)  |                          |
| email    | VARCHAR(255)  | UNIQUE                   |
| password | VARCHAR(255)  | Plaintext                |
| role     | VARCHAR(50)   | `'admin'` or `'student'` |

### `grades`
| Column     | Type         | Notes                    |
|------------|--------------|--------------------------|
| id         | SERIAL (PK)  | Auto-increment           |
| student_id | INTEGER (FK)  | References `users(id)`   |
| subject    | VARCHAR(255)  |                          |
| grade      | VARCHAR(10)   |                          |

### Auto-Seeding
On first startup, the server automatically creates:
- **Admin:** `admin@school.com` / `admin123`
- **Student 1:** Alice Johnson — `alice@school.com` / `alice123`
- **Student 2:** Bob Smith — `bob@school.com` / `bob123`
- Sample grades for both students

---

## API Routes

| Method | Endpoint                | Auth    | Description                |
|--------|-------------------------|---------|----------------------------|
| POST   | `/login`                | Public  | Authenticate user          |
| GET    | `/logout`               | Public  | Destroy session & redirect |
| GET    | `/api/me`               | Logged in | Get current user info    |
| GET    | `/api/students`         | Admin   | List all students          |
| POST   | `/api/students`         | Admin   | Create a new student       |
| GET    | `/api/grades/:studentId`| Logged in | Get grades for student  |
| POST   | `/api/grades`           | Admin   | Add or update a grade      |

---

## Setup Guide

### Local Development

1. **Prerequisites:** Node.js (v16+) and PostgreSQL installed locally.

2. **Create a PostgreSQL database:**
   ```bash
   createdb school_portal
   ```

3. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd <project-folder>
   npm install
   ```

4. **Set environment variable and run:**
   ```bash
   export DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/school_portal
   node server.js
   ```

5. **Open** `http://localhost:3000/login.html` in your browser.

6. **Login as Admin:** `admin@school.com` / `admin123`

### Render Deployment

1. **Push code to GitHub** (or GitLab).

2. **Create a PostgreSQL instance on Render:**
   - Go to Render Dashboard → New → PostgreSQL
   - Note the **Internal Database URL**

3. **Create a Web Service on Render:**
   - Connect your GitHub repo
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

4. **Set Environment Variables** in the Web Service settings:
   | Variable        | Value                                   |
   |-----------------|-----------------------------------------|
   | `DATABASE_URL`  | *(paste Internal Database URL from step 2)* |
   | `SESSION_SECRET` | *(any random secret string)*           |

5. **Deploy.** The server auto-creates tables and seeds data on first run.

---

## Default Credentials

| Role    | Email              | Password  |
|---------|--------------------|-----------|
| Admin   | admin@school.com   | admin123  |
| Student | alice@school.com   | alice123  |
| Student | bob@school.com     | bob123    |
