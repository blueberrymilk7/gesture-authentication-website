/**
 * Admin Attendance JS
 * =====================
 * Mark and view attendance records with filtering.
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

// Set default date to today
document.getElementById('attDate').valueAsDate = new Date();

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

// ── Load Students Dropdown ─────────────────────────────────
async function loadStudents() {
  try {
    const res = await apiRequest('/api/admin/students');
    const students = await res.json();

    const attSelect = document.getElementById('attStudent');
    const filterSelect = document.getElementById('filterStudent');

    students.forEach(s => {
      attSelect.appendChild(new Option(`${s.name} (${s.student_id})`, s.id));
      filterSelect.appendChild(new Option(`${s.name} (${s.student_id})`, s.id));
    });
  } catch (err) {
    console.error('Failed to load students:', err);
  }
}

// ── Load Attendance ────────────────────────────────────────
async function loadAttendance(studentId = '', date = '') {
  try {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId);
    if (date) params.append('date', date);

    const url = `/api/admin/attendance${params.toString() ? '?' + params.toString() : ''}`;
    const res = await apiRequest(url);
    const records = await res.json();
    renderAttendance(records);
  } catch (err) {
    console.error('Failed to load attendance:', err);
  }
}

function renderAttendance(records) {
  const tbody = document.getElementById('attendanceTableBody');

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No attendance records found.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const statusBadge = getStatusBadge(r.status);
    return `
      <tr>
        <td><strong>${escapeHtml(r.student_name)}</strong></td>
        <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;">${escapeHtml(r.student_code)}</span></td>
        <td>${escapeHtml(r.student_grade)}</td>
        <td>${formatDate(r.date)}</td>
        <td><span class="badge badge-${r.status}">${statusBadge}</span></td>
      </tr>
    `;
  }).join('');
}

function getStatusBadge(status) {
  switch (status) {
    case 'present': return '✅ Present';
    case 'absent': return '❌ Absent';
    case 'late': return '⏰ Late';
    default: return status;
  }
}

// ── Mark Attendance ────────────────────────────────────────
document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    user_id: document.getElementById('attStudent').value,
    date: document.getElementById('attDate').value,
    status: document.getElementById('attStatus').value
  };

  if (!payload.user_id || !payload.date || !payload.status) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  try {
    const res = await apiRequest('/api/admin/attendance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadAttendance(
        document.getElementById('filterStudent').value,
        document.getElementById('filterDate').value
      );
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to record attendance.', 'error');
  }
});

// ── Filters ────────────────────────────────────────────────
document.getElementById('filterStudent').addEventListener('change', () => {
  loadAttendance(
    document.getElementById('filterStudent').value,
    document.getElementById('filterDate').value
  );
});

document.getElementById('filterDate').addEventListener('change', () => {
  loadAttendance(
    document.getElementById('filterStudent').value,
    document.getElementById('filterDate').value
  );
});

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
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
loadStudents().then(() => loadAttendance());
