/**
 * Student Dashboard JS
 * ======================
 * Loads profile, enrolled subjects, and announcements.
 */

// ── Auth Guard ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user || user.role !== 'student') {
  localStorage.clear();
  window.location.href = '/index.html';
}

document.getElementById('userName').textContent = user.name;
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
document.getElementById('welcomeTitle').textContent = `Welcome back, ${user.name.split(' ')[0]}!`;

// ── API Helper ─────────────────────────────────────────────
async function apiGet(url) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = '/index.html';
  }
  return res.json();
}

// ── Load Profile ───────────────────────────────────────────
async function loadProfile() {
  try {
    const profile = await apiGet('/api/student/profile');

    // Profile card
    document.getElementById('profileName').textContent = profile.name;
    document.getElementById('profileStudentId').textContent = profile.student_id;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profileGrade').textContent = profile.grade || '—';
    document.getElementById('profileJoined').textContent = formatDate(profile.created_at);
    document.getElementById('profileAvatar').textContent = profile.name.charAt(0).toUpperCase();

    // Enrolled subjects
    const grid = document.getElementById('subjectsGrid');
    if (profile.subjects && profile.subjects.length > 0) {
      grid.innerHTML = profile.subjects.map(s => `
        <div class="subject-chip">
          ${escapeHtml(s.name)}
          <span class="code">${escapeHtml(s.code)}</span>
        </div>
      `).join('');
    } else {
      grid.innerHTML = '<div class="empty-state"><p>No subjects enrolled yet.</p></div>';
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// ── Load Announcements ────────────────────────────────────
async function loadAnnouncements() {
  try {
    const announcements = await apiGet('/api/student/announcements');
    const container = document.getElementById('announcementsList');

    if (announcements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <p>No announcements at this time.</p>
        </div>
      `;
    } else {
      container.innerHTML = announcements.map(ann => `
        <div class="announcement-card">
          <h3>${escapeHtml(ann.title)}</h3>
          <p>${escapeHtml(ann.content)}</p>
          <div class="announcement-meta">
            <span>✍️ ${escapeHtml(ann.author_name)}</span>
            <span>📅 ${formatDate(ann.created_at)}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load announcements:', err);
  }
}

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── Sidebar & Logout ──────────────────────────────────────
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobileOverlay').classList.toggle('active');
});
document.getElementById('mobileOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('active');
});
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

// ── Initialize ─────────────────────────────────────────────
loadProfile();
loadAnnouncements();
