/**
 * Auth.js — Login Logic & Session Management
 * =============================================
 * Handles login form submission, JWT storage, and redirects.
 */

const API_BASE = '';

// ── Check if already logged in ─────────────────────────────
(function checkExistingSession() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (token && user) {
    // Redirect based on role
    if (user.role === 'admin') {
      window.location.href = '/admin/dashboard.html';
    } else {
      window.location.href = '/student/dashboard.html';
    }
  }
})();

// ── Login Form Handler ─────────────────────────────────────
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate
    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }

    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    hideError();

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === 'admin') {
        window.location.href = '/admin/dashboard.html';
      } else {
        window.location.href = '/student/dashboard.html';
      }
    } catch (err) {
      showError(err.message);
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });
}

function showError(msg) {
  errorMessage.textContent = msg;
  loginError.classList.add('visible');
}

function hideError() {
  loginError.classList.remove('visible');
}
