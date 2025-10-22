// background/index.js - Simplified version

const googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbx3EdN19zwixtZCo0kRBNCFy2dcLbbxV7Jg3b0MJ-oZTjEdOJPB3EMul0lrutegsJgPbg/exec';

async function sendGameDataToGoogleSheet(sessionData) {
  console.log('Sending game data to Google Sheet...');

  if (!googleAppsScriptUrl || googleAppsScriptUrl === 'YOUR_WEB_APP_URL') {
    console.error('Google Apps Script URL not configured');
    return { success: false, error: 'URL not configured' };
  }

  try {
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      body: JSON.stringify(sessionData),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.text();
    console.log('Data sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending data:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendGameData") {
    console.log("Received game data");
    sendGameDataToGoogleSheet(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === "dumpAllData") {
    console.log("Dumping all data to sheet");
    chrome.storage.local.get(['gameSessions'], async (result) => {
      const sessions = result.gameSessions || [];
      for (const session of sessions) {
        await sendGameDataToGoogleSheet(session);
      }
      sendResponse({ success: true, count: sessions.length });
    });
    return true;
  }
});

console.log("Background script loaded");
