/**
 * E.D.I.T.H. Core Application Coordinator
 * Binds UI, Canvas Visualizer, Voice Engine, and WebSocket streaming together.
 */
document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const stateText = document.getElementById('stateText');
  const stateSubtext = document.getElementById('stateSubtext');
  const liveTranscriptText = document.getElementById('liveTranscriptText');
  const conversationFeed = document.getElementById('conversationFeed');
  const micBtn = document.getElementById('micBtn');
  const bargeInBtn = document.getElementById('bargeInBtn');
  const continuousToggle = document.getElementById('continuousToggle');
  const wakeWordToggle = document.getElementById('wakeWordToggle');
  const textQueryForm = document.getElementById('textQueryForm');
  const textQueryInput = document.getElementById('textQueryInput');
  const hudClock = document.getElementById('hudClock');
  const networkStatusDot = document.getElementById('networkStatusDot');
  const networkStatusText = document.getElementById('networkStatusText');
  
  // Modals
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const modelSelect = document.getElementById('modelSelect');
  const voiceSelect = document.getElementById('voiceSelect');
  const voiceRateSlider = document.getElementById('voiceRateSlider');
  const voiceRateVal = document.getElementById('voiceRateVal');
  const testVoiceBtn = document.getElementById('testVoiceBtn');
  
  const memoryBtn = document.getElementById('memoryBtn');
  const memoryModal = document.getElementById('memoryModal');
  const closeMemoryBtn = document.getElementById('closeMemoryBtn');
  const memoryList = document.getElementById('memoryList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Initialize Visualizer
  const visualizer = new EdithVisualizer('arcVisualizerCanvas');

  // Initialize Voice Engine
  const voiceEngine = new EdithVoiceEngine({
    onTranscript: (finalText) => {
      liveTranscriptText.textContent = `"${finalText}"`;
      // Send to backend via WebSocket
      wsClient.sendVoiceInput(finalText);
    },
    onInterim: (interimText) => {
      liveTranscriptText.textContent = `"${interimText}..."`;
    },
    onAudioData: (audioData) => {
      visualizer.setAudioData(audioData);
    },
    onStateChange: (state) => {
      updateSystemState(state);
    },
    onError: (errMsg) => {
      liveTranscriptText.textContent = `[E.D.I.T.H.] ⚠️ ${errMsg}`;
      appendFeedMessage('assistant', `⚠️ ${errMsg}`);
    }
  });

  // Initialize WebSocket Client
  const wsClient = new EdithWebSocketClient({
    onStatusChange: (connected, isServerless) => {
      if (connected) {
        networkStatusDot.style.background = '#10b981';
        networkStatusDot.style.boxShadow = '0 0 8px #10b981';
        networkStatusText.textContent = isServerless ? 'NEURAL LINK (VERCEL CLOUD)' : 'NEURAL LINK ACTIVE';
      } else {
        networkStatusDot.style.background = '#ef4444';
        networkStatusDot.style.boxShadow = '0 0 8px #ef4444';
        networkStatusText.textContent = 'LINK RECONNECTING...';
      }
    },
    onMessage: (msg) => {
      handleServerMessage(msg);
    }
  });

  // State Management
  function updateSystemState(state) {
    visualizer.setState(state);
    stateText.className = `state-indicator ${state}`;

    if (state === 'listening') {
      stateText.textContent = 'LISTENING';
      stateSubtext.textContent = 'Voice detection active // Say your query';
      micBtn.classList.add('active');
      bargeInBtn.classList.remove('visible');
    } else if (state === 'thinking') {
      stateText.textContent = 'COGNITIVE PROCESSING';
      stateSubtext.textContent = 'Reasoning & accessing neural modules';
      bargeInBtn.classList.remove('visible');
    } else if (state === 'speaking') {
      stateText.textContent = 'VOCAL SYNTHESIS';
      stateSubtext.textContent = 'Transmitting response // Speak to interrupt';
      micBtn.classList.remove('active');
      bargeInBtn.classList.add('visible');
    } else {
      stateText.textContent = 'SYSTEM STANDBY';
      stateSubtext.textContent = 'Click microphone or activate continuous listening';
      micBtn.classList.remove('active');
      bargeInBtn.classList.remove('visible');
    }
  }

  // Handle incoming messages from backend
  function handleServerMessage(msg) {
    if (msg.type === 'ready') {
      if (!msg.has_api_key) {
        liveTranscriptText.textContent = 'Ready. For full Gemini neural reasoning, add your API key in Settings (⚙️).';
      } else {
        liveTranscriptText.textContent = 'E.D.I.T.H. initialized and standing by.';
      }
    } else if (msg.type === 'user_message') {
      appendFeedMessage('user', msg.text);
      updateSystemState('thinking');
    } else if (msg.type === 'status') {
      liveTranscriptText.textContent = `[E.D.I.T.H.] ${msg.message}`;
    } else if (msg.type === 'tool_call') {
      appendToolCard(msg.tool, msg.args, msg.message);
    } else if (msg.type === 'response') {
      appendFeedMessage('assistant', msg.text, msg.tools_used);
      liveTranscriptText.textContent = `[E.D.I.T.H.] "${msg.text}"`;
      // Speak the response hands-free!
      voiceEngine.speak(msg.text);
    } else if (msg.type === 'error') {
      appendFeedMessage('assistant', `⚠️ ${msg.message}`);
    }
  }

  // Feed rendering
  function appendFeedMessage(role, text, toolsUsed = []) {
    const item = document.createElement('div');
    item.className = `feed-item ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'feed-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'feed-meta';
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    meta.textContent = `${role === 'user' ? 'YOU' : 'E.D.I.T.H.'} • ${now}`;

    item.appendChild(bubble);
    item.appendChild(meta);

    if (role === 'assistant') {
      const replayBtn = document.createElement('button');
      replayBtn.className = 'replay-audio-btn';
      replayBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg> Replay Audio
      `;
      replayBtn.onclick = () => voiceEngine.speak(text);
      item.appendChild(replayBtn);
    }

    conversationFeed.appendChild(item);
    conversationFeed.scrollTop = conversationFeed.scrollHeight;
  }

  function appendToolCard(toolName, args, message) {
    const card = document.createElement('div');
    card.className = 'tool-execution-card';
    card.innerHTML = `
      <div class="tool-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>TACTICAL TOOL: ${toolName}</span>
      </div>
      <div>${message || JSON.stringify(args)}</div>
    `;
    conversationFeed.appendChild(card);
    conversationFeed.scrollTop = conversationFeed.scrollHeight;
  }

  // Live HUD Clock
  function updateClock() {
    const now = new Date();
    hudClock.textContent = now.toLocaleTimeString([], { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Microphone toggle button
  micBtn.addEventListener('click', async () => {
    // Unlock AudioContext on user click (browser audio policy)
    if (voiceEngine.audioCtx && voiceEngine.audioCtx.state === 'suspended') {
      try { await voiceEngine.audioCtx.resume(); } catch (e) {}
    }
    const isNowListening = voiceEngine.toggleListening();
    if (isNowListening) {
      if (voiceEngine.wakeWordOnly) {
        liveTranscriptText.textContent = 'Listening (Wake-word mode). Say "EDITH" followed by your command.';
      } else {
        liveTranscriptText.textContent = 'Listening... Speak your command.';
      }
    } else {
      liveTranscriptText.textContent = 'Microphone standby. Click to activate voice control.';
    }
  });

  // Barge-In Stop button
  bargeInBtn.addEventListener('click', () => {
    voiceEngine.stopSpeaking();
  });

  // Continuous hands-free toggle
  continuousToggle.addEventListener('change', (e) => {
    voiceEngine.continuousMode = e.target.checked;
    if (e.target.checked && !voiceEngine.isListening) {
      voiceEngine.startListening();
      liveTranscriptText.textContent = 'Continuous hands-free listening enabled.';
    } else if (!e.target.checked && voiceEngine.isListening) {
      liveTranscriptText.textContent = 'Continuous mode disabled.';
    }
  });

  // Wake word toggle
  wakeWordToggle.addEventListener('change', (e) => {
    voiceEngine.wakeWordOnly = e.target.checked;
    if (e.target.checked) {
      liveTranscriptText.textContent = 'Wake-Word Mode active. Say "EDITH" or "Hey EDITH" to command.';
    } else {
      liveTranscriptText.textContent = 'Open-mic mode active. Speak naturally.';
    }
  });

  // Text input fallback
  textQueryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = textQueryInput.value.trim();
    if (!query) return;
    textQueryInput.value = '';
    wsClient.sendTextInput(query);
  });

  // Suggestion chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) {
        liveTranscriptText.textContent = `"${prompt}"`;
        wsClient.sendTextInput(prompt);
      }
    });
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', () => {
    conversationFeed.innerHTML = '';
    wsClient.resetSession();
    liveTranscriptText.textContent = 'Cognitive buffer cleared.';
  });

  // Settings Modal Handlers
  settingsBtn.addEventListener('click', async () => {
    settingsModal.classList.add('active');
    populateVoicesList();
    // Fetch current status from server
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.model) modelSelect.value = data.model;
      if (data.has_api_key) apiKeyInput.placeholder = `Configured: ${data.api_key_masked}`;
    } catch (e) {}
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  saveSettingsBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, model: model })
      });
      const data = await res.json();
      if (data.success) {
        alert("Settings successfully saved!");
        settingsModal.classList.remove('active');
      }
    } catch (e) {
      alert("Failed to save settings: " + e);
    }
  });

  function populateVoicesList() {
    const voices = voiceEngine.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (voiceEngine.selectedVoice && voiceEngine.selectedVoice.name === v.name) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  voiceSelect.addEventListener('change', (e) => {
    voiceEngine.setVoice(e.target.value);
  });

  voiceRateSlider.addEventListener('input', (e) => {
    const rate = parseFloat(e.target.value);
    voiceEngine.voiceRate = rate;
    voiceRateVal.textContent = `${rate}x`;
  });

  testVoiceBtn.addEventListener('click', () => {
    voiceEngine.speak("Voice output operational. All systems running smoothly.");
  });

  // Memory Modal Handlers
  memoryBtn.addEventListener('click', async () => {
    memoryModal.classList.add('active');
    loadMemoryList();
  });

  closeMemoryBtn.addEventListener('click', () => {
    memoryModal.classList.remove('active');
  });

  async function loadMemoryList() {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      memoryList.innerHTML = '';

      if (data.notes && data.notes.length > 0) {
        data.notes.forEach(note => {
          const card = document.createElement('div');
          card.className = 'note-card';
          card.innerHTML = `
            <div>
              <div class="note-text">#${note.id} [${note.category}]: ${note.content}</div>
              <div class="note-date">${note.timestamp}</div>
            </div>
            <button class="delete-note-btn" title="Delete note" data-id="${note.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          `;
          card.querySelector('.delete-note-btn').onclick = async () => {
            await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
            loadMemoryList();
          };
          memoryList.appendChild(card);
        });
      } else {
        memoryList.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem;">No notes or reminders stored yet. Tell EDITH "Remember that..." or "Save note..." to store items.</div>';
      }
    } catch (e) {
      memoryList.innerHTML = '<div style="color: var(--crimson-stop)">Error loading memory notes.</div>';
    }
  }

  // Close modals on overlay background click
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
    if (e.target === memoryModal) memoryModal.classList.remove('active');
  });

  // Initial welcome message
  appendFeedMessage('assistant', 'E.D.I.T.H. online. Voice cognitive link established. How may I assist you today?');
});
