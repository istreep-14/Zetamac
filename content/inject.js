// problem tracking extension

let currentProblem = null;
let problemStartTime = null;
let gameData = [];
let userAnswer = "";
let gameActive = false;
let sessionSaved = false;
let lastScore = 0;
let lastScoreCheck = 0;
let initialGameDuration = null;
let maxTimerSeen = 0;

// Removed Firebase authentication and saving functions

function isTokenExpired(tokenTimestamp) {
  // This function is no longer needed as we're not using Firebase auth
  return false; // Always return false to avoid issues
}

async function ensureValidToken() {
  // This function is no longer needed as we're not using Firebase auth
  return {}; // Return empty object
}

function getCurrentProblem() {
  const problemElement = document.querySelector('span.problem'); // Use the specific selector found during inspection
  if (problemElement) {
    const text = problemElement.textContent?.trim();
    if (text) {
      const mathMatch = text.match(/(\d+\s*[+\\-×÷*\\/]\\s*\\d+)\s*=/);
      if (mathMatch) {
        const problem = mathMatch[1].replace(/\s+/g, ' ').trim();
        // Re-evaluate these conditions based on your observation
        if (problem.length < 30) { // Maybe adjust length limit
          return problem;
        }
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
      let scoreMatch = text.match(/Score:\s*(\d+)/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        foundScore = Math.max(foundScore, score);
      }
    }
  }

  return foundScore;
}

function getGameScore() {
  const allElements = document.querySelectorAll('*');
  let foundScore = 0;

  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text) {
      // try multiple score patterns
      let scoreMatch = text.match(/Score:\s*(\d+)/);
      if (!scoreMatch) {
        scoreMatch = text.match(/Final score:\s*(\d+)/);
      }
      if (!scoreMatch) {
        scoreMatch = text.match(/Your final score:\s*(\d+)/);
      }

      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        foundScore = Math.max(foundScore, score);
      }
    }
  }

  return foundScore;
}

function getTimeRemaining() {
  // try specific selectors for zetamac timer
  const selectors = [
    '#game .left',
    'span.left',
    '#game span:first-child',
    'body > div:nth-child(2) > span:first-child'
  ];

  for (let selector of selectors) {
    const timerElement = document.querySelector(selector);
    if (timerElement) {
      const text = timerElement.textContent?.trim();
      console.log(`Timer element found with selector "${selector}", text: "${text}"`);

      if (text) {
        let timeMatch = text.match(/Seconds left:\s*(\d+)/i);
        if (timeMatch) {
          const seconds = parseInt(timeMatch[1]);
          console.log(`Timer detected: ${seconds} seconds remaining`);
          return seconds;
        }
      }
    }
  }

  // fallback search all elements for timer patterns
  const allElements = document.querySelectorAll('*');

  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text && text.length < 100) { // only check short text elements
      // try various timer patterns
      let timeMatch = text.match(/Seconds left:\s*(\d+)/i);
      if (!timeMatch) {
        timeMatch = text.match(/Time:\s*(\d+)/i);
      }
      if (!timeMatch) {
        timeMatch = text.match(/(\d+)\s*seconds/i);
      }
      if (!timeMatch) {
        timeMatch = text.match(/(\d{1,2}):(\d{2})/); // MM:SS format
      }

      if (timeMatch) {
        let seconds;
        if (timeMatch[2] !== undefined) {
          // mm:ss format
          seconds = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        } else {
          seconds = parseInt(timeMatch[1]);
        }

        // only consider reasonable timer values
        if (seconds >= 0 && seconds <= 300) {
          console.log(`Timer detected via fallback: ${seconds} seconds remaining from element with text: "${text}"`);
          return seconds;
        } else {
          console.log(`Invalid timer value ${seconds} from text: "${text}"`);
        }
      }
    }
  }

  console.log("No timer found with any method");
  return null;
}

function detectGameDuration() {
  // use max timer value seen during game instead of current timer
  const timerValue = maxTimerSeen;

  if (timerValue === 0) {
    return null;
  }

  // based on max timer value seen during game
  if (timerValue > 90) {
    return 120;
  } else if (timerValue > 60) {
    return 90;
  } else if (timerValue > 30) {
    return 60;
  } else if (timerValue > 0) {
    return 30;
  }

  return null;
}

// **--- REMOVED sendGameDataToGoogleSheet function from here ---**
// This function will now live in your background script (index.js)


function checkGameEnd() {
  const timeRemaining = getTimeRemaining();

  // track max timer value seen
  if (timeRemaining !== null && timeRemaining > maxTimerSeen) {
    maxTimerSeen = timeRemaining;
    console.log(`Max timer updated: ${maxTimerSeen}s`);
  }

  // detect game duration if we haven't already and we're in an active game
  if (timeRemaining !== null && gameActive && initialGameDuration === null) {
    const detectedDuration = detectGameDuration();
    if (detectedDuration) {
      initialGameDuration = detectedDuration;
      console.log(`Game duration detected: ${initialGameDuration}s (max timer seen: ${maxTimerSeen}s, current: ${timeRemaining}s)`);
    }
  }

  if (timeRemaining !== null) {
    if (timeRemaining === 0 && gameActive && !sessionSaved) {
      console.log("Game ended - timer reached 0");
      sessionSaved = true;

      setTimeout(() => {
        const score = getGameScore();
        const gameUrl = window.location.href; // Get gameUrl here

        // log final problem if we were working on one
        if (currentProblem && problemStartTime) {
          const latency = Date.now() - problemStartTime;
          // use the most recent answer we captured
          const finalAnswer = answerForCurrentProblem || userAnswer || "unknown";
          console.log(`Final problem capture: problem="${currentProblem}", answerForCurrentProblem="${answerForCurrentProblem}", userAnswer="${userAnswer}", finalAnswer="${finalAnswer}"`);
          logProblemData(currentProblem, finalAnswer, latency);
        }

        // ensure count matches score
        const deficit = score - gameData.length;
        if (deficit > 0) {
          console.log(`Adding ${deficit} final placeholders to match score`);
          for (let i = 0; i < deficit; i++) {
            const placeholderProblem = {
              question: `missed-${gameData.length + 1}`,
              answer: "ultra-fast",
              latency: 0,
              operationType: "unknown" // Operation type is unknown for missed problems
            };
            gameData.push(placeholderProblem);
          }
        } else if (deficit < 0) {
          console.warn(`More problems tracked than score - removing ${Math.abs(deficit)} excess`);
          gameData = gameData.slice(0, score);
        }

        // show all problems captured
        console.log("Problems captured:", gameData.map((p, i) => `${i+1}: ${p.question} → ${p.answer} (${p.latency}ms)`));

        // validation
        if (gameData.length === score) {
          console.log(`Perfect match: Score ${score}, Problems tracked ${gameData.length}`);
        } else {
          console.warn(`Count mismatch: Score ${score}, Problems tracked ${gameData.length}`);
        }

        // **--- MODIFIED: Save data to local storage and send message to background script ---**
        const sessionData = {
          timestamp: new Date().toISOString(),
          score: score,
          gameUrl: gameUrl,
          problems: gameData // Send the array of problem objects
        };

        chrome.storage.local.get('gameSessions', function(result) {
            let gameSessions = result.gameSessions || [];
            gameSessions.push(sessionData);

            chrome.storage.local.set({ 'gameSessions': gameSessions }, function() {
                console.log('Game session data saved to local storage.');
                if (chrome.runtime.lastError) {
                    console.error('Error saving to local storage:', chrome.runtime.lastError);
                } else {
                    // **Send message to background script to send data to sheet**
                    chrome.runtime.sendMessage({ action: "sendGameData", data: sessionData }, function(response) {
                        if (response && response.status === "success") {
                            console.log("Message sent to background script successfully.");
                        } else {
                            console.error("Error sending message to background script:", response ? response.error : "No response");
                        }
                    });
                }
            });
        });

        gameActive = false;
        gameData = [];
        lastScore = 0;
        lastScoreCheck = 0;
        currentProblem = null;
        problemStartTime = null;
        answerForCurrentProblem = "";
        initialGameDuration = null;
        maxTimerSeen = 0;
        sessionSaved = false; // Reset sessionSaved for the next game
      }, 1000); // Short delay to ensure score is final
    } else if (timeRemaining > 0 && sessionSaved) {
      // new game started
      console.log("New game detected - timer went from 0 to", timeRemaining);
      sessionSaved = false;
      gameActive = true;
      gameData = [];
      lastScoreCheck = 0;
      answerForCurrentProblem = "";
      maxTimerSeen = timeRemaining;
      initialGameDuration = null;
      console.log(`Starting new game (timer at ${timeRemaining}s)`);
    }
  }
}

function getOperationType(problemText) {
  if (problemText.includes('+')) return 'addition';
  if (problemText.includes('-')) return 'subtraction';
  if (problemText.includes('×') || problemText.includes('*')) return 'multiplication';
  if (problemText.includes('÷') || problemText.includes('/')) return 'division';
  return 'unknown';
}

function logProblemData(question, answer, latency) {
  const operationType = getOperationType(question);
  const problemData = { question, answer, latency, operationType };
  gameData.push(problemData);
  console.log(`Problem #${gameData.length}: ${question} → ${answer} (${latency}ms, ${operationType})`);
}

function getUserAnswer() {
  // try multiple selectors for input field
  let inputField = document.querySelector('input[type="text"]');
  if (!inputField) {
    inputField = document.querySelector('input[type="number"]');
  }
  if (!inputField) {
    inputField = document.querySelector('input');
  }
  if (!inputField) {
    inputField = document.querySelector('#answer');
  }

  // log all input fields if we can't find one
  if (!inputField) {
    const allInputs = document.querySelectorAll('input');
    console.log(`Found ${allInputs.length} input fields:`, Array.from(allInputs).map(inp => ({
      type: inp.type,
      id: inp.id,
      className: inp.className,
      value: inp.value
    })));
    return "";
  }

  return inputField ? inputField.value.trim() : "";
}

// Removed Firebase authentication refresh functions


// answer tracking for current problem
let answerForCurrentProblem = "";

function startProblemObserver() {
  console.log("monitoring started");

  gameActive = true;
  lastScore = 0;
  lastScoreCheck = 0;
  gameData = [];
  sessionSaved = false; // Ensure this is false at the start of a new monitoring session

  // initialize max timer tracking and try to detect game duration
  const timeRemaining = getTimeRemaining();
  if (timeRemaining !== null) {
    maxTimerSeen = timeRemaining;
    const detectedDuration = detectGameDuration();
    if (detectedDuration) {
      initialGameDuration = detectedDuration;
      console.log(`Initial game duration detected: ${initialGameDuration}s (timer at ${timeRemaining}s)`);
    }
  }

  // try to detect the first problem
  let initialDetectionCount = 0;
  const detectInitialProblem = () => {
    const initialProblem = getCurrentProblem();
    initialDetectionCount++;
    console.log(`Attempt ${initialDetectionCount}: Looking for initial problem, found: "${initialProblem}", currentProblem: "${currentProblem}"`);

    if (initialProblem && !currentProblem) {
      currentProblem = initialProblem;
      problemStartTime = Date.now();
      console.log(`Initial problem detected on attempt ${initialDetectionCount}: ${initialProblem}`);
    } else if (initialDetectionCount < 10) {
      // keep trying for 1 second
      setTimeout(detectInitialProblem, 100);
    } else {
      console.log("Failed to detect initial problem after 10 attempts");
    }
  };

  detectInitialProblem();

  let lastAnswer = "";

  const observer = new MutationObserver((mutations) => {
    // *** Initial check for currentProblem null (keep this) ***
    if (!currentProblem) {
      const initialProblem = getCurrentProblem();
      if (initialProblem) {
        currentProblem = initialProblem;
        problemStartTime = Date.now();
        console.log(`Problem detected by observer initially: ${initialProblem}`);
        // No need to process mutations further if initial problem is found
        return;
      }
    }
    // *** End of initial check ***


    for (let mutation of mutations) {
      // Check if the mutation involves the problem element
      if (mutation.target && mutation.target.matches('span.problem')) {
        const newProblem = mutation.target.textContent?.trim();

        if (newProblem && newProblem !== currentProblem && gameActive) {
          console.log(`Problem change detected via mutation: "${currentProblem}" → "${newProblem}"`);

          // log the previous problem if we had one
          if (currentProblem && problemStartTime) {
            const latency = Date.now() - problemStartTime;
            const finalAnswer = answerForCurrentProblem || lastAnswer || "unknown"; // Use lastAnswer as a fallback
            logProblemData(currentProblem, finalAnswer, latency);
          }

          // set up for new problem
          currentProblem = newProblem;
          problemStartTime = Date.now();
          answerForCurrentProblem = ""; // Reset answer for the new problem
          lastAnswer = ""; // Reset lastAnswer as well
          // Break the loop after finding a problem change
          break;
        }
      }
      // Also check if problem element is added to the DOM
      if (mutation.addedNodes) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('span.problem')) {
             const newProblem = node.textContent?.trim();
             if (newProblem && newProblem !== currentProblem && gameActive) {
                console.log(`Problem element added detected via mutation: "${currentProblem}" → "${newProblem}"`);

                // log the previous problem if we had one
                if (currentProblem && problemStartTime) {
                  const latency = Date.now() - problemStartTime;
                  const finalAnswer = answerForCurrentProblem || lastAnswer || "unknown"; // Use lastAnswer as a fallback
                  logProblemData(currentProblem, finalAnswer, latency);
                }

                // set up for new problem
                currentProblem = newProblem;
                problemStartTime = Date.now();
                answerForCurrentProblem = ""; // Reset answer for the new problem
                lastAnswer = ""; // Reset lastAnswer as well
                // Break the outer loop as well
                break;
              }
          }
        }
      }
    }


    // check score to detect missed problems (keep this existing logic)
    const currentScore = getScoreValue();
    if (currentScore > lastScoreCheck && gameActive) {
      const scoreIncrease = currentScore - lastScoreCheck;
      console.log(`Score increased from ${lastScoreCheck} to ${currentScore} (+${scoreIncrease})`);

      // only add placeholders for score increases we didn't track
      // Check if the score increased *after* a problem change was detected
      // If score increased by more than 1, and we only logged 1 problem, add placeholders
      const problemsLoggedSinceLastCheck = gameData.length - (lastScoreCheck === 0 ? 0 : gameData.filter((_, index) => index >= gameData.findIndex(p => p === gameData.slice(lastScoreCheck - 1)[0])).length); // This logic might need refinement depending on exact timing

       // Simplified placeholder logic: if score increased and no problem was logged since last score check, assume missed
       if (scoreIncrease > 0 && (gameData.length === lastScoreCheck || (gameData.length > lastScoreCheck && gameData[gameData.length - 1].question.startsWith('missed-')))) {
            console.warn(`Score increased by ${scoreIncrease}, adding ${scoreIncrease} missed problems.`);
            for (let i = 0; i < scoreIncrease; i++) {
                const placeholderProblem = {
                    question: `missed-${gameData.length + 1}`,
                    answer: "ultra-fast",
                    latency: 0,
                    operationType: "unknown"
                };
                gameData.push(placeholderProblem);
                console.log(`Added placeholder problem #${gameData.length}: missed ultra-fast answer`);
            }
       }


      lastScoreCheck = currentScore;
    }


    // capture current answer after checking for problem changes (keep this existing logic)
    const currentAnswer = getUserAnswer();
    if (currentAnswer && currentAnswer !== lastAnswer) {
      lastAnswer = currentAnswer;
      answerForCurrentProblem = currentAnswer;
      // console.log(`Answer captured immediately: ${currentAnswer} for problem: ${currentProblem}`); // Reduced logging frequency
    }

    // check for game end (keep this existing logic)
    checkGameEnd();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    characterDataOldValue: true
  });

  // capture answers from all input events
  document.addEventListener('input', (event) => {
    // console.log(`Input event: target=${event.target.tagName}, value="${event.target.value}"`); // Reduced logging frequency
    if (event.target.tagName === 'INPUT') {
      userAnswer = event.target.value;
      if (event.target.value !== lastAnswer && event.target.value.length > 0) {
        lastAnswer = event.target.value;
        answerForCurrentProblem = event.target.value;
        // console.log(`Answer captured immediately: ${event.target.value} for problem: ${currentProblem}`); // Reduced logging frequency
      }
    }
  });

  // capture on keydown, keyup, change
  ['keydown', 'keyup', 'change', 'paste'].forEach(eventType => {
    document.addEventListener(eventType, (event) => {
      if (event.target.tagName === 'INPUT') {
        // small delay to let the value update
        setTimeout(() => {
          const value = event.target.value;
          if (value && value !== lastAnswer) {
            lastAnswer = value;
            answerForCurrentProblem = value;
            // console.log(`Answer from ${eventType}: ${value} for problem: ${currentProblem}`); // Reduced logging frequency
          }
        }, 1);
      }
    });
  });

  // polling to catch missed answers
  setInterval(() => {
    if (gameActive) {
      const currentAnswer = getUserAnswer();
      if (currentAnswer && currentAnswer !== lastAnswer) {
        lastAnswer = currentAnswer;
        answerForCurrentProblem = currentAnswer;
        // console.log(`Answer from polling: ${currentAnswer} for problem: ${currentProblem}`); // Reduced logging frequency
      }
    }
  }, 50); // Reduced polling frequency


}

setTimeout(() => {
  console.log("starting monitoring...");
  startProblemObserver();
}, 1000);
