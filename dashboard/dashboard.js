// dashboard/dashboard.js - Enhanced version with detailed game view

let allSessions = [];
let filteredSessions = [];
let chartData = [];
let hoveredPoint = null;

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

// Time formatting
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds === 60) return '1 min';
  if (seconds === 120) return '2 min';
  if (seconds === 300) return '5 min';
  if (seconds === 600) return '10 min';
  return `${Math.floor(seconds / 60)} min`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loading...');
  
  chrome.storage.local.get(['gameSessions'], (result) => {
    allSessions = result.gameSessions || [];
    console.log(`Loaded ${allSessions.length} sessions`);
    
    filteredSessions = [...allSessions];
    updateDashboard();
    drawChart();
  });

  document.getElementById('mode-filter').addEventListener('change', applyFilters);
  document.getElementById('duration-filter').addEventListener('change', applyFilters);

  // Chart hover handling
  const canvas = document.getElementById('chart');
  canvas.addEventListener('mousemove', handleChartHover);
  canvas.addEventListener('mouseleave', hideChartTooltip);
  canvas.addEventListener('click', handleChartClick);
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
        <div style="display: flex; align-items: center; gap: 0.75rem;">
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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No sessions yet</td></tr>';
    return;
  }

  const recentSessions = filteredSessions.slice(-20).reverse();
  
  tbody.innerHTML = recentSessions.map((session, index) => {
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

    const difficultyClass = session.mode === 'Hard' ? 'difficulty-hard' : 
                           session.mode === 'Normal' ? 'difficulty-normal' : 'difficulty-easy';
    
    const exactDate = new Date(session.timestamp).toLocaleString();
    const timeAgo = getTimeAgo(session.timestamp);
    const normalized = (session.normalized120 || session.score).toFixed(1);

    return `
      <tr>
        <td><span class="time-ago" title="${exactDate}">${timeAgo}</span></td>
        <td>
          <span class="difficulty-badge ${difficultyClass}">${session.mode || 'Normal'}</span>
          <span class="duration-badge">${formatDuration(session.duration)}</span>
        </td>
        <td><span class="session-score" title="2-min normalized: ${normalized}">${session.score}</span></td>
        <td>${opBadges}</td>
        <td><button class="details-btn" onclick="showSessionDetails(${filteredSessions.length - 1 - index})">Details</button></td>
      </tr>
    `;
  }).join('');
}

function drawChart() {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth;
  canvas.height = 300;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (filteredSessions.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    chartData = [];
    return;
  }

  const data = filteredSessions.map(s => s.normalized120 || s.score);
  const maxValue = Math.max(...data);
  const padding = 50;
  
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Draw background
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding, padding, chartWidth, chartHeight);

  // Draw axes
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  // Draw grid lines
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  // Draw Y-axis labels
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= gridLines; i++) {
    const value = maxValue - (maxValue / gridLines) * i;
    const y = padding + (chartHeight / gridLines) * i;
    ctx.fillText(value.toFixed(0), padding - 10, y + 5);
  }

  // Store chart data for hover detection
  chartData = [];
  
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
      const y = canvas.height - padding - (value / maxValue) * chartHeight;
      
      chartData.push({
        x, y, value,
        session: filteredSessions[index],
        index
      });
      
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
    
    chartData.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    ctx.stroke();

    // Draw dots
    chartData.forEach(point => {
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Highlight hovered point
    if (hoveredPoint !== null && chartData[hoveredPoint]) {
      const point = chartData[hoveredPoint];
      ctx.fillStyle = '#667eea';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function handleChartHover(e) {
  if (chartData.length === 0) return;
  
  const canvas = document.getElementById('chart');
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Find closest point
  let closestIndex = -1;
  let closestDist = Infinity;
  
  chartData.forEach((point, index) => {
    const dist = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
    if (dist < 20 && dist < closestDist) {
      closestDist = dist;
      closestIndex = index;
    }
  });
  
  if (closestIndex !== hoveredPoint) {
    hoveredPoint = closestIndex;
    drawChart();
    
    if (hoveredPoint !== -1) {
      showChartTooltip(chartData[hoveredPoint], mouseX, mouseY);
    } else {
      hideChartTooltip();
    }
  }
}

function showChartTooltip(point, mouseX, mouseY) {
  const tooltip = document.getElementById('chart-tooltip');
  const session = point.session;
  const date = new Date(session.timestamp);
  
  tooltip.innerHTML = `
    <div class="tooltip-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
    <div class="tooltip-score">Score: ${point.value.toFixed(1)}</div>
    <button class="tooltip-btn" onclick="showSessionDetails(${point.index})">View Details</button>
  `;
  
  const canvas = document.getElementById('chart');
  const rect = canvas.getBoundingClientRect();
  
  // Position tooltip
  let left = mouseX + 10;
  let top = mouseY + 10;
  
  // Keep tooltip in bounds
  if (left + 200 > canvas.width) left = mouseX - 210;
  if (top + 100 > canvas.height) top = mouseY - 110;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.add('show');
}

function hideChartTooltip() {
  const tooltip = document.getElementById('chart-tooltip');
  tooltip.classList.remove('show');
}

function handleChartClick(e) {
  if (hoveredPoint !== -1) {
    showSessionDetails(hoveredPoint);
  }
}

window.showSessionDetails = function(index) {
  const session = filteredSessions[index];
  if (!session) return;
  
  const modal = document.getElementById('details-modal');
  const title = document.getElementById('modal-title');
  const stats = document.getElementById('modal-stats');
  const problemsBody = document.getElementById('modal-problems');
  
  const date = new Date(session.timestamp);
  title.textContent = `Session Details - ${date.toLocaleString()}`;
  
  // Calculate total latency
  let totalLatency = 0;
  let answeredCount = 0;
  if (session.problems) {
    session.problems.forEach(p => {
      totalLatency += p.latency || 0;
      if (p.answered !== false) answeredCount++;
    });
  }
  
  const totalLatencySec = (totalLatency / 1000).toFixed(2);
  const avgLatency = session.problems && session.problems.length > 0 
    ? (totalLatency / session.problems.length / 1000).toFixed(2) 
    : '0';
  
  stats.innerHTML = `
    <div class="modal-stat">
      <div class="modal-stat-label">Score</div>
      <div class="modal-stat-value">${session.score}</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Normalized (2min)</div>
      <div class="modal-stat-value">${(session.normalized120 || session.score).toFixed(1)}</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Duration</div>
      <div class="modal-stat-value">${formatDuration(session.duration)}</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Mode</div>
      <div class="modal-stat-value">${session.mode || 'Normal'}</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Problems</div>
      <div class="modal-stat-value">${session.problems ? session.problems.length : 0}</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Avg Time</div>
      <div class="modal-stat-value">${avgLatency}s</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Total Time</div>
      <div class="modal-stat-value">${totalLatencySec}s</div>
    </div>
    <div class="modal-stat">
      <div class="modal-stat-label">Time Gap</div>
      <div class="modal-stat-value">${(session.duration - parseFloat(totalLatencySec)).toFixed(2)}s</div>
    </div>
  `;
  
  if (session.problems && session.problems.length > 0) {
    problemsBody.innerHTML = session.problems.map((problem, idx) => {
      const answered = problem.answered !== false;
      const operatorDisplay = problem.operator || opIcons[problem.operationType] || '?';
      const timeDisplay = problem.latency > 0 ? (problem.latency / 1000).toFixed(2) : '0.00';
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${problem.question || `${problem.a} ${operatorDisplay} ${problem.b}`}</td>
          <td style="text-align: center; font-size: 1.125rem; font-weight: bold;">${operatorDisplay}</td>
          <td>${problem.answer || problem.c || '-'}</td>
          <td>${timeDisplay}</td>
          <td class="${answered ? 'answered-yes' : 'answered-no'}">${answered ? 'Yes' : 'No'}</td>
        </tr>
      `;
    }).join('');
  } else {
    problemsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No problem data available</td></tr>';
  }
  
  modal.classList.add('show');
};

window.closeModal = function() {
  const modal = document.getElementById('details-modal');
  modal.classList.remove('show');
};

// Close modal on outside click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('details-modal');
  if (e.target === modal) {
    closeModal();
  }
});

// Redraw chart on window resize
window.addEventListener('resize', () => {
  if (filteredSessions.length > 0) {
    drawChart();
  }
});

console.log('Dashboard script loaded');
