// content/inject.js - Simplified tracking script

let currentProblem = null;
let problemStartTime = null;
let gameData = [];
let gameActive = false;
let sessionSaved = false;
let lastScoreCheck = 0;
let maxTimerSeen = 0;
let answerForCurrentProblem = "";

function getCurrentProblem() {
  const problemElement = document.querySelector('span.problem');
  if (problemElement) {
    const text = problemElement.textContent?.trim();
    if (text) {
      const mathMatch = text.match(/(\d+\s*[+\-×÷*\/]\s*\d+)\s*=/);
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

  // Fallback search
  const allElements = document.querySelectorAll('*');
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text && text.length < 100) {
      const timeMatch = text.match(/Seconds left:\s*(\d+)/i) || 
                       text.match(/Time:\s*(\d+)/i) ||
                       text.match(/(\d+)\s*seconds/i);
      
      if (timeMatch) {
        const seconds = parseInt(timeMatch[1]);
        if (seconds >= 0 && seconds <= 300) {
          return seconds;
        }
      }
    }
  }
  return null;
}

function getOperationType(problemText) {
  if (problemText.includes('+')) return 'addition';
  if (problemText.includes('-')) return 'subtraction';
  if (problemText.includes('×') || problemText.includes('*')) return 'multiplication';
  if (problemText.includes('÷') || problemText.includes('/')) return 'division';
  return 'unknown';
}

function logProblemData(question, answer, latency) {
  const problemData = {
    question,
    answer,
    latency,
    operationType: getOperationType(question)
  };
  gameData.push(problemData);
  console.log(`Problem #${gameData.length}: ${question} → ${answer} (${latency}ms)`);
}

function getUserAnswer() {
  const inputField = document.querySelector('input[type="text"]') || 
                     document.querySelector('input[type="number"]') ||
                     document.querySelector('input');
  return inputField ? inputField.value.trim() : "";
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
      
      // Log final problem
      if (currentProblem && problemStartTime) {
        const latency = Date.now() - problemStartTime;
        const finalAnswer = answerForCurrentProblem || "unknown";
        logProblemData(currentProblem, finalAnswer, latency);
      }

      // Match score with tracked problems
      const deficit = score - gameData.length;
      if (deficit > 0) {
        for (let i = 0; i < deficit; i++) {
          gameData.push({
            question: `missed-${gameData.length + 1}`,
            answer: "ultra-fast",
            latency: 0,
            operationType: "unknown"
          });
        }
      } else if (deficit < 0) {
        gameData = gameData.slice(0, score);
      }

      // Save session data
      const sessionData = {
        timestamp: new Date().toISOString(),
        score: score,
        gameUrl: window.location.href,
        problems: gameData
      };

      chrome.storage.local.get('gameSessions', (result) => {
        const gameSessions = result.gameSessions || [];
        gameSessions.push(sessionData);

        chrome.storage.local.set({ gameSessions }, () => {
          console.log('Session saved');
          
          // Send to Google Sheets
          chrome.runtime.sendMessage(
            { action: "sendGameData", data: sessionData },
            (response) => {
              if (response?.success) {
                console.log("Data sent to sheet");
              } else {
                console.error("Error sending data:", response?.error);
              }
            }
          );
        });
      });

      // Reset for next game
      gameActive = false;
      gameData = [];
      lastScoreCheck = 0;
      currentProblem = null;
      problemStartTime = null;
      answerForCurrentProblem = "";
      maxTimerSeen = 0;
    }, 1000);
  } else if (timeRemaining > 0 && sessionSaved) {
    // New game started
    console.log("New game started");
    sessionSaved = false;
    gameActive = true;
    gameData = [];
    lastScoreCheck = 0;
    maxTimerSeen = timeRemaining;
  }
}

function startProblemObserver() {
  console.log("Monitoring started");
  
  gameActive = true;
  gameData = [];
  sessionSaved = false;
  
  const timeRemaining = getTimeRemaining();
  if (timeRemaining !== null) {
    maxTimerSeen = timeRemaining;
  }

  let lastAnswer = "";

  const observer = new MutationObserver(() => {
    // Check for initial problem
    if (!currentProblem) {
      const problem = getCurrentProblem();
      if (problem) {
        currentProblem = problem;
        problemStartTime = Date.now();
        console.log(`Initial problem: ${problem}`);
      }
    }

    // Detect problem changes
    const newProblem = getCurrentProblem();
    if (newProblem && newProblem !== currentProblem && gameActive) {
      if (currentProblem && problemStartTime) {
        const latency = Date.now() - problemStartTime;
        const finalAnswer = answerForCurrentProblem || lastAnswer || "unknown";
        logProblemData(currentProblem, finalAnswer, latency);
      }

      currentProblem = newProblem;
      problemStartTime = Date.now();
      answerForCurrentProblem = "";
      lastAnswer = "";
    }

    // Check score changes
    const currentScore = getScoreValue();
    if (currentScore > lastScoreCheck && gameActive) {
      const scoreIncrease = currentScore - lastScoreCheck;
      if (gameData.length < lastScoreCheck + scoreIncrease) {
        const missed = lastScoreCheck + scoreIncrease - gameData.length;
        for (let i = 0; i < missed; i++) {
          gameData.push({
            question: `missed-${gameData.length + 1}`,
            answer: "ultra-fast",
            latency: 0,
            operationType: "unknown"
          });
        }
      }
      lastScoreCheck = currentScore;
    }

    // Capture current answer
    const currentAnswer = getUserAnswer();
    if (currentAnswer && currentAnswer !== lastAnswer) {
      lastAnswer = currentAnswer;
      answerForCurrentProblem = currentAnswer;
    }

    checkGameEnd();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Capture input events
  document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.value) {
      answerForCurrentProblem = e.target.value;
      lastAnswer = e.target.value;
    }
  });

  // Polling for missed answers
  setInterval(() => {
    if (gameActive) {
      const answer = getUserAnswer();
      if (answer && answer !== lastAnswer) {
        lastAnswer = answer;
        answerForCurrentProblem = answer;
      }
    }
  }, 50);
}

setTimeout(() => {
  console.log("Starting monitoring...");
  startProblemObserver();
}, 1000);
