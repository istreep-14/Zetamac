// background/index.js - Simplified without dump functionality

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
    
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedData)
    });

    console.log('Data sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending data:', error);
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

console.log("Background script loaded");
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
    
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedData)
    });

    console.log('Data sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending data:', error);
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendGameData") {
    console.log("Received game data:", request.data);
    sendGameDataToGoogleSheet(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === "dumpAllData") {
    console.log("Dumping all data to sheet");
    chrome.storage.local.get(['gameSessions'], async (result) => {
      const sessions = result.gameSessions || [];
      let successCount = 0;
      
      for (const session of sessions) {
        const result = await sendGameDataToGoogleSheet(session);
        if (result.success) successCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      sendResponse({ success: true, total: sessions.length, sent: successCount });
    });
    return true;
  }
});

console.log("Background script loaded");
