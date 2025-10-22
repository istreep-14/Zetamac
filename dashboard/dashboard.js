// dashboard/dashboard.js - Fixed version

let gameSessions = [];
let filteredSessions = [];
let currentFilter = { mode: 'all', duration: 'all' };

function loadData() {
  chrome.storage.local.get(['gameSessions'], (result) => {
    gameSessions = result.gameSessions || [];
    console.log('Loaded sessions:', gameSessions);
    applyFilters();
  });
}

function applyFilters() {
  filteredSessions = gameSessions.filter(session => {
    const modeMatch = currentFilter.mode === 'all' || session.mode === currentFilter.mode;
    const durationMatch = currentFilter.duration === 'all' || session.duration === parseInt(currentFilter.duration);
    return modeMatch && durationMatch;
  });
  
  console.log('Filtered sessions:', filteredSessions);
  updateDashboard();
}

function updateDashboard() {
  if (filteredSessions.length === 0) {
    document.getElementById('sessions-body').innerHTML = 
      '<tr><td colspan="5" class="no-data">No sessions found. Start practicing on Zetamac!</td></tr>';
    
    document.getElementById('total-sessions').textContent = '0';
    document.getElementById('best-score').textContent = '-';
    document.getElementById('best-date').textContent = '';
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('recent-score').textContent = '-';
    document.getElementById('recent-date').textContent = '';
    document.getElementById('total-problems').textContent = '0';
    document.getElementById('avg-latency').textContent = '-';
    
    return;
  }

  const scores = filteredSessions.map(s => s.score);
  const normalized = filteredSessions.map(s => s.normalized120 || s.score);
  const totalSessions = filteredSessions.length;
  const bestScore = Math.max(...scores);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const bestNormalized = Math.max(...normalized).toFixed(1);
  const avgNormalized = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);
  const recentSession = filteredSessions[filteredSessions.length - 1];
  
  let totalProblems = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  filteredSessions.forEach(session => {
    if (session.problems) {
      totalProblems += session.problems.length;
      session.problems.forEach(p => {
        if (p.latency > 0) {
          totalLatency += p.latency;
          latencyCount++;
        }
      });
    }
  });

  const avgLatency = latencyCount > 0 ? (totalLatency / latencyCount / 1000).toFixed(2) : 0;

  const bestSessionIndex = scores.indexOf(bestScore);
  const bestSession = filteredSessions[bestSessionIndex];

  document.getElementById('total-sessions').textContent = totalSessions;
  document.getElementById('best-score').textContent = `${bestScore} (${bestNormalized})`;
  document.getElementById('best-date').textContent = formatDate(bestSession.timestamp);
  document.getElementById('avg-score').textContent = `${avgScore} (${avgNormalized})`;
  document.getElementById('recent-score').textContent = recentSession.score;
  document.getElementById('recent-date').textContent = formatDate(recentSession.timestamp);
  document.getElementById('total-problems').textContent = totalProblems;
  document.getElementById('avg-latency').textContent = avgLatency + 's';

  createScoreChart();
  createOperationsChart();
  populateSessionsTable();
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

function createScoreChart() {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  const parent = canvas.parentElement;
  canvas.width = parent.offsetWidth - 60;
  canvas.height = 300;
  
  if (filteredSessions.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const normalizedData = filteredSessions.map(s => s.normalized120 || s.score);
  
  const maxScore = Math.max(...normalizedData, 50);
  const padding = 50;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
    
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    const value = Math.round(maxScore - (maxScore / 5) * i);
    ctx.fillText(value, padding - 10, y + 4);
  }
  
  // Draw line
  if (normalizedData.length > 0) {
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    normalizedData.forEach((score, i) => {
      const x = padding + (chartWidth / (normalizedData.length - 1 || 1)) * i;
      const y = padding + chartHeight - (score / maxScore) * chartHeight;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = '#667eea';
    normalizedData.forEach((score, i) => {
      const x = padding + (chartWidth / (normalizedData.length - 1 || 1)) * i;
      const y = padding + chartHeight - (score / maxScore) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();
  
  // Labels
  ctx.fillStyle = '#666';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Session Number', canvas.width / 2, canvas.height - 10);
  
  ctx.save();
  ctx.translate(15, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Normalized Score (120s)', 0, 0);
  ctx.restore();
}

function createOperationsChart() {
  const canvas = document.getElementById('operations-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  const parent = canvas.parentElement;
  canvas.width = parent.offsetWidth - 60;
  canvas.height = 300;
  
  const operationCounts = {
    addition: 0,
    subtraction: 0,
    multiplication: 0,
    division: 0,
    unknown: 0
  };

  filteredSessions.forEach(session => {
    if (session.problems) {
      session.problems.forEach(p => {
        const type = p.operationType || 'unknown';
        operationCounts[type] = (operationCounts[type] || 0) + 1;
      });
    }
  });
  
  const data = [
    { label: 'Addition', value: operationCounts.addition, color: '#1976d2' },
    { label: 'Subtraction', value: operationCounts.subtraction, color: '#f57c00' },
    { label: 'Multiplication', value: operationCounts.multiplication, color: '#388e3c' },
    { label: 'Division', value: operationCounts.division, color: '#c2185b' },
    { label: 'Unknown', value: operationCounts.unknown, color: '#757575' }
  ];
  
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (total === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const radius = Math.min(centerX, centerY) - 40;
  const innerRadius = radius * 0.6;
  
  let currentAngle = -Math.PI / 2;
  
  data.forEach(item => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
    ctx.closePath();
    ctx.fill();
    
    currentAngle += sliceAngle;
  });
  
  // Legend
  const legendY = canvas.height - 30;
  const legendItemWidth = canvas.width / data.length;
  
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  
  data.forEach((item, i) => {
    const x = legendItemWidth * i + legendItemWidth / 2;
    
    ctx.fillStyle = item.color;
    ctx.fillRect(x - 20, legendY - 8, 12, 12);
    
    ctx.fillStyle = '#333';
    ctx.fillText(`${item.label} (${item.value})`, x + 10, legendY);
  });
}

function populateSessionsTable() {
  const tbody = document.getElementById('sessions-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  const recentSessions = filteredSessions.slice(-10).reverse();

  recentSessions.forEach(session => {
    const row = document.createElement('tr');
    
    const date = new Date(session.timestamp);
    const problemCount = session.problems ? session.problems.length : 0;
    
    let avgTime = 0;
    if (session.problems) {
      const validLatencies = session.problems.filter(p => p.latency > 0);
      if (validLatencies.length > 0) {
        avgTime = (validLatencies.reduce((sum, p) => sum + p.latency, 0) / validLatencies.length / 1000).toFixed(2);
      }
    }

    const ops = { addition: 0, subtraction: 0, multiplication: 0, division: 0 };
    if (session.problems) {
      session.problems.forEach(p => {
        if (p.operationType && ops.hasOwnProperty(p.operationType)) {
          ops[p.operationType]++;
        }
      });
    }

    const normalized = session.normalized120 ? session.normalized120.toFixed(1) : session.score;

    row.innerHTML = `
      <td>${date.toLocaleString()}</td>
      <td><strong>${session.score}</strong> <span style="color: #667eea;">(${normalized})</span></td>
      <td>${problemCount}</td>
      <td>${avgTime}s</td>
      <td>
        ${ops.addition > 0 ? `<span class="operation-badge addition">+ ${ops.addition}</span> ` : ''}
        ${ops.subtraction > 0 ? `<span class="operation-badge subtraction">− ${ops.subtraction}</span> ` : ''}
        ${ops.multiplication > 0 ? `<span class="operation-badge multiplication">× ${ops.multiplication}</span> ` : ''}
        ${ops.division > 0 ? `<span class="operation-badge division">÷ ${ops.division}</span> ` : ''}
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

function clearAllData() {
  if (confirm('Are you sure you want to clear all session data? This cannot be undone.')) {
    chrome.storage.local.remove('gameSessions', () => {
      alert('All data cleared!');
      window.location.reload();
    });
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  const clearBtn = document.getElementById('clear-btn');
  const dumpBtn = document.getElementById('dump-data-btn');
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllData);
  }
  
  if (dumpBtn) {
    dumpBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "dumpAllData" }, (response) => {
        if (response?.success) {
          alert(`Successfully sent ${response.sent} of ${response.total} sessions to Google Sheets`);
        } else {
          alert('Error dumping data: ' + (response?.error || 'Unknown error'));
        }
      });
    });
  }

  // Add filter controls
  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-container';
  filterContainer.style.cssText = 'background: white; border-radius: 15px; padding: 20px; margin-bottom: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);';
  filterContainer.innerHTML = `
    <div style="display: flex; gap: 20px; align-items: center;">
      <div>
        <label style="font-weight: 600; margin-right: 10px;">Mode:</label>
        <select id="mode-filter" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
          <option value="all">All</option>
          <option value="Normal">Normal</option>
          <option value="Hard">Hard</option>
        </select>
      </div>
      <div>
        <label style="font-weight: 600; margin-right: 10px;">Duration:</label>
        <select id="duration-filter" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
          <option value="all">All</option>
          <option value="30">30s</option>
          <option value="60">60s</option>
          <option value="120">120s (2 min)</option>
          <option value="300">300s (5 min)</option>
          <option value="600">600s (10 min)</option>
        </select>
      </div>
      <div style="margin-left: auto; color: #666; font-size: 14px;">
        <strong>Note:</strong> Scores shown as Raw (Normalized to 120s)
      </div>
    </div>
  `;

  const container = document.querySelector('.container');
  const statsGrid = document.querySelector('.stats-grid');
  if (container && statsGrid) {
    container.insertBefore(filterContainer, statsGrid);
  }

  const modeFilter = document.getElementById('mode-filter');
  const durationFilter = document.getElementById('duration-filter');
  
  if (modeFilter) {
    modeFilter.addEventListener('change', (e) => {
      currentFilter.mode = e.target.value;
      applyFilters();
    });
  }
  
  if (durationFilter) {
    durationFilter.addEventListener('change', (e) => {
      currentFilter.duration = e.target.value;
      applyFilters();
    });
  }

  // Load data
  loadData();
});

// Also trigger load on page load if DOMContentLoaded already fired
if (document.readyState === 'loading') {
  // Already set up listener above
} else {
  loadData();
}
