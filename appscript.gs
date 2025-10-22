// Google Apps Script - Add this to your Google Sheet
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
        'Operation Type', 'Latency (ms)'
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
        problem.latency || 0
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
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ready' })
  ).setMimeType(ContentService.MimeType.JSON);
}
