// popup/popup.js - Fixed version

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");

  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('content');
  const recentScoreElement = document.getElementById('recent-score');
  const sessionCountElement = document.getElementById('session-count');
  const bestScoreElement = document.getElementById('best-score');
  const recommendationElement = document.getElementById('recommendation');
  const recommendationTextElement = document.getElementById('recommendation-text');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const zetamacBtn = document.getElementById('zetamac-btn');
  const dumpDataBtn = document.getElementById('dump-data-btn');

  const updateUI = (sessions) => {
    console.log("Updating UI with sessions:", sessions);
    loadingElement.style.display = 'none';
    contentElement.style.display = 'block';

    if (!sessions || sessions.length === 0) {
      recentScoreElement.textContent = 'N/A';
      sessionCountElement.textContent = '0';
      bestScoreElement.textContent = 'N/A';
      recommendationElement.style.display = 'none';
      return;
    }

    const recentSession = sessions[sessions.length - 1];
    const recentScore = recentSession.score;
    const sessionCount = sessions.length;
    const bestScore = Math.max(...sessions.map(session => session.score));

    recentScoreElement.textContent = recentScore;
    sessionCountElement.textContent = sessionCount;
    bestScoreElement.textContent = bestScore;

    if (recentScore < 10) {
      recommendationTextElement.textContent = "Keep practicing! Focus on getting quicker with basic operations.";
      recommendationElement.style.display = 'block';
    } else if (recentScore < 20) {
      recommendationTextElement.textContent = "Good progress! Try to reduce your time on each problem.";
      recommendationElement.style.display = 'block';
    } else if (recentScore >= 20) {
      recommendationTextElement.textContent = "Great job! Challenge yourself with more complex operations or higher speed settings.";
      recommendationElement.style.display = 'block';
    } else {
      recommendationElement.style.display = 'none';
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

  if (zetamacBtn) {
    zetamacBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://arithmetic.zetamac.com/' });
    });
  }

  if (dumpDataBtn) {
    dumpDataBtn.addEventListener('click', () => {
      console.log("Dumping data to sheet");
      dumpDataBtn.disabled = true;
      dumpDataBtn.textContent = 'Sending...';
      
      chrome.runtime.sendMessage({ action: "dumpAllData" }, (response) => {
        dumpDataBtn.disabled = false;
        dumpDataBtn.textContent = 'Dump Data to Sheet';
        
        if (response?.success) {
          alert(`Successfully sent ${response.sent} of ${response.total} sessions to Google Sheets!`);
        } else {
          alert('Error: ' + (response?.error || 'Unknown error'));
        }
      });
    });
  }
});
