// dashboard_pro.js - Enhanced with Google Sheets sync

// Configuration
const GOOGLE_SHEETS_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE'; // Replace with your deployed script URL

let allSessions = [];
let filteredSessions = [];
let currentMonth = new Date();
let chartInstance = null;

const opColors = {
  addition: '#82b1ff',
  subtraction: '#ffaa00',
  multiplication: '#69f0ae',
  division: '#b388ff'
};

const opIcons = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷'
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dashboard loading...');
  await loadData();
  updateDashboard();
  
  document.getElementById('mode-filter').addEventListener('change', applyFilters);
  document.getElementById('duration-filter').addEventListener('change', applyFilters);
});

// Data Loading
async function loadData() {
  const syncText = document.getElementById('sync-text');
  syncText.textContent = 'Loading...';
  
  try {
    // Try to load from Google Sheets first
    if (GOOGLE_SHEETS_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
      const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getSessions`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.sessions) {
          allSessions = data.sessions.map(s => convertSheetSession(s));
          console.log(`Loaded ${allSessions.length} sessions from Google Sheets`);
          syncText.textContent = 'Synced with Google Sheets';
          filteredSessions = [...allSessions];
          return;
        }
      }
    }
  } catch (error) {
    console.log('Could not load from Google Sheets, using local storage:', error);
  }
  
  // Fallback to local storage
  chrome.storage.local.get(['gameSessions'], (result) => {
    allSessions = result.gameSessions || [];
    console.log(`Loaded ${allSessions.length} sessions from local storage`);
    syncText.textContent = 'Using Local Data';
    filteredSessions = [...allSessions];
    updateDashboard();
  });
}

function convertSheetSession(sheetData) {
  // Convert Google Sheets format to our format
  return {
    timestamp: sheetData.timestamp,
    score: sheetData.score,
    scorePerSecond: sheetData.scorePerSecond,
    normalized120: sheetData.normalized120,
    key: sheetData.key,
    mode: sheetData.mode,
    duration: sheetData.duration,
    problemsCount: sheetData.problemsCount,
    avgLatency: sheetData.avgLatency,
    operations: {
      addition: sheetData.addition || 0,
      subtraction: sheetData.subtraction || 0,
      multiplication: sheetData.multiplication || 0,
      division: sheetData.division || 0
    }
  };
}

async function refreshData() {
  await loadData();
  applyFilters();
}

async function deleteSession(timestamp) {
  if (!confirm('Are you sure you want to delete this session?')) {
    return;
  }
  
  try {
    // Delete from Google Sheets if configured
    if (GOOGLE_SHEETS_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
      const response = await fetch(`${GOOGLE_SHEETS_URL}?action=deleteSession&timestamp=${encodeURIComponent(timestamp)}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        console.log('Session deleted from Google Sheets');
      }
    }
    
    // Also delete from local storage
    chrome.storage.local.get(['gameSessions'], (result) => {
      const sessions = result.gameSessions || [];
      const updated = sessions.filter(s => s.timestamp !== timestamp);
      chrome.storage.local.set({ gameSessions: updated });
    });
    
    await refreshData();
  } catch (error) {
    console.error('Error deleting session:', error);
    alert('Error deleting session');
  }
}

// Filters
function applyFilters() {
  const mode = document.getElementById('mode-filter').value;
  const duration = document.getElementById('duration-filter').value;

  filteredSessions = allSessions.filter(session => {
    const modeMatch = mode === 'all' || session.mode === mode;
    const durationMatch = duration === 'all' || session.duration === parseInt(duration);
    return modeMatch && durationMatch;
  });

  console.log(`Filtered to ${filteredSessions.length} sessions`);
  updateDashboard();
}

// Dashboard Updates
function updateDashboard() {
  updateStats();
  updateCalendar();
  updateLeaderboard();
  updateChart();
  updateSessionsTable();
}

function updateStats() {
  const container = document.getElementById('stats');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div class="loading">No sessions recorded yet</div>';
    return;
  }

  const scores = filteredSessions.map(s => s.score);
  const normalized = filteredSessions.map(s => s.normalized120 || s.score);
  const recent = filteredSessions[filteredSessions.length - 1];
  const bestScore = Math.max(...scores);
  const bestIndex = scores.indexOf(bestScore);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const avgNorm = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);
  
  // Calculate total problems
  const totalProblems = filteredSessions.reduce((sum, s) => {
    if (s.problemsCount) return sum + s.problemsCount;
    if (s.problems) return sum + s.problems.length;
    return sum + s.score;
  }, 0);

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Sessions</div>
      <div class="stat-value">${filteredSessions.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Best Score</div>
      <div class="stat-value">${bestScore}</div>
      <div class="stat-subvalue">${normalized[bestIndex].toFixed(1)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average</div>
      <div class="stat-value">${avgScore}</div>
      <div class="stat-subvalue">${avgNorm}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Recent</div>
      <div class="stat-value">${recent.score}</div>
      <div class="stat-subvalue">${(recent.normalized120 || recent.score).toFixed(1)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Problems</div>
      <div class="stat-value">${totalProblems}</div>
    </div>
  `;
}

// Calendar
function updateCalendar() {
  const calendar = document.getElementById('calendar');
  const monthLabel = document.getElementById('current-month');
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  monthLabel.textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Group sessions by date
  const sessionsByDate = {};
  filteredSessions.forEach(session => {
    const date = new Date(session.timestamp);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const dateKey = date.getDate();
      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = [];
      }
      sessionsByDate[dateKey].push(session);
    }
  });
  
  calendar.innerHTML = '';
  
  // Empty days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendar.innerHTML += '<div class="calendar-day empty"></div>';
  }
  
  // Days of month
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const sessions = sessionsByDate[day] || [];
    const avgScore = sessions.length > 0
      ? (sessions.reduce((sum, s) => sum + (s.normalized120 || s.score), 0) / sessions.length).toFixed(1)
      : 0;
    
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const hasData = sessions.length > 0;
    
    let scoreClass = '';
    if (avgScore >= 100) scoreClass = 'excellent';
    else if (avgScore >= 75) scoreClass = 'good';
    else if (avgScore >= 50) scoreClass = 'average';
    else if (avgScore > 0) scoreClass = 'poor';
    
    calendar.innerHTML += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}" 
           onclick="${hasData ? `showDayDetails(${day})` : ''}">
        <div class="day-number">${day}</div>
        ${hasData ? `
          <div class="day-games">${sessions.length} game${sessions.length > 1 ? 's' : ''}</div>
          <div class="day-score ${scoreClass}">${avgScore}</div>
        ` : ''}
      </div>
    `;
  }
}

function previousMonth() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
  updateCalendar();
}

function nextMonth() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
  updateCalendar();
}

window.showDayDetails = function(day) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const daySessions = filteredSessions.filter(session => {
    const date = new Date(session.timestamp);
    return date.getDate() === day && date.getMonth() === month && date.getFullYear() === year;
  });
  
  const modal = document.getElementById('day-modal');
  const title = document.getElementById('day-modal-title');
  const tbody = document.getElementById('day-sessions-body');
  
  const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  title.textContent = `Sessions on ${dateStr}`;
  
  tbody.innerHTML = daySessions.map((session, index) => {
    const time = new Date(session.timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    return `
      <tr>
        <td>${time}</td>
        <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
        <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
        <td><span class="score-display">${session.score}</span></td>
        <td>${(session.normalized120 || session.score).toFixed(1)}</td>
        <td>
          <button class="btn-details" onclick="showSessionDetails('${session.timestamp}')">Details</button>
          <button class="btn-delete" onclick="deleteSession('${session.timestamp}')">×</button>
        </td>
      </tr>
    `;
  }).join('');
  
  modal.classList.add('show');
};

window.closeDayModal = function() {
  document.getElementById('day-modal').classList.remove('show');
};

// Leaderboard
function updateLeaderboard() {
  const container = document.getElementById('leaderboard');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div class="loading">No data yet</div>';
    return;
  }
  
  // Get top 10 normalized scores
  const topScores = [...filteredSessions]
    .map(s => ({ ...s, displayScore: s.normalized120 || s.score }))
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, 10);
  
  container.innerHTML = topScores.map((session, index) => {
    const rank = index + 1;
    let rankClass = '';
    if (rank === 1) rankClass = 'gold';
    else if (rank === 2) rankClass = 'silver';
    else if (rank === 3) rankClass = 'bronze';
    
    const date = new Date(session.timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return `
      <div class="leaderboard-item" onclick="showSessionDetails('${session.timestamp}')">
        <div class="leaderboard-rank ${rankClass}">#${rank}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-score">${session.displayScore.toFixed(1)}</div>
          <div class="leaderboard-details">
            ${session.mode} • ${formatDuration(session.duration)} • Raw: ${session.score}
          </div>
        </div>
        <div class="leaderboard-date">${date}</div>
      </div>
    `;
  }).join('');
}

// Chart
function updateChart() {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth;
  canvas.height = 280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (filteredSessions.length === 0) {
    ctx.fillStyle = '#5f6368';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const data = filteredSessions.map(s => s.normalized120 || s.score);
  const maxValue = Math.max(...data);
  const padding = 50;
  
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Draw axes
  ctx.strokeStyle = '#2a3544';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  // Draw grid
  ctx.strokeStyle = '#1e2530';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = '#9aa0a6';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= 5; i++) {
    const value = maxValue - (maxValue / 5) * i;
    const y = padding + (chartHeight / 5) * i;
    ctx.fillText(value.toFixed(0), padding - 10, y + 5);
  }

  if (data.length > 1) {
    const stepX = chartWidth / (data.length - 1);
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.05)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - (value / maxValue) * chartHeight;
      if (index === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.lineTo(padding + stepX * (data.length - 1), canvas.height - padding);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - (value / maxValue) * chartHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();

    // Points
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - (value / maxValue) * chartHeight;
      
      ctx.fillStyle = '#00d9ff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

// Sessions Table
function updateSessionsTable() {
  const tbody = document.getElementById('sessions-body');
  
  if (filteredSessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">No sessions yet</td></tr>';
    return;
  }

  const recentSessions = filteredSessions.slice(-20).reverse();
  
  tbody.innerHTML = recentSessions.map((session) => {
    const date = formatDateTime(session.timestamp);
    
    return `
      <tr>
        <td>${date}</td>
        <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
        <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
        <td><span class="score-display">${session.score}</span></td>
        <td>${(session.normalized120 || session.score).toFixed(1)}</td>
        <td>
          <button class="btn-details" onclick="showSessionDetails('${session.timestamp}')">Details</button>
          <button class="btn-delete" onclick="deleteSession('${session.timestamp}')">×</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Session Details Modal
window.showSessionDetails = async function(timestamp) {
  const session = allSessions.find(s => s.timestamp === timestamp);
  if (!session) return;
  
  const modal = document.getElementById('details-modal');
  const title = document.getElementById('modal-title');
  const stats = document.getElementById('modal-stats');
  const problemsBody = document.getElementById('modal-problems');
  
  title.textContent = `Session Details - ${formatDateTime(session.timestamp)}`;
  
  // Stats
  const problemsCount = session.problemsCount || (session.problems ? session.problems.length : session.score);
  const avgLatency = session.avgLatency || 0;
  const totalLatency = session.problems 
    ? (session.problems.reduce((sum, p) => sum + (p.latency || 0), 0) / 1000).toFixed(2)
    : 0;
  
  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Score</div>
      <div class="stat-value">${session.score}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Normalized</div>
      <div class="stat-value">${(session.normalized120 || session.score).toFixed(1)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value">${formatDuration(session.duration)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Problems</div>
      <div class="stat-value">${problemsCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Time</div>
      <div class="stat-value">${avgLatency}s</div>
    </div>
  `;
  
  // Try to load problems from Google Sheets if not in session
  let problems = session.problems;
  
  if (!problems && GOOGLE_SHEETS_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getProblems&timestamp=${encodeURIComponent(timestamp)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          problems = data.problems;
        }
      }
    } catch (error) {
      console.error('Error loading problems:', error);
    }
  }
  
  if (problems && problems.length > 0) {
    problemsBody.innerHTML = problems.map((problem, idx) => {
      const operatorDisplay = problem.operator || opIcons[problem.operationType] || '?';
      const timeDisplay = problem.latency > 0 ? (problem.latency / 1000).toFixed(2) : '0.00';
      const gameTimeDisplay = problem.gameTime !== undefined ? problem.gameTime.toFixed(2) : 
                            (problem.timestamp !== undefined ? problem.timestamp.toFixed(2) : '-');
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${problem.question || `${problem.a} ${operatorDisplay} ${problem.b}`}</td>
          <td style="text-align: center; font-size: 1.25rem; font-weight: bold;">${operatorDisplay}</td>
          <td>${problem.answer || problem.c || '-'}</td>
          <td>${timeDisplay}</td>
          <td>${gameTimeDisplay}</td>
        </tr>
      `;
    }).join('');
  } else {
    problemsBody.innerHTML = '<tr><td colspan="6" class="loading">No problem data available</td></tr>';
  }
  
  modal.classList.add('show');
};

window.closeModal = function() {
  document.getElementById('details-modal').classList.remove('show');
};

// Utility Functions
function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

// Close modals on outside click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});

// Window resize
window.addEventListener('resize', () => {
  if (filteredSessions.length > 0) {
    updateChart();
  }
});

console.log('Dashboard Pro script loaded');
