/**
 * Admin Announcements JS
 * ========================
 * Create and delete announcements.
 */

// ── Auth Guard ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user || user.role !== 'admin') {
  localStorage.clear();
  window.location.href = '/index.html';
}

document.getElementById('userName').textContent = user.name;
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

// ── API Helper ─────────────────────────────────────────────
async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = '/index.html';
  }
  return res;
}

// ── Load Announcements ────────────────────────────────────
async function loadAnnouncements() {
  try {
    const res = await apiRequest('/api/admin/announcements');
    const announcements = await res.json();
    renderAnnouncements(announcements);
  } catch (err) {
    console.error('Failed to load announcements:', err);
  }
}

function renderAnnouncements(announcements) {
  const container = document.getElementById('announcementsList');

  if (announcements.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📢</div>
        <p>No announcements yet. Post your first one above!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = announcements.map(ann => `
    <div class="announcement-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h3>${escapeHtml(ann.title)}</h3>
        <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${ann.id})" title="Delete">🗑️</button>
      </div>
      <p>${escapeHtml(ann.content)}</p>
      <div class="announcement-meta">
        <span>✍️ ${escapeHtml(ann.author_name)}</span>
        <span>📅 ${formatDate(ann.created_at)}</span>
      </div>
    </div>
  `).join('');
}

// ── Create Announcement ────────────────────────────────────
document.getElementById('announcementForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('annTitle').value.trim();
  const content = document.getElementById('annContent').value.trim();

  if (!title || !content) {
    showToast('Title and content are required.', 'error');
    return;
  }

  try {
    const res = await apiRequest('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      document.getElementById('announcementForm').reset();
      loadAnnouncements();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to post announcement.', 'error');
  }
});

// ── Delete Announcement ────────────────────────────────────
async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;

  try {
    const res = await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadAnnouncements();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete announcement.', 'error');
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
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
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
loadAnnouncements();
