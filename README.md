# 🏫 School Portal Website

A full-stack school management portal with **Admin** and **Student** dashboards. Built with Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript.

---

## ✨ Features

### Authentication & Access Control
- JWT-based login for Admin and Students
- Role-based access control (admin vs student dashboards)
- Only admins can create student accounts (no self-registration)
- Session management with logout

### Admin Panel
- **Dashboard** — Overview stats (total students, attendance rate, avg grade)
- **Student Management** — Add, edit, and delete student accounts
- **Announcements** — Post and delete announcements visible to all students
- **Grades** — Add/update student grades per subject and term
- **Attendance** — Mark daily attendance with filters

### Student Dashboard
- **Profile** — View personal info, grade/class, enrolled subjects
- **Announcements** — Read school announcements
- **Grades** — View own grades with progress bars and letter grades
- **Attendance** — Visual calendar grid and attendance summary

---

## 🛠 Tech Stack

| Layer          | Technology               |
|----------------|--------------------------|
| Backend        | Node.js + Express        |
| Database       | SQLite (better-sqlite3)  |
| Authentication | JWT (jsonwebtoken)       |
| Password Hash  | bcryptjs                 |
| Frontend       | Vanilla HTML, CSS, JS    |

---

## 📁 Project Structure

```
├── server.js                    # Express entry point
├── package.json
├── database/
│   └── init.js                  # DB schema + seed data
├── middleware/
│   └── auth.js                  # JWT + role middleware
├── routes/
│   ├── auth.js                  # Login endpoint
│   ├── admin.js                 # Admin CRUD endpoints
│   └── student.js               # Student read endpoints
└── public/
    ├── index.html               # Login page
    ├── css/
    │   ├── common.css           # Shared design system
    │   ├── login.css            # Login page styles
    │   ├── admin.css            # Admin color scheme (navy/indigo)
    │   └── student.css          # Student color scheme (teal/emerald)
    ├── js/
    │   ├── auth.js              # Login logic
    │   ├── admin-dashboard.js
    │   ├── admin-students.js
    │   ├── admin-announcements.js
    │   ├── admin-grades.js
    │   ├── admin-attendance.js
    │   ├── student-dashboard.js
    │   ├── student-grades.js
    │   └── student-attendance.js
    ├── admin/
    │   ├── dashboard.html
    │   ├── students.html
    │   ├── announcements.html
    │   ├── grades.html
    │   └── attendance.html
    └── student/
        ├── dashboard.html
        ├── grades.html
        └── attendance.html
```

---

## 🚀 Setup & Run

### Prerequisites
- **Node.js** v16 or later
- **npm** (comes with Node.js)

### Installation

```bash
# 1. Navigate to the project directory
cd gesture-authentication-website

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The server will start at **http://localhost:3000**

### First-time Setup
On first run, the database is **automatically created and seeded** with sample data. No manual setup required.

---

## 🔑 Default Login Credentials

| Role    | Email              | Password    |
|---------|--------------------|-------------|
| Admin   | admin@school.com   | admin123    |
| Student | alice@school.com   | student123  |
| Student | bob@school.com     | student123  |
| Student | carol@school.com   | student123  |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| POST   | `/api/auth/login`  | Login → returns JWT |

### Admin (requires admin JWT)
| Method | Endpoint                       | Description          |
|--------|--------------------------------|----------------------|
| GET    | `/api/admin/stats`             | Dashboard statistics |
| GET    | `/api/admin/students`          | List all students    |
| POST   | `/api/admin/students`          | Create student       |
| PUT    | `/api/admin/students/:id`      | Update student       |
| DELETE | `/api/admin/students/:id`      | Delete student       |
| GET    | `/api/admin/announcements`     | List announcements   |
| POST   | `/api/admin/announcements`     | Create announcement  |
| DELETE | `/api/admin/announcements/:id` | Delete announcement  |
| GET    | `/api/admin/grades`            | All grades           |
| POST   | `/api/admin/grades`            | Add/update grade     |
| GET    | `/api/admin/subjects`          | List subjects        |
| GET    | `/api/admin/attendance`        | All attendance       |
| POST   | `/api/admin/attendance`        | Mark attendance      |

### Student (requires student JWT)
| Method | Endpoint                       | Description         |
|--------|--------------------------------|---------------------|
| GET    | `/api/student/profile`         | Own profile         |
| GET    | `/api/student/grades`          | Own grades          |
| GET    | `/api/student/attendance`      | Own attendance      |
| GET    | `/api/student/announcements`   | All announcements   |

---

## 🎨 Design

- **Admin Theme**: Navy/Indigo gradient — professional, authoritative
- **Student Theme**: Teal/Emerald gradient — fresh, approachable
- **Login Page**: Glassmorphism card with animated background orbs
- **Responsive**: Fully mobile-friendly with collapsible sidebar
- **Typography**: Inter font from Google Fonts

---

## 📝 Database Schema

The SQLite database contains 5 tables:
- **users** — Admin and student accounts
- **subjects** — Course catalog (Math, English, Science, History, CS)
- **grades** — Student scores per subject and term
- **attendance** — Daily attendance records (present/absent/late)
- **announcements** — School announcements posted by admin
