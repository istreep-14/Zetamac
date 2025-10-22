// content/inject.js - Fixed version with proper problem parsing

let currentProblem = null;
let problemStartTime = null;
let gameData = [];
let gameActive = false;
let sessionSaved = false;
let lastScoreCheck = 0;
let maxTimerSeen = 0;

// Game settings database
const GAME_SETTINGS = {
  '72740d67': { mode: 'Normal', duration: 30 },
  '0172800b': { mode: 'Normal', duration: 60 },
  'a7220a92': { mode: 'Normal', duration: 120 },
  '215bc31a': { mode: 'Normal', duration: 300 },
  '97382c35': { mode: 'Normal', duration: 600 },
  'c9750470': { mode: 'Hard', duration: 30 },
  'ac954fea': { mode: 'Hard', duration: 60 },
  '5ae295b0': { mode: 'Hard', duration: 120 },
  '04e52452': { mode: 'Hard', duration: 300 },
  '7ca8f568': { mode: 'Hard', duration: 600 }
};

function getGameSettings() {
  const url = window.location.href;
  const keyMatch = url.match(/key=([a-f0-9]+)/);
  
  if (keyMatch && GAME_SETTINGS[keyMatch[1]]) {
    return {
      key: keyMatch[1],
      ...GAME_SETTINGS[keyMatch[1]]
    };
  }
  
  return { key: 'unknown', mode: 'Unknown', duration: null };
}

function parseProblem(problemText) {
  const clean = problemText.replace(/\s+/g, ' ').trim();
  
  // Match different operator formats
  const addMatch = clean.match(/(\d+)\s*\+\s*(\d+)/);
  const subMatch = clean.match(/(\d+)\s*[-–—]\s*(\d+)/);
  const mulMatch = clean.match(/(\d+)\s*[×x*]\s*(\d+)/);
  const divMatch = clean.match(/(\d+)\s*[÷/]\s*(\d+)/);
  
  if (addMatch) {
    const a = parseInt(addMatch[1]);
    const b = parseInt(addMatch[2]);
    return {
      question: clean,
      a: a,
      b: b,
      c: a + b,
      operationType: 'addition'
    };
  } else if (subMatch) {
    const c = parseInt(subMatch[1]);
    const a = parseInt(subMatch[2]);
    const b = c - a;
    return {
      question: clean,
      a: a,
      b: b,
      c: c,
      operationType: 'subtraction'
    };
  } else if (mulMatch) {
    const a = parseInt(mulMatch[1]);
    const b = parseInt(mulMatch[2]);
    return {
      question: clean,
      a: a,
      b: b,
      c: a * b,
      operationType: 'multiplication'
    };
  } else if (divMatch) {
    const c = parseInt(divMatch[1]);
    const a = parseInt(divMatch[2]);
    const b = Math.floor(c / a);
    return {
      question: clean,
      a: a,
      b: b,
      c: c,
      operationType: 'division'
    };
  }
  
  return null;
}

function getCurrentProblem() {
  const problemElement = document.querySelector('span.problem');
  if (problemElement) {
    const text = problemElement.textContent?.trim();
    if (text) {
      const mathMatch = text.match(/(\d+\s*[+\-–—×x*÷\/]\s*\d+)/);
      if (mathMatch && mathMatch[1].length < 30) {
        return mathMatch[1].replace(/\s+/g, ' ').trim();
      }
    }
  }
  return null;
}

function getScoreValue() {
  const allElements = document.querySelectorAll('*');
  let foundScore = 0;

  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text) {
      const scoreMatch = text.match(/(?:Final score:|Your final score:|Score:)\s*(\d+)/i);
      if (scoreMatch) {
        foundScore = Math.max(foundScore, parseInt(scoreMatch[1]));
      }
    }
  }
  return foundScore;
}

function getTimeRemaining() {
  const selectors = ['#game .left', 'span.left', '#game span:first-child'];
  
  for (let selector of selectors) {
    const timerElement = document.querySelector(selector);
    if (timerElement) {
      const text = timerElement.textContent?.trim();
      const timeMatch = text?.match(/Seconds left:\s*(\d+)/i);
      if (timeMatch) {
        return parseInt(timeMatch[1]);
      }
    }
  }

  const allElements = document.querySelectorAll('*');
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text && text.length < 100) {
      const timeMatch = text.match(/Seconds left:\s*(\d+)/i);
      if (timeMatch) {
        const seconds = parseInt(timeMatch[1]);
        if (seconds >= 0 && seconds <= 600) {
          return seconds;
        }
      }
    }
  }
  return null;
}

function logProblemData(problemText, latency) {
  const parsed = parseProblem(problemText);
  
  if (parsed) {
    gameData.push({
      question: parsed.question,
      a: parsed.a,
      b: parsed.b,
      c: parsed.c,
      operationType: parsed.operationType,
      latency: latency
    });
    console.log(`Problem #${gameData.length}: ${parsed.operationType} [${parsed.a}, ${parsed.b}, ${parsed.c}] (${latency}ms)`);
  } else {
    gameData.push({
      question: problemText,
      a: '',
      b: '',
      c: '',
      operationType: 'unknown',
      latency: latency
    });
    console.log(`Problem #${gameData.length}: ${problemText} (${latency}ms) [parse failed]`);
  }
}

function checkGameEnd() {
  const timeRemaining = getTimeRemaining();

  if (timeRemaining !== null && timeRemaining > maxTimerSeen) {
    maxTimerSeen = timeRemaining;
  }

  if (timeRemaining === 0 && gameActive && !sessionSaved) {
    console.log("Game ended");
    sessionSaved = true;

    setTimeout(() => {
      const score = getScoreValue();
      const settings = getGameSettings();
      
      if (currentProblem && problemStartTime) {
        const latency = Date.now() - problemStartTime;
        logProblemData(currentProblem, latency);
      }

      const deficit = score - gameData.length;
      if (deficit > 0) {
        console.log(`Adding ${deficit} ultra-fast problems`);
        for (let i = 0; i < deficit; i++) {
          gameData.push({
            question: `ultra-fast-${gameData.length + 1}`,
            a: '',
            b: '',
            c: '',
            operationType: 'unknown',
            latency: 0
          });
        }
      } else if (deficit < 0) {
        gameData = gameData.slice(0, score);
      }

      const duration = settings.duration || maxTimerSeen || 120;
      const scorePerSecond = score / duration;
      const normalized120 = scorePerSecond * 120;

      const sessionData = {
        timestamp: new Date().toISOString(),
        score: score,
        scorePerSecond: parseFloat(scorePerSecond.toFixed(3)),
        normalized120: parseFloat(normalized120.toFixed(1)),
        key: settings.key,
        mode: settings.mode,
        duration: duration,
        gameUrl: window.location.href,
        problems: gameData
      };

      console.log(`Session complete: ${score} points (${scorePerSecond.toFixed(2)}/s, normalized: ${normalized120.toFixed(1)})`);

      chrome.storage.local.get('gameSessions', (result) => {
        const gameSessions = result.gameSessions || [];
        gameSessions.push(sessionData);

        chrome.storage.local.set({ gameSessions }, () => {
          console.log('Session saved to local storage');
          
          chrome.runtime.sendMessage(
            { action: "sendGameData", data: sessionData },
            (response) => {
              if (response?.success) {
                console.log("Data sent to Google Sheets");
              } else {
                console.error("Error sending data:", response?.error);
              }
            }
          );
        });
      });

      gameActive = false;
      gameData = [];
      lastScoreCheck = 0;
      currentProblem = null;
      problemStartTime = null;
      maxTimerSeen = 0;
    }, 1000);
  } else if (timeRemaining > 0 && sessionSaved) {
    console.log(`New game started (${getGameSettings().mode} ${getGameSettings().duration}s)`);
    sessionSaved = false;
    gameActive = true;
    gameData = [];
    lastScoreCheck = 0;
    maxTimerSeen = timeRemaining;
  }
}

function startProblemObserver() {
  console.log("Monitoring started");
  
  const settings = getGameSettings();
  console.log(`Game settings: ${settings.mode} mode, ${settings.duration}s duration (key: ${settings.key})`);
  
  gameActive = true;
  gameData = [];
  sessionSaved = false;
  
  const timeRemaining = getTimeRemaining();
  if (timeRemaining !== null) {
    maxTimerSeen = timeRemaining;
  }

  // Wait for initial problem to appear
  let initializationAttempts = 0;
  const waitForFirstProblem = setInterval(() => {
    const firstProblem = getCurrentProblem();
    if (firstProblem) {
      currentProblem = firstProblem;
      problemStartTime = Date.now();
      console.log(`First problem detected: ${firstProblem}`);
      clearInterval(waitForFirstProblem);
    }
    initializationAttempts++;
    if (initializationAttempts > 20) clearInterval(waitForFirstProblem);
  }, 50);

  let lastProblemCheck = "";
  let lastKnownScore = 0;
  
  const observer = new MutationObserver(() => {
    const newProblem = getCurrentProblem();
    
    // Track problem changes
    if (newProblem && newProblem !== currentProblem && newProblem !== lastProblemCheck && gameActive) {
      if (currentProblem && problemStartTime) {
        const latency = Date.now() - problemStartTime;
        logProblemData(currentProblem, latency);
      }

      currentProblem = newProblem;
      problemStartTime = Date.now();
      lastProblemCheck = newProblem;
    }

    // Check score to catch missed problems
    const currentScore = getScoreValue();
    if (currentScore > lastKnownScore && gameActive) {
      const deficit = currentScore - gameData.length;
      if (deficit > 0) {
        console.log(`Score is ${currentScore}, logged ${gameData.length} - deficit: ${deficit}`);
        // Only add ultra-fast if we're significantly behind
        if (deficit > 1) {
          for (let i = 0; i < deficit - 1; i++) {
            gameData.push({
              question: `ultra-fast-${gameData.length + 1}`,
              a: '',
              b: '',
              c: '',
              operationType: 'unknown',
              latency: 0
            });
          }
        }
      }
      lastKnownScore = currentScore;
    }

    checkGameEnd();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // More aggressive polling for fast solvers
  setInterval(() => {
    if (gameActive) {
      const newProblem = getCurrentProblem();
      if (newProblem && newProblem !== currentProblem && newProblem !== lastProblemCheck) {
        if (currentProblem && problemStartTime) {
          const latency = Date.now() - problemStartTime;
          logProblemData(currentProblem, latency);
        }
        currentProblem = newProblem;
        problemStartTime = Date.now();
        lastProblemCheck = newProblem;
      }
    }
  }, 25);
}

setTimeout(() => {
  console.log("Starting Zetamac monitoring...");
  startProblemObserver();
}, 1000);
