// background/index.js

// **THIS IS WHERE YOU INPUT THE GOOGLE APPS SCRIPT WEB APP URL**
const googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbx3EdN19zwixtZCo0kRBNCFy2dcLbbxV7Jg3b0MJ-oZTjEdOJPB3EMul0lrutegsJgPbg/exec'; // Replace with your actual URL

// Function to send data to Google Sheet
async function sendGameDataToGoogleSheet(sessionData) {
  console.log('Background script: sendGameDataToGoogleSheet called');

  // Check if the URL is set (basic validation)
  if (!googleAppsScriptUrl || googleAppsScriptUrl === 'YOUR_WEB_APP_URL') {
    console.error('Background script: Google Apps Script Web App URL is not configured.');
    // You might want to add a notification to the user here
    return;
  }

  try {
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      body: JSON.stringify(sessionData),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.text();
    console.log('Background script: Data sent successfully to Google Sheet:', result);

    // Optional: You could remove the data from local storage here if you no longer need it
    // after successful sending.
    // chrome.storage.local.remove('gameSessions'); // Or remove the specific session

  } catch (error) {
    console.error('Background script: Error sending data to Google Sheet:', error);
    // Implement error handling (e.g., retry mechanism, notification)
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "sendGameData") {
    console.log("Background script: Received message to send game data.");
    sendGameDataToGoogleSheet(request.data);
    sendResponse({ status: "success" });
    return true; // Indicate that the response is sent asynchronously
  }
});

console.log("Background script loaded and listening for messages.");
