// dashboard/dashboard.js - Pure vanilla JavaScript, no external dependencies

let allSessions = [];
let filteredSessions = [];
let chart = null;

const opColors = {
  addition: '#3b82f6',
  subtraction: '#f97316',
  multiplication: '#10b981',
  division: '#ec4899'
};

const opIcons = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loading...');
  
  // Load sessions from storage
  chrome.storage.local.get(['gameSessions'], (result) => {
    allSessions = result.gameSessions || [];
    console.log(`Loaded ${allSessions.length} sessions`);
    
    filteredSessions = [...allSessions];
    updateDashboard();
    drawChart();
  });

  // Setup filters
  document.getElementById('mode-filter').addEventListener('change', applyFilters);
  document.getElementById('duration-filter').addEventListener('change', applyFilters);
});

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
  drawChart();
}

function updateDashboard() {
  updateStats();
  updateOperations();
  updateSessionsTable();
}

function updateStats() {
  const container = document.getElementById('stats');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div class="no-data">No sessions recorded yet. Start practicing!</div>';
    return;
  }

  const scores = filteredSessions.map(s => s.score);
  const normalized = filteredSessions.map(s => s.normalized120 || s.score);
  const recent = filteredSessions[filteredSessions.length - 1];
  const bestScore = Math.max(...scores);
  const bestIndex = scores.indexOf(bestScore);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const avgNorm = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Sessions</div>
      <div class="stat-value">${filteredSessions.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Best</div>
      <div class="stat-value">${bestScore}</div>
      <div class="stat-subvalue">(${normalized[bestIndex].toFixed(1)})</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average</div>
      <div class="stat-value">${avgScore}</div>
      <div class="stat-subvalue">(${avgNorm})</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Recent</div>
      <div class="stat-value">${recent.score}</div>
      <div class="stat-subvalue">(${(recent.normalized120 || recent.score).toFixed(1)})</div>
    </div>
  `;
}

function updateOperations() {
  const container = document.getElementById('operations');
  
  if (filteredSessions.length === 0) {
    container.innerHTML = '<div class="no-data">No operation data available</div>';
    return;
  }

  const ops = {
    addition: { times: [], count: 0 },
    subtraction: { times: [], count: 0 },
    multiplication: { times: [], count: 0 },
    division: { times: [], count: 0 }
  };

  let totalProblems = 0;

  filteredSessions.forEach(session => {
    if (session.problems) {
      session.problems.forEach(p => {
        if (p.operationType && ops[p.operationType] && p.latency > 0) {
          ops[p.operationType].times.push(p.latency / 1000);
          ops[p.operationType].count++;
          totalProblems++;
        }
      });
    }
  });

  const opStats = Object.entries(ops)
    .map(([type, data]) => {
      if (data.count === 0) return null;

      const avgTime = (data.times.reduce((a, b) => a + b, 0) / data.times.length).toFixed(2);
      const sorted = [...data.times].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)].toFixed(2);
      const variance = data.times.reduce((sq, n) => sq + Math.pow(n - avgTime, 2), 0) / data.times.length;
      const std = Math.sqrt(variance).toFixed(2);
      const percentage = totalProblems > 0 ? ((data.count / totalProblems) * 100).toFixed(1) : 0;

      return { type, avgTime, median, std, count: data.count, percentage };
    })
    .filter(op => op !== null);

  container.innerHTML = opStats.map(op => `
    <div class="operation-card">
      <div class="op-header">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="op-icon" style="background-color: ${opColors[op.type]}">
            ${opIcons[op.type]}
          </div>
          <div class="op-info">
            <h3>${op.type}</h3>
            <div class="op-count">${op.count} problems (${op.percentage}%)</div>
          </div>
        </div>
        <div>
          <div class="op-time" style="color: ${opColors[op.type]}">${op.avgTime}s</div>
          <div class="op-time-label">avg time</div>
        </div>
      </div>
      <div class="op-bar">
        <div class="op-bar-fill" style="width: ${op.percentage}%; background-color: ${opColors[op.type]}"></div>
      </div>
      <div class="op-stats">
        <div class="op-stat-item">Median: <strong>${op.median}s</strong></div>
        <div class="op-stat-item">Std Dev: <strong>±${op.std}s</strong></div>
      </div>
    </div>
  `).join('');
}

function updateSessionsTable() {
  const tbody = document.getElementById('sessions-body');
  
  if (filteredSessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No sessions yet</td></tr>';
    return;
  }

  const recentSessions = filteredSessions.slice(-10).reverse();
  
  tbody.innerHTML = recentSessions.map(session => {
    const ops = { addition: 0, subtraction: 0, multiplication: 0, division: 0 };
    
    if (session.problems) {
      session.problems.forEach(p => {
        if (p.operationType && ops.hasOwnProperty(p.operationType)) {
          ops[p.operationType]++;
        }
      });
    }

    const opBadges = Object.entries(ops)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => 
        `<span class="op-badge" style="background-color: ${opColors[type]}">${opIcons[type]} ${count}</span>`
      )
      .join('');

    return `
      <tr>
        <td>${new Date(session.timestamp).toLocaleString()}</td>
        <td><span class="session-score">${session.score}</span></td>
        <td><span class="session-normalized">${(session.normalized120 || session.score).toFixed(1)}</span></td>
        <td>${opBadges}</td>
      </tr>
    `;
  }).join('');
}

function drawChart() {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  canvas.width = canvas.offsetWidth;
  canvas.height = 300;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (filteredSessions.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const data = filteredSessions.map(s => s.normalized120 || s.score);
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;
  const padding = 40;
  
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Draw axes
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  // Draw grid lines
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  // Draw labels
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= 5; i++) {
    const value = maxValue - (range / 5) * i;
    const y = padding + (chartHeight / 5) * i;
    ctx.fillText(value.toFixed(0), padding - 10, y + 5);
  }

  // Draw line
  if (data.length > 1) {
    const stepX = chartWidth / (data.length - 1);
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(padding + stepX * (data.length - 1), canvas.height - padding);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Draw dots
    ctx.fillStyle = '#8b5cf6';
    data.forEach((value, index) => {
      const x = padding + stepX * index;
      const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// Redraw chart on window resize
window.addEventListener('resize', () => {
  if (filteredSessions.length > 0) {
    drawChart();
  }
});

console.log('Dashboard script loaded');
