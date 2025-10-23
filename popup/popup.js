// popup/popup.js - Fixed to load from Google Sheets

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyjxIIqmqWcPeFZ5G_m9ZGetPVlsDf28kYFN4__6yRPFZQw4a73EZjNsYNq2GSWooPi/exec';

console.log("Popup script starting...");

document.addEventListener('DOMContentLoaded', async () => {
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
    const recentSession = sessions[sessions.length - 1];
    const bestScore = Math.max(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    
    // Calculate normalized scores (score per 120 seconds)
    const normalizedScores = sessions.map(s => {
      const duration = s.duration || 120;
      return (s.score / duration) * 120;
    });
    
    const bestNormalized = Math.max(...normalizedScores).toFixed(1);
    const avgNormalized = (normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length).toFixed(1);
    const recentNormalized = ((recentSession.score / (recentSession.duration || 120)) * 120).toFixed(1);

    if (sessionCountElement) sessionCountElement.textContent = sessions.length;
    if (bestScoreElement) bestScoreElement.textContent = bestScore;
    if (bestNormalizedElement) bestNormalizedElement.textContent = bestNormalized;
    if (avgScoreElement) avgScoreElement.textContent = avgScore;
    if (avgNormalizedElement) avgNormalizedElement.textContent = avgNormalized;
    if (recentScoreElement) recentScoreElement.textContent = recentSession.score;
    if (recentNormalizedElement) recentNormalizedElement.textContent = recentNormalized;

    // Show tip based on recent performance
    let tipText = "";
    const recentNorm = parseFloat(recentNormalized);
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

  // Load sessions from Google Sheets
  const loadSessions = async () => {
    try {
      console.log("Loading sessions from Google Sheets...");
      const response = await fetch(`${GOOGLE_SHEETS_URL}?action=getSessions`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Received data:", data);
      
      if (data.success && data.sessions) {
        console.log(`Loaded ${data.sessions.length} sessions from Google Sheets`);
        updateUI(data.sessions);
      } else {
        console.error("Failed to load sessions:", data);
        updateUI([]);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
      if (loadingElement) {
        loadingElement.innerHTML = `
          <div style="color: white; padding: 20px;">
            <p>Unable to load data from Google Sheets.</p>
            <p style="font-size: 12px; margin-top: 10px;">Make sure the script is deployed and the URL is correct.</p>
          </div>
        `;
      }
    }
  };

  // Load sessions
  await loadSessions();

  if (dashboardBtn) {
    console.log("Setting up dashboard button");
    dashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('dashboard/dashboard.html') 
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
