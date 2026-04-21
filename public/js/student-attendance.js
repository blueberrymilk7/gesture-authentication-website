/**
 * Student Attendance JS
 * =======================
 * View own attendance with visual calendar and summary stats.
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

// ── Load Attendance ────────────────────────────────────────
async function loadAttendance() {
  try {
    const data = await apiGet('/api/student/attendance');
    const { records, summary } = data;

    // Update stats
    if (summary && summary.total > 0) {
      const rate = ((summary.present / summary.total) * 100).toFixed(1);
      document.getElementById('attendanceRate').textContent = rate + '%';
      document.getElementById('presentCount').textContent = summary.present;
      document.getElementById('lateCount').textContent = summary.late;
      document.getElementById('absentCount').textContent = summary.absent;
    }

    // Render calendar grid
    renderCalendar(records);

    // Render table
    renderTable(records);
  } catch (err) {
    console.error('Failed to load attendance:', err);
  }
}

function renderCalendar(records) {
  const grid = document.getElementById('attendanceGrid');

  if (records.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No attendance records yet.</p></div>';
    return;
  }

  // Sort by date ascending
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  grid.innerHTML = sorted.map(r => {
    const day = new Date(r.date + 'T00:00:00').getDate();
    const statusEmoji = r.status === 'present' ? '✓' : r.status === 'absent' ? '✗' : '!';
    return `
      <div class="attendance-dot ${r.status}" title="${formatDateFull(r.date)} — ${r.status}">
        ${day}
      </div>
    `;
  }).join('');
}

function renderTable(records) {
  const tbody = document.getElementById('attendanceTableBody');

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="3">
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No attendance records available.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const statusBadge = r.status === 'present' ? '✅ Present'
      : r.status === 'absent' ? '❌ Absent'
      : '⏰ Late';
    const dayName = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    return `
      <tr>
        <td>${formatDateFull(r.date)}</td>
        <td>${dayName}</td>
        <td><span class="badge badge-${r.status}">${statusBadge}</span></td>
      </tr>
    `;
  }).join('');
}

// ── Utilities ──────────────────────────────────────────────
function formatDateFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
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
loadAttendance();
