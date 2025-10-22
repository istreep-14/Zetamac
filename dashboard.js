// dashboard.js - Dashboard logic with Chart.js drawing (no CDN needed)

let gameSessions = [];
let scoreChart = null;
let operationsChart = null;

function loadData() {
  chrome.storage.local.get(['gameSessions'], (result) => {
    gameSessions = result.gameSessions || [];
    updateDashboard();
  });
}

function updateDashboard() {
  if (gameSessions.length === 0) {
    document.getElementById('sessions-body').innerHTML = 
      '<tr><td colspan="5" class="no-data">No sessions yet. Start practicing on Zetamac!</td></tr>';
    return;
  }

  // Calculate statistics
  const scores = gameSessions.map(s => s.score);
  const totalSessions = gameSessions.length;
  const bestScore = Math.max(...scores);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const recentSession = gameSessions[gameSessions.length - 1];
  
  // Calculate total problems and average latency
  let totalProblems = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  gameSessions.forEach(session => {
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

  // Find best score date
  const bestSessionIndex = scores.indexOf(bestScore);
  const bestSession = gameSessions[bestSessionIndex];

  // Update stat cards
  document.getElementById('total-sessions').textContent = totalSessions;
  document.getElementById('best-score').textContent = bestScore;
  document.getElementById('best-date').textContent = formatDate(bestSession.timestamp);
  document.getElementById('avg-score').textContent = avgScore;
  document.getElementById('recent-score').textContent = recentSession.score;
  document.getElementById('recent-date').textContent = formatDate(recentSession.timestamp);
  document.getElementById('total-problems').textContent = totalProblems;
  document.getElementById('avg-latency').textContent = avgLatency + 's';

  // Create charts
  createScoreChart();
  createOperationsChart();
  
  // Populate table
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
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 300;
  
  const labels = gameSessions.map((_, i) => i + 1);
  const data = gameSessions.map(s => s.score);
  
  const maxScore = Math.max(...data, 50); // At least 50 for scale
  const padding = 40;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid lines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
    
    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    const value = Math.round(maxScore - (maxScore / 5) * i);
    ctx.fillText(value, padding - 10, y + 4);
  }
  
  // Draw line chart
  if (data.length > 0) {
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((score, i) => {
      const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
      const y = padding + chartHeight - (score / maxScore) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = '#667eea';
    data.forEach((score, i) => {
      const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
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
  
  // X-axis label
  ctx.fillStyle = '#666';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Session Number', canvas.width / 2, canvas.height - 10);
  
  // Y-axis label
  ctx.save();
  ctx.translate(15, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Score', 0, 0);
  ctx.restore();
}

function createOperationsChart() {
  const canvas = document.getElementById('operations-chart');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 300;
  
  // Count operations
  const operationCounts = {
    addition: 0,
    subtraction: 0,
    multiplication: 0,
    division: 0,
    unknown: 0
  };

  gameSessions.forEach(session => {
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
  
  if (total === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw doughnut chart
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const radius = Math.min(centerX, centerY) - 40;
  const innerRadius = radius * 0.6;
  
  let currentAngle = -Math.PI / 2;
  
  data.forEach(item => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    
    // Draw slice
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
    ctx.closePath();
    ctx.fill();
    
    currentAngle += sliceAngle;
  });
  
  // Draw legend
  const legendY = canvas.height - 30;
  const legendItemWidth = canvas.width / data.length;
  
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  
  data.forEach((item, i) => {
    const x = legendItemWidth * i + legendItemWidth / 2;
    
    // Draw color box
    ctx.fillStyle = item.color;
    ctx.fillRect(x - 20, legendY - 8, 12, 12);
    
    // Draw label
    ctx.fillStyle = '#333';
    ctx.fillText(`${item.label} (${item.value})`, x + 10, legendY);
  });
}

function populateSessionsTable() {
  const tbody = document.getElementById('sessions-body');
  tbody.innerHTML = '';

  // Show last 10 sessions
  const recentSessions = gameSessions.slice(-10).reverse();

  recentSessions.forEach(session => {
    const row = document.createElement('tr');
    
    const date = new Date(session.timestamp);
    const problemCount = session.problems ? session.problems.length : 0;
    
    // Calculate average time
    let avgTime = 0;
    if (session.problems) {
      const validLatencies = session.problems.filter(p => p.latency > 0);
      if (validLatencies.length > 0) {
        avgTime = (validLatencies.reduce((sum, p) => sum + p.latency, 0) / validLatencies.length / 1000).toFixed(2);
      }
    }

    // Count operations
    const ops = { addition: 0, subtraction: 0, multiplication: 0, division: 0 };
    if (session.problems) {
      session.problems.forEach(p => {
        if (p.operationType && ops.hasOwnProperty(p.operationType)) {
          ops[p.operationType]++;
        }
      });
    }

    row.innerHTML = `
      <td>${date.toLocaleString()}</td>
      <td><strong>${session.score}</strong></td>
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
document.getElementById('refresh-btn').addEventListener('click', () => {
  window.location.reload();
});

document.getElementById('clear-btn').addEventListener('click', clearAllData);

// Load data when page loads
loadData();
