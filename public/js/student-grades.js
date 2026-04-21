/**
 * Student Grades JS
 * ===================
 * View own grades with stats summary.
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

// ── Load Grades ────────────────────────────────────────────
async function loadGrades() {
  try {
    const grades = await apiGet('/api/student/grades');

    // Compute stats
    if (grades.length > 0) {
      const scores = grades.map(g => g.score);
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const highest = Math.max(...scores);
      const subjectCount = new Set(grades.map(g => g.subject_id)).size;

      document.getElementById('avgScore').textContent = avg;
      document.getElementById('highestScore').textContent = highest;
      document.getElementById('totalSubjects').textContent = subjectCount;
    } else {
      document.getElementById('avgScore').textContent = '—';
      document.getElementById('highestScore').textContent = '—';
      document.getElementById('totalSubjects').textContent = '0';
    }

    renderGrades(grades);
  } catch (err) {
    console.error('Failed to load grades:', err);
  }
}

function renderGrades(grades) {
  const tbody = document.getElementById('gradesTableBody');

  if (grades.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No grades available yet.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = grades.map(g => {
    const letter = getLetterGrade(g.score);
    const color = getGradeColor(g.score);
    return `
      <tr>
        <td><strong>${escapeHtml(g.subject_name)}</strong></td>
        <td>${escapeHtml(g.subject_code)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar" style="width:100px;">
              <div class="progress-fill" style="width:${g.score}%;background:${color};"></div>
            </div>
            <span style="font-weight:600;">${g.score}/${g.max_score}</span>
          </div>
        </td>
        <td><span class="badge badge-grade" style="background:${color}22;color:${color};font-size:0.85rem;">${letter}</span></td>
        <td>${escapeHtml(g.term)}</td>
      </tr>
    `;
  }).join('');
}

// ── Grade Helpers ──────────────────────────────────────────
function getLetterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
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
loadGrades();
