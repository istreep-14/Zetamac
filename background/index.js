// background/index.js - Fixed version

const googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbyjxIIqmqWcPeFZ5G_m9ZGetPVlsDf28kYFN4__6yRPFZQw4a73EZjNsYNq2GSWooPi/exec';

function formatSessionForSheet(sessionData) {
  const date = new Date(sessionData.timestamp);
  return {
    timestamp: date.toISOString(),
    score: sessionData.score,
    scorePerSecond: sessionData.scorePerSecond,
    normalized120: sessionData.normalized120,
    key: sessionData.key,
    mode: sessionData.mode,
    duration: sessionData.duration,
    problems: sessionData.problems
  };
}

async function sendGameDataToGoogleSheet(sessionData) {
  console.log('Sending game data to Google Sheet...');

  if (!googleAppsScriptUrl || googleAppsScriptUrl === 'YOUR_WEB_APP_URL') {
    console.error('Google Apps Script URL not configured');
    return { success: false, error: 'URL not configured' };
  }

  try {
    const formattedData = formatSessionForSheet(sessionData);
    console.log('Formatted data:', formattedData);
    
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedData)
    });

    // Note: With no-cors mode, we can't read the response
    // But if fetch completes without error, it was likely successful
    console.log('Data sent successfully (no-cors mode)');
    return { success: true };
  } catch (error) {
    console.error('Error sending data:', error);
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === "sendGameData") {
    console.log("Received game data:", request.data);
    
    // Store in local storage immediately for dashboard access
    chrome.storage.local.get(['gameSessions'], (result) => {
      const sessions = result.gameSessions || [];
      sessions.push(request.data);
      
      // Keep only recent 100 sessions in local storage
      const recentSessions = sessions.slice(-100);
      
      chrome.storage.local.set({ gameSessions: recentSessions }, () => {
        console.log('Session saved to local storage (keeping last 100)');
        console.log('Total sessions now:', recentSessions.length);
        
        // Send to Google Sheets
        sendGameDataToGoogleSheet(request.data)
          .then(result => {
            console.log('Sheet write result:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('Sheet write error:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
    });
    
    return true; // Keep channel open for async response
  }
});

// Log when background script loads
console.log("Background script loaded and ready");

// Keep service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
});
