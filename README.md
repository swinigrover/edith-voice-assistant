# ⚡ E.D.I.T.H. (Even Dead, I'm The Hero)
### Advanced Cognitive AI Voice Assistant & Executive Intelligence System

> *"I'm not a bot. I'm E.D.I.T.H. — Executive Digital Intelligence & Task Host."*

E.D.I.T.H. is a full-stack, voice-first cognitive AI assistant built to reduce human interaction strictly to natural speech. Inspired by Iron Man's tactical AI HUD, it combines real-time voice recognition, audio frequency analysis, an interactive holographic Arc Reactor visualizer, and a cognitive reasoning engine powered by Google Gemini and autonomous tactical tools.

---

## 🌟 Key Features

### 🎙️ 1. True Voice-First Interaction (Zero Clicks Needed)
- **Continuous Hands-Free Listening**: Automatically listens, detects pauses, and processes speech without needing to click buttons.
- **Wake-Word Mode**: Optional trigger phrase mode (say *"EDITH"* or *"Hey EDITH"* to activate).
- **Barge-In / Interruptibility**: If E.D.I.T.H. is speaking and you speak, speech playback is immediately silenced so you can issue a new directive without waiting.
- **Live Interim Subtitles**: Transcribes speech in real time as you speak with visual feedback.
- **Vocal Synthesis**: High-quality natural text-to-speech with adjustable cadence rate and browser voice selection.

### 🧠 2. Cognitive Brain & Autonomous Tactical Tools
E.D.I.T.H. doesn't just chat; it uses cognitive tool calling to take actions and retrieve real-time facts:
- **🌤️ Live Weather Telemetry**: Instant worldwide meteorological data for any city (*"What's the weather in Tokyo?"*).
- **⏰ Temporal & Timezone Sync**: Real-time current date, time, and day tracking (*"What time is it?"*).
- **🧮 Safe Math & Scientific Computations**: Natural language arithmetic and calculations (*"Calculate 42 times 18.5"*, *"What is 15% of 850?"*).
- **📝 Persistent Tactical Memory**: Stores notes, tasks, reminders, and user facts across sessions (*"Remember that my flight is on Thursday at 3 PM"*, *"What notes do you have saved?"*).
- **🔬 Live Knowledge Retrieval**: Instant encyclopedic and web fact-checking via DuckDuckGo and Wikipedia.
- **⚙️ System Diagnostics**: Host system specs, Python runtime, and neural core health status.
- **🛡️ Cognitive Failover Engine**: If an API key is not yet provided, E.D.I.T.H. seamlessly switches to a local heuristic cognitive engine so all tactical tools remain 100% functional!

### 🔮 3. Iron Man HUD & Holographic Arc Reactor
- High-frame-rate HTML5 Canvas Arc Reactor with multi-ring counter-rotations and targeting reticles.
- Web Audio API `AnalyserNode` frequency spectrum reactive ring.
- Distinct color-coded cognitive states:
  - 🔵 **LISTENING** (Cyan audio waveform)
  - 🟡 **COGNITIVE PROCESSING** (Amber neural particle vortex)
  - 🔷 **VOCAL SYNTHESIS** (Blue acoustic frequency pulse)
  - ⚪ **SYSTEM STANDBY** (Serene breathing core)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+** (Python 3.12 is tested and verified)
- Modern web browser (Chrome, Safari, Edge, or Firefox)

### 2. Start the Server
From the project root directory:
```bash
python3 -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Open the Interface
Navigate to:
```
http://localhost:8000
```
Allow microphone permissions when prompted by your browser.

---

## 🔑 Configuring Your Google Gemini API Key

You can configure your Gemini API Key in either of two ways:

### Option A: Directly in the UI (Recommended)
1. Click the **Gear icon (⚙️)** in the top right header.
2. Paste your Google Gemini API Key into the **Google Gemini API Key** field.
3. Choose your preferred model (e.g. `gemini-2.5-flash`).
4. Click **SAVE & SYNCHRONIZE**. The key is saved automatically to `.env`.

### Option B: Via `.env` File
Create or edit `.env` in the project root:
```env



```
EDIth/
├── backend/
│   ├── server.py             # FastAPI server with WebSockets & REST endpoints
│   ├── cognitive_agent.py    # Gemini LLM + Tool calling + Prompt engineering + Failover
│   ├── tools.py              # Weather, calculator, web search, memory, diagnostics
│   ├── memory_store.py       # Persistent JSON-backed memory & note repository
│   ├── config.py             # Hot-reloading environment & API key management
│   └── data/
│       └── memory.json       # Persisted notes and facts
├── static/
│   ├── index.html            # Holographic Iron Man HUD interface
│   ├── css/
│   │   └── edith.css         # Glassmorphism, animations, futuristic typography
│   ├── js/
│   │   ├── visualizer.js     # HTML5 Canvas holographic arc-reactor & frequency engine
│   │   ├── speech.js         # STT, TTS, microphone analyser & barge-in
│   │   ├── websocket.js      # Resilient WebSocket connection & stream parser
│   │   └── app.js            # Main coordinator, state machine & UI bindings
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
└── README.md                 # System documentation
```

## 🗣️ Voice Commands to Try Out

- *"What's the weather in London right now?"*
- *"Compute 128 times 4.5"*
- *"What time is it?"*
- *"Remember that meeting with Sarah is tomorrow at 11 AM"*
- *"Show my saved notes"*
- *"Who was Alan Turing?"*
- *"Run system status report"*
- *"What is 20 percent of 750?"*
