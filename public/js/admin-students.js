/**
 * Admin Students JS
 * ===================
 * CRUD operations for student management.
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

// ── API Helpers ────────────────────────────────────────────
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
    return;
  }
  return res;
}

// ── Load Students ──────────────────────────────────────────
async function loadStudents() {
  try {
    const res = await apiRequest('/api/admin/students');
    const students = await res.json();
    renderStudents(students);
  } catch (err) {
    console.error('Failed to load students:', err);
    showToast('Failed to load students.', 'error');
  }
}

function renderStudents(students) {
  const tbody = document.getElementById('studentsTableBody');

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">👨‍🎓</div>
          <p>No students found. Add your first student!</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;">${escapeHtml(s.student_id)}</span></td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.grade || '—')}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editStudent(${s.id}, '${escapeAttr(s.name)}', '${escapeAttr(s.email)}', '${escapeAttr(s.student_id)}', '${escapeAttr(s.grade)}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id}, '${escapeAttr(s.name)}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ── Modal Management ───────────────────────────────────────
const modal = document.getElementById('studentModal');
const form = document.getElementById('studentForm');
const modalTitle = document.getElementById('modalTitle');
const passwordField = document.getElementById('studentPassword');

function openModal(editMode = false) {
  modal.classList.add('active');
  if (!editMode) {
    modalTitle.textContent = 'Add New Student';
    form.reset();
    document.getElementById('editStudentId').value = '';
    passwordField.required = true;
    passwordField.placeholder = 'Min 6 characters';
  } else {
    modalTitle.textContent = 'Edit Student';
    passwordField.required = false;
    passwordField.placeholder = 'Leave blank to keep current';
  }
}

function closeModal() {
  modal.classList.remove('active');
  form.reset();
}

document.getElementById('addStudentBtn').addEventListener('click', () => openModal(false));
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);

// Close on overlay click
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// ── Edit Student ───────────────────────────────────────────
function editStudent(id, name, email, studentId, grade) {
  document.getElementById('editStudentId').value = id;
  document.getElementById('studentName').value = name;
  document.getElementById('studentEmail').value = email;
  document.getElementById('studentIdInput').value = studentId;
  document.getElementById('studentGrade').value = grade;
  document.getElementById('studentPassword').value = '';
  openModal(true);
}

// ── Delete Student ─────────────────────────────────────────
async function deleteStudent(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? This will also remove their grades and attendance.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/api/admin/students/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadStudents();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete student.', 'error');
  }
}

// ── Submit Form (Create / Update) ──────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const editId = document.getElementById('editStudentId').value;
  const payload = {
    name: document.getElementById('studentName').value.trim(),
    email: document.getElementById('studentEmail').value.trim(),
    student_id: document.getElementById('studentIdInput').value.trim(),
    grade: document.getElementById('studentGrade').value,
    password: document.getElementById('studentPassword').value
  };

  // Validation
  if (!payload.name || !payload.email || !payload.student_id || !payload.grade) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  if (!editId && !payload.password) {
    showToast('Password is required for new students.', 'error');
    return;
  }

  if (payload.password && payload.password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  // Remove empty password for updates
  if (editId && !payload.password) {
    delete payload.password;
  }

  try {
    const url = editId ? `/api/admin/students/${editId}` : '/api/admin/students';
    const method = editId ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      closeModal();
      loadStudents();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to save student.', 'error');
  }
});

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
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

// ── Sidebar Mobile Toggle ──────────────────────────────────
const sidebar = document.getElementById('sidebar');
document.getElementById('mobileToggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
  document.getElementById('mobileOverlay').classList.toggle('active');
});
document.getElementById('mobileOverlay').addEventListener('click', () => {
  sidebar.classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('active');
});

// ── Logout ─────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

// ── Initialize ─────────────────────────────────────────────
loadStudents();
