# 🎓 School Portal — Gesture Authentication

A School Portal website with **ESP32 gesture-based password authentication**. Users log in by entering their username on the website, then performing a 6-gesture sequence on a PAJ7620U2 sensor connected to an ESP32. Built with Node.js, Express, and PostgreSQL.

## How It Works

1. User enters their **username** on the website and clicks **"Enter Password"**
2. The website queues an authentication command on the server
3. The **ESP32 Logic Node** picks up the command via HTTP polling
4. The user performs **6 gestures** on the sensor (UP, DOWN, LEFT, RIGHT, FORWARD, BACKWARD, CW, CCW)
5. The ESP32 compares the gestures to the stored password and reports the result
6. The website detects the result and grants or denies access

```
Browser  ←→  Server (Render)  ←→  ESP32 Logic Node  ←→  ESP32 Sensor Node
 (polls)        (middleman)          (polls + auth)        (reads gestures)
```

---

## Features

### Admin
- Login with gesture authentication
- Create new student accounts (name + username)
- Set gesture passwords for students via the ESP32 sensor
- View all registered students and their password status
- Add or update grades for any student

### Student
- Login with gesture authentication
- View personal profile (name, username)
- View own grades

> **Note:** Students cannot self-register — only Admins can create student accounts and set their gesture passwords.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Node.js + Express                 |
| Database   | PostgreSQL                        |
| Frontend   | Plain HTML + CSS + Vanilla JS     |
| Sessions   | express-session                   |
| Hardware   | 2× ESP32, PAJ7620U2 gesture sensor, LEDs, buzzer |
| Protocol   | HTTP polling + ESP-NOW (between ESP32s) |

---

## File Structure

```
/project
├── server.js                  # Express server, API routes, DB init
├── package.json
├── .gitignore
├── logic.txt                  # ESP32 #2 — Logic Node source code
├── sensor.txt                 # ESP32 #1 — Sensor Node source code
└── /public
    ├── login.html             # Login page with gesture auth flow
    ├── admin-dashboard.html   # Admin: manage students & grades
    ├── student-dashboard.html # Student: view profile & grades
    └── style.css              # Shared stylesheet
```

---

## Database Schema

### `users`
| Column           | Type         | Notes                         |
|------------------|--------------|-------------------------------|
| id               | SERIAL (PK)  | Auto-increment                |
| name             | VARCHAR(255)  |                               |
| username         | VARCHAR(255)  | UNIQUE                        |
| gesture_password | INTEGER[]     | Array of 6 gesture codes      |
| role             | VARCHAR(50)   | `'admin'` or `'student'`      |

### `grades`
| Column     | Type         | Notes                    |
|------------|--------------|--------------------------|
| id         | SERIAL (PK)  | Auto-increment           |
| student_id | INTEGER (FK)  | References `users(id)`   |
| subject    | VARCHAR(255)  |                          |
| grade      | VARCHAR(10)   |                          |

### `esp_commands`
| Column     | Type          | Notes                                     |
|------------|---------------|-------------------------------------------|
| id         | SERIAL (PK)   | Auto-increment                            |
| cmd        | VARCHAR(20)    | `'auth'` or `'create'`                   |
| username   | VARCHAR(255)   | Target user                               |
| token      | VARCHAR(255)   | Unique token for auth sessions            |
| status     | VARCHAR(20)    | `'pending'`, `'processing'`, `'success'`, `'fail'` |
| role       | VARCHAR(50)    | User's role (for redirect after auth)     |
| created_at | TIMESTAMP      | Auto-set                                  |

### Auto-Seeding
On first startup, the server automatically creates:
- **Admin:** username `admin`, gesture password `[1,1,1,1,1,1]` (six UP gestures)

---

## API Routes

### Browser Endpoints

| Method | Endpoint                 | Auth      | Description                              |
|--------|--------------------------|-----------|------------------------------------------|
| POST   | `/login`                 | Public    | Send `{ username }`, get `{ token }`     |
| GET    | `/auth/status?token=xxx` | Public    | Poll for auth result                     |
| GET    | `/logout`                | Public    | Destroy session & redirect               |
| GET    | `/api/me`                | Logged in | Get current user info                    |
| GET    | `/api/students`          | Admin     | List all students                        |
| POST   | `/api/students`          | Admin     | Create a new student (name, username)    |
| POST   | `/esp/command`           | Admin     | Queue a create command for ESP32         |
| GET    | `/api/grades/:studentId` | Logged in | Get grades for a student                 |
| POST   | `/api/grades`            | Admin     | Add or update a grade                    |

### ESP32 Endpoints

All require `X-ESP-Secret` header matching the server's `ESP_SECRET` env var.

| Method | Endpoint                | Description                                |
|--------|-------------------------|--------------------------------------------|
| GET    | `/esp/command`          | Poll for pending commands                  |
| GET    | `/user/password?username=xxx` | Fetch stored gesture password        |
| POST   | `/auth/result`          | Post auth result `{ token, success }`      |
| POST   | `/users/create-password`| Post new gesture password `{ username, gestures }` |

---

## Gesture Codes

| Code | Gesture   |
|------|-----------|
| 1    | UP        |
| 2    | DOWN      |
| 3    | LEFT      |
| 4    | RIGHT     |
| 5    | FORWARD   |
| 6    | BACKWARD  |
| 7    | CLOCKWISE |
| 8    | COUNTER-CLOCKWISE |

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
   cd gesture-authentication-website
   npm install
   ```

4. **Set environment variable and run:**
   ```bash
   export DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/school_portal
   node server.js
   ```

5. **Open** `http://localhost:3000/login.html` in your browser.

6. **Login as Admin:** username `admin`, gesture password is six UP gestures (`1,1,1,1,1,1`)

### ESP32 Setup

1. **Flash `sensor.txt`** to ESP32 #1 (Sensor Node) — connects to the PAJ7620U2 sensor
2. **Flash `logic.txt`** to ESP32 #2 (Logic Node) — handles WiFi and server communication
3. **Update these values in `logic.txt`** before flashing:
   ```cpp
   const char* WIFI_SSID     = "your-wifi-ssid";
   const char* WIFI_PASSWORD = "your-wifi-password";
   const char* SERVER_URL    = "https://your-app.onrender.com";
   const char* ESP_SECRET    = "ily33";  // must match server
   ```
4. Ensure both ESP32s are powered on and can see each other via ESP-NOW

### Render Deployment

1. **Push code to GitHub.**

2. **Create a PostgreSQL instance on Render:**
   - Go to Render Dashboard → New → PostgreSQL
   - Note the **Internal Database URL**

3. **Create a Web Service on Render:**
   - Connect your GitHub repo
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

4. **Set Environment Variables** in the Web Service settings:
   | Variable        | Value                                       |
   |-----------------|---------------------------------------------|
   | `DATABASE_URL`  | *(paste Internal Database URL from step 2)* |
   | `SESSION_SECRET` | *(any random secret string)*               |
   | `ESP_SECRET`    | `ily33` *(must match ESP32 code)*           |

5. **Deploy.** The server auto-creates tables and seeds the admin on first run.

---

## Authentication Flows

### Login Flow
```
1. Browser → POST /login { username: "admin" }
2. Server queues auth command, returns { token: "abc123" }
3. Browser polls GET /auth/status?token=abc123 every 1.5s
4. ESP32 polls GET /esp/command → picks up { cmd: "auth", username: "admin", token: "abc123" }
5. ESP32 fetches GET /user/password?username=admin → { gesture_password: [1,1,1,1,1,1] }
6. ESP32 enters AUTH mode, user performs 6 gestures on sensor
7. ESP32 compares, sends POST /auth/result { token: "abc123", success: true }
8. Browser poll sees { status: "success" } → session created → redirect to dashboard
```

### Create User Flow
```
1. Admin fills name + username → POST /api/students (creates user without password)
2. Admin dashboard sends POST /esp/command { cmd: "create", username: "newuser" }
3. ESP32 polls GET /esp/command → picks up { cmd: "create", username: "newuser" }
4. ESP32 enters CREATE mode, user performs 6 gestures on sensor
5. ESP32 sends POST /users/create-password { username: "newuser", gestures: [3,4,1,2,5,6] }
6. Server stores gesture password → admin dashboard detects completion
```

---

## Default Credentials

| Role  | Username | Gesture Password                    |
|-------|----------|-------------------------------------|
| Admin | `admin`  | `1,1,1,1,1,1` (six UP gestures)    |

> Students are created by the admin and their gesture passwords are set via the ESP32 sensor.

---

## Development Assumptions

- **No password hashing** — gesture passwords are stored as plain integer arrays. This is suitable for a hardware demo project.
- **Polling-based** — the ESP32 polls the server every 2 seconds; the browser polls every 1.5 seconds. No WebSocket needed.
- **Single ESP32 pair** — the system assumes one Sensor + Logic node pair. Only one auth/create session can be active at a time.
- **ESP-NOW** is used for communication between the two ESP32 boards (Sensor ↔ Logic). The Logic node handles all WiFi/HTTP communication.
