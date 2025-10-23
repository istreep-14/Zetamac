// dashboard.js - Fixed with event delegation (no inline handlers)

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyjxIIqmqWcPeFZ5G_m9ZGetPVlsDf28kYFN4__6yRPFZQw4a73EZjNsYNq2GSWooPi/exec';

let allSessions = [];
let filteredSessions = [];
let currentMonth = new Date();

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
  
  // Filter listeners
  document.getElementById('mode-filter').addEventListener('change', applyFilters);
  document.getElementById('duration-filter').addEventListener('change', applyFilters);
  
  // Button listeners
  document.getElementById('refresh-btn').addEventListener('click', refreshData);
  document.getElementById('prev-month-btn').addEventListener('click', previousMonth);
  document.getElementById('next-month-btn').addEventListener('click', nextMonth);
  document.getElementById('close-day-modal-btn').addEventListener('click', closeDayModal);
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);
});

// Data Loading
async function loadData() {
  const syncText = document.getElementById('sync-text');
  syncText.textContent = 'Loading from Google Sheets...';
  
  try {
    console.log('Fetching sessions from Google Sheets...');
    console.log('URL:', `${GOOGLE_SHEETS_URL}?action=getSessions`);
    
    const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getSessions`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Response text:', text.substring(0, 200));
    
    const data = JSON.parse(text);
    console.log('Parsed data:', data);
    
    if (data.success && data.sessions) {
      allSessions = data.sessions.map(s => convertSheetSession(s));
      console.log(`✅ Loaded ${allSessions.length} sessions from Google Sheets`);
      syncText.textContent = `✅ Synced (${allSessions.length} sessions)`;
      syncText.style.color = '#00ff88';
      filteredSessions = [...allSessions];
      updateDashboard();
    } else {
      throw new Error('Invalid response from Google Sheets: ' + JSON.stringify(data));
    }
  } catch (error) {
    console.error('❌ Error loading from Google Sheets:', error);
    syncText.textContent = '❌ Error loading data';
    syncText.style.color = '#ff4444';
    
    document.getElementById('stats').innerHTML = `
      <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--danger);">
        <h3 style="color: var(--danger); margin-bottom: 1rem;">⚠️ Unable to load data</h3>
        <p style="margin-bottom: 1rem;">Could not connect to Google Sheets.</p>
        <div style="background: var(--bg-darker); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; font-family: monospace; font-size: 0.85rem; text-align: left;">
          <strong>Error:</strong> ${error.message}<br><br>
          <strong>URL:</strong> ${GOOGLE_SHEETS_URL}
        </div>
        <div style="text-align: left; margin-top: 1rem; font-size: 0.9rem;">
          <strong>Troubleshooting steps:</strong>
          <ol style="margin-top: 0.5rem; margin-left: 1.5rem;">
            <li>Make sure your Google Apps Script is deployed as a Web App</li>
            <li>Set "Execute as: Me" and "Who has access: Anyone"</li>
            <li>Copy the Web App URL and update it in dashboard.js</li>
            <li>Open the URL in a new tab to test: <a href="${GOOGLE_SHEETS_URL}?action=getSessions" target="_blank" style="color: var(--accent);">Test Link</a></li>
          </ol>
        </div>
        <button id="error-retry-btn" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: var(--accent); color: var(--bg-dark); border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 700;">
          🔄 Retry
        </button>
      </div>
    `;
    
    // Add retry button listener
    document.getElementById('error-retry-btn').addEventListener('click', refreshData);
  }
}

function convertSheetSession(sheetData) {
  const duration = sheetData.duration || 120;
  const scorePerSecond = sheetData.score / duration;
  const normalized120 = scorePerSecond * 120;
  
  return {
    id: sheetData.id,
    timestamp: sheetData.timestamp,
    date: sheetData.date,
    time: sheetData.time,
    score: sheetData.score,
    scorePerSecond: scorePerSecond,
    normalized120: normalized120,
    key: sheetData.key,
    mode: sheetData.mode,
    duration: duration,
    fullTimestamp: sheetData.fullTimestamp
  };
}

async function refreshData() {
  console.log('🔄 Refreshing data...');
  await loadData();
  applyFilters();
}

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session?')) {
    return;
  }
  
  try {
    console.log('🗑️ Deleting session:', sessionId);
    const response = await fetch(`${GOOGLE_SHEETS_URL}?action=deleteSession&id=${encodeURIComponent(sessionId)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Session deleted successfully');
      await refreshData();
    } else {
      throw new Error(data.message || 'Failed to delete session');
    }
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    alert('Error deleting session: ' + error.message);
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
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 1.2rem; margin-bottom: 1rem;">No sessions recorded yet</p>
        <p style="font-size: 0.9rem;">Play a game on Zetamac to see your stats here!</p>
      </div>
    `;
    return;
  }

  const scores = filteredSessions.map(s => s.score);
  const normalized = filteredSessions.map(s => s.normalized120 || s.score);
  const recent = filteredSessions[filteredSessions.length - 1];
  const bestScore = Math.max(...scores);
  const bestIndex = scores.indexOf(bestScore);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const avgNorm = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);
  const totalProblems = filteredSessions.reduce((sum, s) => sum + s.score, 0);

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
  
  for (let i = 0; i < firstDay; i++) {
    calendar.innerHTML += '<div class="calendar-day empty"></div>';
  }
  
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
           data-day="${day}" ${hasData ? 'data-has-sessions="true"' : ''}>
        <div class="day-number">${day}</div>
        ${hasData ? `
          <div class="day-games">${sessions.length} game${sessions.length > 1 ? 's' : ''}</div>
          <div class="day-score ${scoreClass}">${avgScore}</div>
        ` : ''}
      </div>
    `;
  }
  
  // Add event delegation for calendar clicks
  calendar.addEventListener('click', handleCalendarClick);
}

function handleCalendarClick(e) {
  const dayElement = e.target.closest('.calendar-day');
  if (dayElement && dayElement.dataset.hasSessions) {
    const day = parseInt(dayElement.dataset.day);
    showDayDetails(day);
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

function showDayDetails(day) {
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
  
  tbody.innerHTML = daySessions.map((session) => {
    return `
      <tr>
        <td>${session.time}</td>
        <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
        <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
        <td><span class="score-display">${session.score}</span></td>
        <td>${(session.normalized120 || session.score).toFixed(1)}</td>
        <td>
          <button class="btn-details" data-session-id="${session.id}">Details</button>
          <button class="btn-delete" data-session-id="${session.id}">×</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event delegation for day modal buttons
  tbody.addEventListener('click', handleDayModalClick);
  
  modal.classList.add('show');
}

function handleDayModalClick(e) {
  if (e.target.classList.contains('btn-details')) {
    showSessionDetails(e.target.dataset.sessionId);
  } else if (e.target.classList.contains('btn-delete')) {
    deleteSession(e.target.dataset.sessionId);
    closeDayModal();
  }
}

function closeDayModal() {
  document.getElementById('day-modal').classList.remove('show');
}

// Leaderboard
function updateLeaderboard() {
  const container = document.getElementById('leaderboard');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div class="loading">No data yet</div>';
    return;
  }
  
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
    
    return `
      <div class="leaderboard-item" data-session-id="${session.id}">
        <div class="leaderboard-rank ${rankClass}">#${rank}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-score">${session.displayScore.toFixed(1)}</div>
          <div class="leaderboard-details">
            ${session.mode} • ${formatDuration(session.duration)} • Raw: ${session.score}
          </div>
        </div>
        <div class="leaderboard-date">${session.date}</div>
      </div>
    `;
  }).join('');
  
  // Add event delegation for leaderboard clicks
  container.addEventListener('click', handleLeaderboardClick);
}

function handleLeaderboardClick(e) {
  const item = e.target.closest('.leaderboard-item');
  if (item && item.dataset.sessionId) {
    showSessionDetails(item.dataset.sessionId);
  }
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
  
  ctx.strokeStyle = '#2a3544';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  ctx.strokeStyle = '#1e2530';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No sessions yet - play a game to see it here!</td></tr>';
    return;
  }

  const recentSessions = filteredSessions.slice(-20).reverse();
  
  tbody.innerHTML = recentSessions.map((session) => {
    return `
      <tr>
        <td>${session.date} ${session.time}</td>
        <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
        <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
        <td><span class="score-display">${session.score}</span></td>
        <td>${(session.normalized120 || session.score).toFixed(1)}</td>
        <td>
          <button class="btn-details" data-session-id="${session.id}">Details</button>
          <button class="btn-delete" data-session-id="${session.id}">×</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event delegation for table buttons
  tbody.addEventListener('click', handleTableClick);
}

function handleTableClick(e) {
  if (e.target.classList.contains('btn-details')) {
    showSessionDetails(e.target.dataset.sessionId);
  } else if (e.target.classList.contains('btn-delete')) {
    deleteSession(e.target.dataset.sessionId);
  }
}

// Session Details Modal
async function showSessionDetails(sessionId) {
  const session = allSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  const modal = document.getElementById('details-modal');
  const title = document.getElementById('modal-title');
  const stats = document.getElementById('modal-stats');
  const problemsBody = document.getElementById('modal-problems');
  
  title.textContent = `Session Details - ${session.date} ${session.time}`;
  
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
      <div class="stat-label">Mode</div>
      <div class="stat-value" style="font-size: 1.5rem;">${session.mode}</div>
    </div>
  `;
  
  problemsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading problems...</td></tr>';
  
  try {
    const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getProblems&id=${encodeURIComponent(sessionId)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.problems && data.problems.length > 0) {
      const problems = data.problems;
      
      problemsBody.innerHTML = problems.map((problem) => {
        const operatorDisplay = opIcons[problem.operationType] || '?';
        const timeDisplay = problem.latency > 0 ? (problem.latency / 1000).toFixed(2) : '0.00';
        
        return `
          <tr>
            <td>${problem.problemNum}</td>
            <td>${problem.question}</td>
            <td style="text-align: center; font-size: 1.25rem; font-weight: bold;">${operatorDisplay}</td>
            <td>${problem.c}</td>
            <td>${timeDisplay}</td>
            <td>-</td>
          </tr>
        `;
      }).join('');
    } else {
      problemsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No problem data available for this session</td></tr>';
    }
  } catch (error) {
    console.error('Error loading problems:', error);
    problemsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading problems: ${error.message}</td></tr>`;
  }
  
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('details-modal').classList.remove('show');
}

// Utility Functions
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

console.log('✅ Dashboard script loaded');
