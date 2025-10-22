document.addEventListener('DOMContentLoaded', () => {
  console.log("popup.js is running!");

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

  // Function to update the UI with stats and recommendations
  const updateUI = (sessions) => {
    console.log("Updating UI with sessions:", sessions); // Added log
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

    // Simple recommendation logic
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

  // Read game session data from local storage
  console.log("Attempting to retrieve game sessions from local storage."); // Added log
  chrome.storage.local.get(['gameSessions'], (result) => {
    console.log("Retrieved data from local storage:", result); // Added log
    const gameSessions = result.gameSessions || [];
    updateUI(gameSessions);
  });

  // Add event listeners to buttons
  dashboardBtn.addEventListener('click', () => {
    // Placeholder for opening the dashboard page
    console.log("Open Dashboard button clicked");
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  zetamacBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://zetamac.com/' });
  });

  dumpDataBtn.addEventListener('click', () => {
    // Placeholder for triggering the data dump to Google Sheet
    console.log("Dump Data button clicked");
    // You would typically send a message to the background script here
    // chrome.runtime.sendMessage({ action: "dumpData" });
  });

});
