// Google Apps Script - Enhanced with READ operations
// Tools > Script editor > paste this code

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let summarySheet = ss.getSheetByName('Summary');
    let detailSheet = ss.getSheetByName('Details');
    
    // Create sheets if they don't exist
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Summary');
      summarySheet.appendRow([
        'Timestamp', 'Score', 'Score/Second', '2-Min Score',
        'Key', 'Mode', 'Duration', 'Problems Count',
        'Avg Latency', 'Addition', 'Subtraction', 
        'Multiplication', 'Division', 'Unknown/Ultra-fast'
      ]);
    }
    
    if (!detailSheet) {
      detailSheet = ss.insertSheet('Details');
      detailSheet.appendRow([
        'Timestamp', 'Session Key', 'Problem #', 
        'Question', 'A', 'B', 'Operator', 'Answer',
        'Operation Type', 'Latency (ms)', 'Game Time (s)'
      ]);
    }
    
    // Calculate statistics
    const problems = data.problems || [];
    const operationCounts = {
      addition: 0,
      subtraction: 0,
      multiplication: 0,
      division: 0,
      unknown: 0
    };
    
    let totalLatency = 0;
    let latencyCount = 0;
    
    problems.forEach(p => {
      const type = p.operationType || 'unknown';
      operationCounts[type] = (operationCounts[type] || 0) + 1;
      
      if (p.latency > 0) {
        totalLatency += p.latency;
        latencyCount++;
      }
    });
    
    const avgLatency = latencyCount > 0 ? 
      (totalLatency / latencyCount / 1000).toFixed(2) : 0;
    
    // Add summary row
    summarySheet.appendRow([
      data.timestamp,
      data.score,
      data.scorePerSecond,
      data.normalized120,
      data.key,
      data.mode,
      data.duration,
      problems.length,
      avgLatency,
      operationCounts.addition,
      operationCounts.subtraction,
      operationCounts.multiplication,
      operationCounts.division,
      operationCounts.unknown
    ]);
    
    // Add detail rows
    const sessionKey = `${data.mode}-${data.key}`;
    problems.forEach((problem, index) => {
      detailSheet.appendRow([
        data.timestamp,
        sessionKey,
        index + 1,
        problem.question || '',
        problem.a || '',
        problem.b || '',
        problem.operator || '',
        problem.answer || '',
        problem.operationType || 'unknown',
        problem.latency || 0,
        problem.timestamp || 0
      ]);
    });
    
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: 'Data saved' })
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
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ready', availableActions: ['getSessions', 'getProblems', 'deleteSession'] })
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
  const headers = data[0];
  const sessions = [];
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const session = {
      timestamp: row[0],
      score: row[1],
      scorePerSecond: row[2],
      normalized120: row[3],
      key: row[4],
      mode: row[5],
      duration: row[6],
      problemsCount: row[7],
      avgLatency: row[8],
      addition: row[9],
      subtraction: row[10],
      multiplication: row[11],
      division: row[12],
      unknown: row[13],
      rowIndex: i + 1 // For deletion
    };
    sessions.push(session);
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, sessions: sessions })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getProblems(e) {
  const timestamp = e.parameter.timestamp;
  
  if (!timestamp) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Timestamp required' })
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
    if (row[0] === timestamp) {
      problems.push({
        timestamp: row[0],
        sessionKey: row[1],
        problemNum: row[2],
        question: row[3],
        a: row[4],
        b: row[5],
        operator: row[6],
        answer: row[7],
        operationType: row[8],
        latency: row[9],
        gameTime: row[10]
      });
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, problems: problems })
  ).setMimeType(ContentService.MimeType.JSON);
}

function deleteSession(e) {
  const timestamp = e.parameter.timestamp;
  
  if (!timestamp) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Timestamp required' })
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
      if (data[i][0] === timestamp) {
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
      if (data[i][0] === timestamp) {
        detailSheet.deleteRow(i + 1);
      }
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: deleted, message: deleted ? 'Session deleted' : 'Session not found' })
  ).setMimeType(ContentService.MimeType.JSON);
}
