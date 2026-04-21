/**
 * Admin Grades JS
 * =================
 * Manage student grades — add/update grades, filter by student.
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

// ── Load Dropdowns ─────────────────────────────────────────
async function loadDropdowns() {
  try {
    // Load students
    const studentsRes = await apiRequest('/api/admin/students');
    const students = await studentsRes.json();

    const studentSelect = document.getElementById('gradeStudent');
    const filterSelect = document.getElementById('filterStudent');

    students.forEach(s => {
      const opt1 = new Option(`${s.name} (${s.student_id})`, s.id);
      const opt2 = new Option(`${s.name} (${s.student_id})`, s.id);
      studentSelect.appendChild(opt1);
      filterSelect.appendChild(opt2);
    });

    // Load subjects
    const subjectsRes = await apiRequest('/api/admin/subjects');
    const subjects = await subjectsRes.json();

    const subjectSelect = document.getElementById('gradeSubject');
    subjects.forEach(s => {
      subjectSelect.appendChild(new Option(`${s.name} (${s.code})`, s.id));
    });
  } catch (err) {
    console.error('Failed to load dropdowns:', err);
  }
}

// ── Load Grades ────────────────────────────────────────────
async function loadGrades(studentId = '') {
  try {
    const url = studentId
      ? `/api/admin/grades?student_id=${studentId}`
      : '/api/admin/grades';
    const res = await apiRequest(url);
    const grades = await res.json();
    renderGrades(grades);
  } catch (err) {
    console.error('Failed to load grades:', err);
  }
}

function renderGrades(grades) {
  const tbody = document.getElementById('gradesTableBody');

  if (grades.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No grades recorded yet.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = grades.map(g => {
    const letterGrade = getLetterGrade(g.score);
    const gradeClass = getGradeClass(g.score);
    return `
      <tr>
        <td><strong>${escapeHtml(g.student_name)}</strong></td>
        <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;">${escapeHtml(g.student_code)}</span></td>
        <td>${escapeHtml(g.student_grade)}</td>
        <td>${escapeHtml(g.subject_name)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar" style="width:80px;">
              <div class="progress-fill ${gradeClass}" style="width:${g.score}%;background:${getGradeColor(g.score)};"></div>
            </div>
            <span>${g.score}/${g.max_score}</span>
          </div>
        </td>
        <td><span class="badge badge-grade ${gradeClass}" style="background:${getGradeColor(g.score)}22;color:${getGradeColor(g.score)};">${letterGrade}</span></td>
        <td>${escapeHtml(g.term)}</td>
      </tr>
    `;
  }).join('');
}

// ── Submit Grade ───────────────────────────────────────────
document.getElementById('gradeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    user_id: document.getElementById('gradeStudent').value,
    subject_id: document.getElementById('gradeSubject').value,
    score: parseFloat(document.getElementById('gradeScore').value),
    term: document.getElementById('gradeTerm').value
  };

  if (!payload.user_id || !payload.subject_id || isNaN(payload.score)) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  try {
    const res = await apiRequest('/api/admin/grades', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      document.getElementById('gradeScore').value = '';
      loadGrades(document.getElementById('filterStudent').value);
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to save grade.', 'error');
  }
});

// ── Filter ─────────────────────────────────────────────────
document.getElementById('filterStudent').addEventListener('change', (e) => {
  loadGrades(e.target.value);
});

// ── Grade Helpers ──────────────────────────────────────────
function getLetterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getGradeClass(score) {
  if (score >= 90) return 'grade-a';
  if (score >= 80) return 'grade-b';
  if (score >= 70) return 'grade-c';
  if (score >= 60) return 'grade-d';
  return 'grade-f';
}

function getGradeColor(score) {
  if (score >= 90) return '#4ade80';
  if (score >= 80) return '#60a5fa';
  if (score >= 70) return '#fbbf24';
  if (score >= 60) return '#fb923c';
  return '#f87171';
}

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
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
loadDropdowns().then(() => loadGrades());
