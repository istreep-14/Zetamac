// popup/popup.js - Simplified version without dump/clear functionality

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");

  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('content');
  const sessionCountElement = document.getElementById('session-count');
  const bestScoreElement = document.getElementById('best-score');
  const bestNormalizedElement = document.getElementById('best-normalized');
  const avgScoreElement = document.getElementById('avg-score');
  const avgNormalizedElement = document.getElementById('avg-normalized');
  const recentScoreElement = document.getElementById('recent-score');
  const recentNormalizedElement = document.getElementById('recent-normalized');
  const tipElement = document.getElementById('tip');
  const tipTextElement = document.getElementById('tip-text');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const practiceBtn = document.getElementById('practice-btn');

  const updateUI = (sessions) => {
    console.log("Updating UI with sessions:", sessions);
    loadingElement.style.display = 'none';
    contentElement.style.display = 'block';

    if (!sessions || sessions.length === 0) {
      sessionCountElement.textContent = '0';
      bestScoreElement.textContent = '-';
      bestNormalizedElement.textContent = '-';
      avgScoreElement.textContent = '-';
      avgNormalizedElement.textContent = '-';
      recentScoreElement.textContent = '-';
      recentNormalizedElement.textContent = '-';
      
      tipTextElement.textContent = "Start practicing to track your progress!";
      tipElement.style.display = 'block';
      return;
    }

    const scores = sessions.map(s => s.score);
    const normalized = sessions.map(s => s.normalized120 || s.score);
    const recentSession = sessions[sessions.length - 1];
    const bestScore = Math.max(...scores);
    const bestIndex = scores.indexOf(bestScore);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const avgNorm = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);

    sessionCountElement.textContent = sessions.length;
    bestScoreElement.textContent = bestScore;
    bestNormalizedElement.textContent = normalized[bestIndex].toFixed(1);
    avgScoreElement.textContent = avgScore;
    avgNormalizedElement.textContent = avgNorm;
    recentScoreElement.textContent = recentSession.score;
    recentNormalizedElement.textContent = (recentSession.normalized120 || recentSession.score).toFixed(1);

    // Show tip based on recent performance
    const recentNorm = recentSession.normalized120 || recentSession.score;
    if (recentNorm < 40) {
      tipTextElement.textContent = "Focus on accuracy first, then speed will follow!";
      tipElement.style.display = 'block';
    } else if (recentNorm < 80) {
      tipTextElement.textContent = "Good progress! Try to recognize patterns in problems.";
      tipElement.style.display = 'block';
    } else if (recentNorm >= 80) {
      tipTextElement.textContent = "Excellent! You're performing at a high level!";
      tipElement.style.display = 'block';
    }
  };

  console.log("Loading sessions from storage");
  chrome.storage.local.get(['gameSessions'], (result) => {
    console.log("Retrieved data:", result);
    const gameSessions = result.gameSessions || [];
    updateUI(gameSessions);
  });

  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      console.log("Opening dashboard");
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    });
  }

  if (practiceBtn) {
    practiceBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://arithmetic.zetamac.com/' });
    });
  }
});
