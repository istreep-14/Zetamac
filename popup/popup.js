// popup/popup.js - Fixed with better error handling and logging

console.log("Popup script starting...");

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded - DOMContentLoaded fired");

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

  console.log("Elements found:", {
    loading: !!loadingElement,
    content: !!contentElement,
    dashboard: !!dashboardBtn,
    practice: !!practiceBtn
  });

  const updateUI = (sessions) => {
    console.log("Updating UI with sessions:", sessions);
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (contentElement) contentElement.style.display = 'block';

    if (!sessions || sessions.length === 0) {
      console.log("No sessions found");
      if (sessionCountElement) sessionCountElement.textContent = '0';
      if (bestScoreElement) bestScoreElement.textContent = '-';
      if (bestNormalizedElement) bestNormalizedElement.textContent = '-';
      if (avgScoreElement) avgScoreElement.textContent = '-';
      if (avgNormalizedElement) avgNormalizedElement.textContent = '-';
      if (recentScoreElement) recentScoreElement.textContent = '-';
      if (recentNormalizedElement) recentNormalizedElement.textContent = '-';
      
      if (tipTextElement) tipTextElement.textContent = "Start practicing to track your progress!";
      if (tipElement) tipElement.style.display = 'block';
      return;
    }

    console.log(`Found ${sessions.length} sessions`);

    const scores = sessions.map(s => s.score);
    const normalized = sessions.map(s => s.normalized120 || s.score);
    const recentSession = sessions[sessions.length - 1];
    const bestScore = Math.max(...scores);
    const bestIndex = scores.indexOf(bestScore);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const avgNorm = (normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(1);

    if (sessionCountElement) sessionCountElement.textContent = sessions.length;
    if (bestScoreElement) bestScoreElement.textContent = bestScore;
    if (bestNormalizedElement) bestNormalizedElement.textContent = normalized[bestIndex].toFixed(1);
    if (avgScoreElement) avgScoreElement.textContent = avgScore;
    if (avgNormalizedElement) avgNormalizedElement.textContent = avgNorm;
    if (recentScoreElement) recentScoreElement.textContent = recentSession.score;
    if (recentNormalizedElement) recentNormalizedElement.textContent = (recentSession.normalized120 || recentSession.score).toFixed(1);

    // Show tip based on recent performance
    const recentNorm = recentSession.normalized120 || recentSession.score;
    let tipText = "";
    if (recentNorm < 40) {
      tipText = "Focus on accuracy first, then speed will follow!";
    } else if (recentNorm < 80) {
      tipText = "Good progress! Try to recognize patterns in problems.";
    } else if (recentNorm >= 80) {
      tipText = "Excellent! You're performing at a high level!";
    }
    
    if (tipTextElement && tipText) {
      tipTextElement.textContent = tipText;
      if (tipElement) tipElement.style.display = 'block';
    }

    console.log("UI updated successfully");
  };

  console.log("Loading sessions from storage...");
  
  // Check if chrome.storage is available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error("chrome.storage is not available!");
    return;
  }

  chrome.storage.local.get(['gameSessions'], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error reading storage:", chrome.runtime.lastError);
      return;
    }
    
    console.log("Retrieved data from storage:", result);
    const gameSessions = result.gameSessions || [];
    console.log(`Found ${gameSessions.length} sessions in storage`);
    updateUI(gameSessions);
  });

  if (dashboardBtn) {
    console.log("Setting up dashboard button");
    dashboardBtn.addEventListener('click', () => {
     chrome.tabs.create({ 
       url: chrome.runtime.getURL('dashboard/dashboard_pro.html') 
     });
   });
    });
  }

  if (practiceBtn) {
    console.log("Setting up practice button");
    practiceBtn.addEventListener('click', () => {
      console.log("Opening practice site");
      chrome.tabs.create({ url: 'https://arithmetic.zetamac.com/' });
    });
  }
  
  console.log("Popup initialization complete");
});

console.log("Popup script loaded");
