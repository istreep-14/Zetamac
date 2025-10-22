// popup/popup.js - Fixed and simplified

document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('content');
  const recentScoreElement = document.getElementById('recent-score');
  const sessionCountElement = document.getElementById('session-count');
  const bestScoreElement = document.getElementById('best-score');
  const avgScoreElement = document.getElementById('avg-score');
  const recommendationElement = document.getElementById('recommendation');
  const recommendationTextElement = document.getElementById('recommendation-text');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const zetamacBtn = document.getElementById('zetamac-btn');
  const dumpDataBtn = document.getElementById('dump-data-btn');

  function updateUI(sessions) {
    loadingElement.style.display = 'none';
    contentElement.style.display = 'block';

    if (!sessions || sessions.length === 0) {
      recentScoreElement.textContent = 'N/A';
      sessionCountElement.textContent = '0';
      bestScoreElement.textContent = 'N/A';
      avgScoreElement.textContent = 'N/A';
      recommendationElement.style.display = 'none';
      return;
    }

    // Calculate stats
    const recentSession = sessions[sessions.length - 1];
    const scores = sessions.map(s => s.score);
    const recentScore = recentSession.score;
    const bestScore = Math.max(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);

    // Update UI
    recentScoreElement.textContent = recentScore;
    sessionCountElement.textContent = sessions.length;
    bestScoreElement.textContent = bestScore;
    avgScoreElement.textContent = avgScore;

    // Show recommendation based on recent score
    showRecommendation(recentScore, bestScore, avgScore);
  }

  function showRecommendation(recentScore, bestScore, avgScore) {
    let recommendation = '';

    if (recentScore >= bestScore && recentScore >= 30) {
      recommendation = "🔥 New personal best! You're on fire! Keep challenging yourself with harder problems.";
    } else if (recentScore < 10) {
      recommendation = "🎯 Focus on accuracy first, then speed. Practice basic operations until they become automatic.";
    } else if (recentScore < 20) {
      recommendation = "📈 Good progress! Try to maintain a steady rhythm and avoid rushing your answers.";
    } else if (recentScore < 30) {
      recommendation = "💪 You're doing well! Work on reducing hesitation time between problems.";
    } else if (recentScore >= 30) {
      recommendation = "⭐ Excellent work! Consider increasing difficulty or trying mixed operations.";
    }

    if (recentScore < avgScore - 5) {
      recommendation = "📉 Below your average. Take a break and come back refreshed!";
    }

    if (recommendation) {
      recommendationTextElement.textContent = recommendation;
      recommendationElement.style.display = 'block';
    } else {
      recommendationElement.style.display = 'none';
    }
  }

  // Load data from storage
  chrome.storage.local.get(['gameSessions'], (result) => {
    const gameSessions = result.gameSessions || [];
    updateUI(gameSessions);
  });

  // Button handlers
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  zetamacBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://arithmetic.zetamac.com/' });
  });

  dumpDataBtn.addEventListener('click', () => {
    dumpDataBtn.textContent = '⏳ Syncing...';
    dumpDataBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "dumpAllData" }, (response) => {
      if (response?.success) {
        dumpDataBtn.textContent = `✓ Synced ${response.count} sessions`;
        setTimeout(() => {
          dumpDataBtn.textContent = '📤 Sync All Data';
          dumpDataBtn.disabled = false;
        }, 2000);
      } else {
        dumpDataBtn.textContent = '✗ Sync failed';
        setTimeout(() => {
          dumpDataBtn.textContent = '📤 Sync All Data';
          dumpDataBtn.disabled = false;
        }, 2000);
      }
    });
  });
});
