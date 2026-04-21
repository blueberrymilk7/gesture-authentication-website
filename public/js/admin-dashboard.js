/**
 * Admin Dashboard JS
 * ====================
 * Loads stats and recent announcements for the admin dashboard.
 * Also handles sidebar mobile toggle, logout, and user info display.
 */

// ── Auth Guard ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'admin') {
  localStorage.clear();
  window.location.href = '/index.html';
}

// ── Display user info ──────────────────────────────────────
document.getElementById('userName').textContent = user.name;
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

// ── API Helper ─────────────────────────────────────────────
async function apiGet(url) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = '/index.html';
    return;
  }
  return res.json();
}

// ── Load Dashboard Stats ───────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await apiGet('/api/admin/stats');

    document.getElementById('totalStudents').textContent = stats.totalStudents;
    document.getElementById('totalAnnouncements').textContent = stats.totalAnnouncements;
    document.getElementById('avgAttendance').textContent = stats.avgAttendance + '%';
    document.getElementById('avgGrade').textContent = stats.avgGrade + '/100';

    // Render recent announcements
    const container = document.getElementById('recentAnnouncements');
    if (stats.recentAnnouncements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <p>No announcements yet</p>
        </div>
      `;
    } else {
      container.innerHTML = stats.recentAnnouncements.map(ann => `
        <div class="announcement-card">
          <h3>${escapeHtml(ann.title)}</h3>
          <p>${escapeHtml(ann.content)}</p>
          <div class="announcement-meta">
            <span>📅 ${formatDate(ann.created_at)}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ── Utility: Escape HTML ───────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Utility: Format Date ───────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── Toast Notification ─────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Logout ─────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

// ── Mobile Sidebar Toggle ──────────────────────────────────
const sidebar = document.getElementById('sidebar');
const mobileToggle = document.getElementById('mobileToggle');
const mobileOverlay = document.getElementById('mobileOverlay');

mobileToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  mobileOverlay.classList.toggle('active');
});

mobileOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  mobileOverlay.classList.remove('active');
});

// ── Initialize ─────────────────────────────────────────────
loadDashboard();
