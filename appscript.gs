// Google Apps Script - Enhanced with batch data loading
// Tools > Script editor > paste this code

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let summarySheet = ss.getSheetByName('Summary');
    let detailSheet = ss.getSheetByName('Details');
    
    // Create Summary sheet if it doesn't exist
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Summary');
      summarySheet.appendRow([
        'ID', 'Date', 'Time', 'Score', 'Mode', 'Duration', 'TimeStamp', 'Key'
      ]);
    }
    
    // Create Details sheet if it doesn't exist
    if (!detailSheet) {
      detailSheet = ss.insertSheet('Details');
      detailSheet.appendRow([
        'ID', 'Problem #', 'Question', 'A', 'B', 'C', 'Operation Type', 'Latency (ms)'
      ]);
    }
    
    // Parse timestamp
    const timestamp = new Date(data.timestamp);
    const sessionId = `${data.key}-${timestamp.getTime()}`;
    
    // Format date and time
    const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MM/dd/yy');
    const timeStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'h:mm a');
    const fullTimestamp = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MM/dd/yyyy h:mm:ss');
    
    // Add summary row
    summarySheet.appendRow([
      sessionId,
      dateStr,
      timeStr,
      data.score,
      data.mode,
      data.duration,
      fullTimestamp,
      data.key
    ]);
    
    // Add detail rows
    const problems = data.problems || [];
    problems.forEach((problem, index) => {
      detailSheet.appendRow([
        sessionId,
        index + 1,
        problem.question || '',
        problem.a || '',
        problem.b || '',
        problem.c || problem.answer || '',
        problem.operationType || 'unknown',
        problem.latency || 0
      ]);
    });
    
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: 'Data saved', sessionId: sessionId })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getSessions') {
      return getSessions(e);
    } else if (action === 'getProblems') {
      return getProblems(e);
    } else if (action === 'deleteSession') {
      return deleteSession(e);
    } else if (action === 'getAllData') {
      return getAllData(e);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ 
        status: 'ready', 
        availableActions: ['getSessions', 'getProblems', 'deleteSession', 'getAllData'] 
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSessions(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName('Summary');
  
  if (!summarySheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, sessions: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = summarySheet.getDataRange().getValues();
  const sessions = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Parse the timestamp to create ISO format
    const timestampStr = row[6]; // Full timestamp column
    let isoTimestamp;
    
    try {
      if (timestampStr instanceof Date) {
        isoTimestamp = timestampStr.toISOString();
      } else {
        const parsedDate = new Date(timestampStr);
        isoTimestamp = parsedDate.toISOString();
      }
    } catch (e) {
      isoTimestamp = new Date().toISOString();
    }
    
    const session = {
      id: row[0],           // ID
      date: row[1],         // Date
      time: row[2],         // Time
      score: row[3],        // Score
      mode: row[4],         // Mode
      duration: row[5],     // Duration
      timestamp: isoTimestamp,  // ISO timestamp for compatibility
      fullTimestamp: row[6],    // Original timestamp
      key: row[7],          // Key
      rowIndex: i + 1       // For deletion
    };
    sessions.push(session);
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, sessions: sessions })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getProblems(e) {
  const sessionId = e.parameter.id || e.parameter.sessionId;
  
  if (!sessionId) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Session ID required' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const detailSheet = ss.getSheetByName('Details');
  
  if (!detailSheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, problems: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = detailSheet.getDataRange().getValues();
  const problems = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === sessionId) {
      problems.push({
        id: row[0],              // ID
        problemNum: row[1],      // Problem #
        question: row[2],        // Question
        a: row[3],               // A
        b: row[4],               // B
        c: row[5],               // C
        operationType: row[6],   // Operation Type
        latency: row[7]          // Latency (ms)
      });
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, problems: problems })
  ).setMimeType(ContentService.MimeType.JSON);
}

// NEW: Get all data in one request for faster dashboard loading
function getAllData(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName('Summary');
  const detailSheet = ss.getSheetByName('Details');
  
  const result = {
    success: true,
    sessions: [],
    problemsBySession: {}
  };
  
  // Get sessions
  if (summarySheet) {
    const summaryData = summarySheet.getDataRange().getValues();
    
    for (let i = 1; i < summaryData.length; i++) {
      const row = summaryData[i];
      const timestampStr = row[6];
      let isoTimestamp;
      
      try {
        if (timestampStr instanceof Date) {
          isoTimestamp = timestampStr.toISOString();
        } else {
          const parsedDate = new Date(timestampStr);
          isoTimestamp = parsedDate.toISOString();
        }
      } catch (e) {
        isoTimestamp = new Date().toISOString();
      }
      
      const session = {
        id: row[0],
        date: row[1],
        time: row[2],
        score: row[3],
        mode: row[4],
        duration: row[5],
        timestamp: isoTimestamp,
        fullTimestamp: row[6],
        key: row[7],
        rowIndex: i + 1
      };
      result.sessions.push(session);
    }
  }
  
  // Get all problems
  if (detailSheet) {
    const detailData = detailSheet.getDataRange().getValues();
    
    for (let i = 1; i < detailData.length; i++) {
      const row = detailData[i];
      const sessionId = row[0];
      
      if (!result.problemsBySession[sessionId]) {
        result.problemsBySession[sessionId] = [];
      }
      
      result.problemsBySession[sessionId].push({
        id: row[0],
        problemNum: row[1],
        question: row[2],
        a: row[3],
        b: row[4],
        c: row[5],
        operationType: row[6],
        latency: row[7]
      });
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}

function deleteSession(e) {
  const sessionId = e.parameter.id || e.parameter.sessionId;
  
  if (!sessionId) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Session ID required' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName('Summary');
  const detailSheet = ss.getSheetByName('Details');
  
  let deleted = false;
  
  // Delete from Summary sheet
  if (summarySheet) {
    const data = summarySheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId) {
        summarySheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }
  }
  
  // Delete from Details sheet
  if (detailSheet) {
    const data = detailSheet.getDataRange().getValues();
    // Delete in reverse order to avoid index shifting
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === sessionId) {
        detailSheet.deleteRow(i + 1);
      }
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ 
      success: deleted, 
      message: deleted ? 'Session deleted' : 'Session not found' 
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
