// dashboard.js - Enhanced with IndexedDB caching, better formatting, and improved UX

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyjxIIqmqWcPeFZ5G_m9ZGetPVlsDf28kYFN4__6yRPFZQw4a73EZjNsYNq2GSWooPi/exec';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DB_NAME = 'ZetamacAnalyticsDB';
const DB_VERSION = 1;

let allSessions = [];
let filteredSessions = [];
let allProblems = {}; // Cache for problems
let currentMonth = new Date();
let db = null;
let currentSessionId = null; // Track which session is open in modal

const opIcons = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷'
};

const opClasses = {
  addition: 'op-add',
  subtraction: 'op-sub',
  multiplication: 'op-mul',
  division: 'op-div'
};

// Chart state
let chartData = {
  canvas: null,
  ctx: null,
  dataPoints: [],
  hoveredIndex: null
};

// IndexedDB Setup
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('problems')) {
        db.createObjectStore('problems', { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
  });
}

async function getCachedData() {
  if (!db) return null;
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['sessions', 'problems', 'metadata'], 'readonly');
      const sessionsStore = transaction.objectStore('sessions');
      const problemsStore = transaction.objectStore('problems');
      const metadataStore = transaction.objectStore('metadata');
      
      const metadataRequest = metadataStore.get('lastFetch');
      metadataRequest.onsuccess = () => {
        const metadata = metadataRequest.result;
        if (!metadata || Date.now() - metadata.timestamp > CACHE_DURATION) {
          resolve(null);
          return;
        }
        
        const sessionsRequest = sessionsStore.getAll();
        const problemsRequest = problemsStore.getAll();
        
        Promise.all([
          new Promise(r => { sessionsRequest.onsuccess = () => r(sessionsRequest.result); }),
          new Promise(r => { problemsRequest.onsuccess = () => r(problemsRequest.result); })
        ]).then(([sessions, problemSets]) => {
          const problemsMap = {};
          problemSets.forEach(ps => {
            problemsMap[ps.sessionId] = ps.problems;
          });
          resolve({ sessions, problems: problemsMap });
        });
      };
      metadataRequest.onerror = () => resolve(null);
    } catch (error) {
      console.error('Error getting cached data:', error);
      resolve(null);
    }
  });
}

async function saveCachedData(sessions, problems) {
  if (!db) return;
  
  try {
    const transaction = db.transaction(['sessions', 'problems', 'metadata'], 'readwrite');
    const sessionsStore = transaction.objectStore('sessions');
    const problemsStore = transaction.objectStore('problems');
    const metadataStore = transaction.objectStore('metadata');
    
    // Clear old data
    sessionsStore.clear();
    problemsStore.clear();
    
    // Save sessions
    sessions.forEach(session => sessionsStore.put(session));
    
    // Save problems
    Object.entries(problems).forEach(([sessionId, problemList]) => {
      problemsStore.put({ sessionId, problems: problemList });
    });
    
    // Save metadata
    metadataStore.put({ key: 'lastFetch', timestamp: Date.now() });
    
    console.log('✅ Data cached successfully');
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dashboard loading...');
  
  // Initialize IndexedDB
  try {
    await initDB();
    console.log('✅ IndexedDB initialized');
  } catch (error) {
    console.error('IndexedDB initialization failed:', error);
  }
  
  await loadData();
  
  // Filter listeners
  document.getElementById('mode-filter').addEventListener('change', applyFilters);
  document.getElementById('duration-filter').addEventListener('change', applyFilters);
  document.getElementById('chart-range').addEventListener('change', updateChart);
  
  // Button listeners
  document.getElementById('refresh-btn').addEventListener('click', refreshData);
  document.getElementById('prev-month-btn').addEventListener('click', previousMonth);
  document.getElementById('next-month-btn').addEventListener('click', nextMonth);
  document.getElementById('close-day-modal-btn').addEventListener('click', closeDayModal);
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);
  document.getElementById('delete-session-btn').addEventListener('click', () => {
    if (currentSessionId) {
      deleteSession(currentSessionId);
    }
  });
  
  // Initialize chart
  initializeChart();
  
  // Periodic refresh every 5 minutes
  setInterval(async () => {
    console.log('⏰ Periodic refresh...');
    await loadData(true);
  }, CACHE_DURATION);
});

// Format date nicely
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Data Loading with caching
async function loadData(skipCache = false) {
  const syncText = document.getElementById('sync-text');
  
  // Try to load from cache first
  if (!skipCache) {
    const cached = await getCachedData();
    if (cached) {
      console.log('📦 Loading from cache...');
      syncText.textContent = '📦 Loading from cache...';
      allSessions = cached.sessions.map(s => convertSheetSession(s));
      allProblems = cached.problems;
      syncText.textContent = `✅ Cached (${allSessions.length} sessions)`;
      syncText.style.color = '#00ff88';
      filteredSessions = [...allSessions];
      updateDashboard();
      
      // Fetch fresh data in background
      fetchFreshData();
      return;
    }
  }
  
  // Fetch fresh data
  await fetchFreshData();
}

async function fetchFreshData() {
  const syncText = document.getElementById('sync-text');
  syncText.textContent = 'Loading from Google Sheets...';
  
  try {
    console.log('Fetching fresh data from Google Sheets...');
    const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getAllData`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received data:', data);
    
    if (data.success && data.sessions) {
      allSessions = data.sessions.map(s => convertSheetSession(s));
      allProblems = data.problemsBySession || {};
      
      // Save to cache
      await saveCachedData(data.sessions, allProblems);
      
      console.log(`✅ Loaded ${allSessions.length} sessions and ${Object.keys(allProblems).length} problem sets`);
      syncText.textContent = `✅ Synced (${allSessions.length} sessions)`;
      syncText.style.color = '#00ff88';
      filteredSessions = [...allSessions];
      updateDashboard();
    } else {
      throw new Error('Invalid response from Google Sheets');
    }
  } catch (error) {
    console.error('❌ Error loading from Google Sheets:', error);
    syncText.textContent = '❌ Error loading data';
    syncText.style.color = '#ff4444';
    showError(error);
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
  await loadData(true);
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
      // Remove from cache
      delete allProblems[sessionId];
      closeModal();
      await refreshData();
    } else {
      throw new Error(data.message || 'Failed to delete session');
    }
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    alert('Error deleting session: ' + error.message);
  }
}

function showError(error) {
  document.getElementById('stats').innerHTML = `
    <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--danger);">
      <h3 style="color: var(--danger); margin-bottom: 1rem;">⚠️ Unable to load data</h3>
      <p style="margin-bottom: 1rem;">Could not connect to Google Sheets.</p>
      <div style="background: var(--bg-darker); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; font-family: monospace; font-size: 0.85rem; text-align: left;">
        <strong>Error:</strong> ${error.message}
      </div>
      <button id="error-retry-btn" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: var(--accent); color: var(--bg-dark); border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 700;">
        🔄 Retry
      </button>
    </div>
  `;
  document.getElementById('error-retry-btn').addEventListener('click', refreshData);
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
  const normalized = filteredSessions.map(s => s.normalized120);
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
      <div class="stat-subvalue">${recent.normalized120.toFixed(1)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Problems</div>
      <div class="stat-value">${totalProblems}</div>
    </div>
  `;
}

// Calendar Functions
function updateCalendar() {
  const calendar = document.getElementById('calendar');
  const monthLabel = document.getElementById('current-month');
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  monthLabel.textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Get sessions by date for this month
  const sessionsByDate = {};
  filteredSessions.forEach(session => {
    const sessionDate = new Date(session.timestamp);
    if (sessionDate.getMonth() === month && sessionDate.getFullYear() === year) {
      const day = sessionDate.getDate();
      if (!sessionsByDate[day]) {
        sessionsByDate[day] = [];
      }
      sessionsByDate[day].push(session);
    }
  });
  
  calendar.innerHTML = '';
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    calendar.appendChild(emptyDay);
  }
  
  // Days of month
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    if (isToday) {
      dayDiv.classList.add('today');
    }
    
    const sessions = sessionsByDate[day] || [];
    if (sessions.length > 0) {
      dayDiv.classList.add('has-data');
      
      const avgScore = sessions.reduce((sum, s) => sum + s.normalized120, 0) / sessions.length;
      let scoreClass = 'poor';
      if (avgScore >= 100) scoreClass = 'excellent';
      else if (avgScore >= 80) scoreClass = 'good';
      else if (avgScore >= 60) scoreClass = 'average';
      
      dayDiv.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="day-games">${sessions.length} game${sessions.length > 1 ? 's' : ''}</div>
        <div class="day-score ${scoreClass}">${avgScore.toFixed(0)}</div>
      `;
      
      dayDiv.addEventListener('click', () => showDayDetails(year, month, day));
    } else {
      dayDiv.innerHTML = `<div class="day-number">${day}</div>`;
    }
    
    calendar.appendChild(dayDiv);
  }
}

function previousMonth() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  updateCalendar();
}

function nextMonth() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  updateCalendar();
}

function showDayDetails(year, month, day) {
  const sessions = filteredSessions.filter(session => {
    const sessionDate = new Date(session.timestamp);
    return sessionDate.getDate() === day && 
           sessionDate.getMonth() === month && 
           sessionDate.getFullYear() === year;
  });
  
  if (sessions.length === 0) return;
  
  const modal = document.getElementById('day-modal');
  const title = document.getElementById('day-modal-title');
  const tbody = document.getElementById('day-sessions-body');
  
  const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  title.textContent = dateStr;
  
  tbody.innerHTML = sessions.map(session => `
    <tr style="cursor: pointer;" onclick="showSessionDetails('${session.id}'); closeDayModal();">
      <td>${formatTimeOnly(session.timestamp)}</td>
      <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
      <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
      <td><span class="score-display">${session.score}</span></td>
      <td><span class="normalized-display">${session.normalized120.toFixed(1)}</span></td>
    </tr>
  `).join('');
  
  modal.classList.add('show');
}

function closeDayModal() {
  document.getElementById('day-modal').classList.remove('show');
}

// Leaderboard
function updateLeaderboard() {
  const container = document.getElementById('leaderboard');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No sessions yet</div>';
    return;
  }
  
  const topSessions = [...filteredSessions]
    .sort((a, b) => b.normalized120 - a.normalized120)
    .slice(0, 10);
  
  container.innerHTML = topSessions.map((session, index) => {
    const rank = index + 1;
    let rankClass = '';
    if (rank === 1) rankClass = 'gold';
    else if (rank === 2) rankClass = 'silver';
    else if (rank === 3) rankClass = 'bronze';
    
    return `
      <div class="leaderboard-item" onclick="showSessionDetails('${session.id}')">
        <div class="leaderboard-rank ${rankClass}">#${rank}</div>
        <div class="leaderboard-details">
          <div class="leaderboard-score">${session.normalized120.toFixed(1)}</div>
          <div class="leaderboard-meta">${session.mode} • ${formatDuration(session.duration)} • Raw: ${session.score}</div>
          <div class="leaderboard-session-id">Sep ${index + 1}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Chart Functions
function initializeChart() {
  const canvas = document.getElementById('chart');
  chartData.canvas = canvas;
  chartData.ctx = canvas.getContext('2d');
  
  // Setup canvas size
  function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    updateChart();
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Mouse events
  canvas.addEventListener('mousemove', handleChartHover);
  canvas.addEventListener('mouseleave', handleChartLeave);
}

function updateChart() {
  if (!chartData.canvas || !chartData.ctx) return;
  
  const canvas = chartData.canvas;
  const ctx = chartData.ctx;
  const rangeSelect = document.getElementById('chart-range');
  const range = rangeSelect.value;
  
  let displaySessions = [...filteredSessions];
  if (range !== 'all') {
    const numGames = parseInt(range);
    displaySessions = displaySessions.slice(-numGames);
  }
  
  chartData.dataPoints = [];
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (displaySessions.length === 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const data = displaySessions.map(s => s.normalized120);
  const padding = 60;
  const chartWidth = canvas.width - (padding * 2);
  const chartHeight = canvas.height - (padding * 2);
  
  const maxValue = Math.max(...data, 100);
  const minValue = Math.max(0, Math.min(...data) - 10);
  const valueRange = maxValue - minValue;
  
  // Grid lines
  ctx.strokeStyle = '#1e2530';
  ctx.lineWidth = 1;
  ctx.font = '11px Inter';
  ctx.fillStyle = '#5f6368';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= 5; i++) {
    const value = minValue + (valueRange / 5) * i;
    const y = canvas.height - padding - (chartHeight / 5) * i;
    
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
    
    ctx.fillText(value.toFixed(0), padding - 10, y + 5);
  }
  
  // X-axis labels (dates)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5f6368';
  ctx.font = '10px Inter';
  
  const labelStep = Math.max(1, Math.floor(displaySessions.length / 8));
  displaySessions.forEach((session, index) => {
    if (index % labelStep === 0 || index === displaySessions.length - 1) {
      const x = padding + (data.length > 1 ? (chartWidth / (data.length - 1)) * index : chartWidth / 2);
      const dateLabel = formatDate(session.timestamp);
      ctx.fillText(dateLabel, x, canvas.height - padding + 20);
    }
  });
  
  if (data.length > 0) {
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.05)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    
    data.forEach((value, index) => {
      const x = padding + (data.length > 1 ? stepX * index : chartWidth / 2);
      const y = canvas.height - padding - ((value - minValue) / valueRange) * chartHeight;
      ctx.lineTo(x, y);
      
      // Store point data for hover
      chartData.dataPoints.push({
        x: x,
        y: y,
        value: value,
        session: displaySessions[index]
      });
    });
    
    ctx.lineTo(padding + (data.length > 1 ? stepX * (data.length - 1) : chartWidth / 2), canvas.height - padding);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    data.forEach((value, index) => {
      const x = padding + (data.length > 1 ? stepX * index : chartWidth / 2);
      const y = canvas.height - padding - ((value - minValue) / valueRange) * chartHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();

    // Points
    data.forEach((value, index) => {
      const x = padding + (data.length > 1 ? stepX * index : chartWidth / 2);
      const y = canvas.height - padding - ((value - minValue) / valueRange) * chartHeight;
      
      const isHovered = chartData.hoveredIndex === index;
      
      ctx.fillStyle = isHovered ? '#b388ff' : '#00d9ff';
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 7 : 5, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Average line
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const avgY = canvas.height - padding - ((avg - minValue) / valueRange) * chartHeight;
    
    ctx.strokeStyle = '#b388ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, avgY);
    ctx.lineTo(canvas.width - padding, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Average label
    ctx.fillStyle = '#b388ff';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`Avg: ${avg.toFixed(1)}`, padding + 5, avgY - 5);
  }
}

function handleChartHover(e) {
  if (!chartData.canvas) return;
  
  const rect = chartData.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  let closestIndex = -1;
  let closestDist = Infinity;
  
  chartData.dataPoints.forEach((point, index) => {
    const dist = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
    if (dist < 15 && dist < closestDist) {
      closestDist = dist;
      closestIndex = index;
    }
  });
  
  if (closestIndex !== chartData.hoveredIndex) {
    chartData.hoveredIndex = closestIndex;
    updateChart();
    
    if (closestIndex >= 0) {
      const point = chartData.dataPoints[closestIndex];
      const tooltip = document.getElementById('chart-tooltip');
      const tooltipDate = document.getElementById('tooltip-date');
      const tooltipScore = document.getElementById('tooltip-score');
      
      tooltipDate.textContent = formatDate(point.session.timestamp) + ' ' + formatTimeOnly(point.session.timestamp);
      tooltipScore.textContent = `Score: ${point.value.toFixed(1)} (${point.session.score} raw)`;
      
      tooltip.style.left = (point.x + rect.left) + 'px';
      tooltip.style.top = (point.y + rect.top - 60) + 'px';
      tooltip.classList.add('show');
    }
  }
}

function handleChartLeave() {
  if (chartData.hoveredIndex !== null) {
    chartData.hoveredIndex = null;
    updateChart();
    document.getElementById('chart-tooltip').classList.remove('show');
  }
}

// Sessions Table
function updateSessionsTable() {
  const tbody = document.getElementById('sessions-body');
  
  if (filteredSessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No sessions yet</td></tr>';
    return;
  }

  const recentSessions = filteredSessions.slice(-20).reverse();
  
  tbody.innerHTML = recentSessions.map((session) => {
    return `
      <tr onclick="showSessionDetails('${session.id}')" style="cursor: pointer;">
        <td>${formatDate(session.timestamp)}</td>
        <td>${formatTimeOnly(session.timestamp)}</td>
        <td><span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span></td>
        <td><span class="badge badge-duration">${formatDuration(session.duration)}</span></td>
        <td><span class="score-display">${session.score}</span></td>
        <td><span class="normalized-display">${session.normalized120.toFixed(1)}</span></td>
      </tr>
    `;
  }).join('');
}

// Session Details Modal - now instant with cached data
function showSessionDetails(sessionId) {
  currentSessionId = sessionId;
  const session = allSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  const modal = document.getElementById('details-modal');
  const title = document.getElementById('modal-title');
  const stats = document.getElementById('modal-stats');
  const problemsBody = document.getElementById('modal-problems');
  
  title.textContent = `Session Details - ${formatDate(session.timestamp)} ${formatTimeOnly(session.timestamp)}`;
  
  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Score</div>
      <div class="stat-value">${session.score}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Normalized</div>
      <div class="stat-value">${session.normalized120.toFixed(1)}</div>
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
  
  // Use cached problems data
  const problems = allProblems[sessionId] || [];
  
  if (problems.length > 0) {
    problemsBody.innerHTML = problems.map((problem) => {
      const operatorDisplay = opIcons[problem.operationType] || '?';
      const operatorClass = opClasses[problem.operationType] || '';
      const timeDisplay = problem.latency > 0 ? (problem.latency / 1000).toFixed(2) : '0.00';
      
      return `
        <tr>
          <td>${problem.problemNum}</td>
          <td>
            <div class="problem-display">
              <span class="problem-number">${problem.a}</span>
              <span class="problem-operator ${operatorClass}">${operatorDisplay}</span>
              <span class="problem-number">${problem.b}</span>
              <span class="problem-equals">=</span>
              <span class="problem-number">${problem.c}</span>
            </div>
          </td>
          <td>${timeDisplay}</td>
        </tr>
      `;
    }).join('');
  } else {
    problemsBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No problem data available</td></tr>';
  }
  
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('details-modal').classList.remove('show');
  currentSessionId = null;
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
    currentSessionId = null;
  }
});

console.log('✅ Dashboard script loaded');
