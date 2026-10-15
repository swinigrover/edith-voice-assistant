/**
 * E.D.I.T.H. Voice Engine
 * Handles Speech-to-Text (STT), Text-to-Speech (TTS), Web Audio Analyser, and Barge-In
 */
class EdithVoiceEngine {
  constructor(options = {}) {
    this.onTranscript = options.onTranscript || (() => {});
    this.onInterim = options.onInterim || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onAudioData = options.onAudioData || (() => {});
    this.onError = options.onError || (() => {});

    this.isListening = false;
    this.isSpeaking = false;
    this.continuousMode = true;
    this.wakeWordOnly = false;
    this.selectedVoice = null;
    this.voiceRate = 1.05;
    this.voicePitch = 1.0;
    this.restartTimer = null;

    // Web Audio Analyzer
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.audioInterval = null;

    this.initSpeechRecognition();
    this.initSpeechSynthesis();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      this.onError("Speech recognition requires Google Chrome, Microsoft Edge, or Safari.");
      return;
    }

    // Clean up previous instance if any
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch (e) {}
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStateChange('listening');
        this.startAudioAnalyzer();
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        if (interimTranscript) {
          // If user starts speaking while AI is talking, barge-in!
          if (this.isSpeaking) {
            this.stopSpeaking();
          }
          this.onInterim(interimTranscript);
        }

        if (finalTranscript.trim()) {
          const text = finalTranscript.trim();
          // Check wake word if required
          if (this.wakeWordOnly) {
            const lower = text.toLowerCase();
            if (lower.includes('edith') || lower.includes('hey edith')) {
              const cleaned = text.replace(/^(hey\s+)?edith[,.\s]*/i, '').trim();
              if (cleaned) this.onTranscript(cleaned);
            } else {
              this.onInterim(`Heard "${text}" (Wake-word "EDITH" required)`);
            }
          } else {
            this.onTranscript(text);
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.isListening = false;
          this.onStateChange('idle');
          this.onError("Microphone permission denied. Please allow microphone access in your browser address bar.");
        } else if (event.error === 'audio-capture') {
          this.isListening = false;
          this.onStateChange('idle');
          this.onError("No microphone detected. Please connect or enable your microphone.");
        } else if (event.error === 'network') {
          console.warn("Speech network glitch, reconnecting...");
        }
      };

      this.recognition.onend = () => {
        if (this.restartTimer) clearTimeout(this.restartTimer);

        if (this.continuousMode && this.isListening) {
          // Debounce restart so browser audio pipeline has time to reset
          this.restartTimer = setTimeout(() => {
            if (this.continuousMode && this.isListening) {
              try {
                this.recognition.start();
              } catch (e) {
                // If recognition instance enters an invalid state, re-init and restart
                this.initSpeechRecognition();
                try { this.recognition.start(); } catch (err) {}
              }
            }
          }, 250);
        } else {
          this.isListening = false;
          this.stopAudioAnalyzer();
          if (!this.isSpeaking) {
            this.onStateChange('idle');
          }
        }
      };
    } catch (e) {
      console.error("Failed to initialize SpeechRecognition:", e);
    }
  }

  startListening() {
    if (!this.recognition) {
      this.initSpeechRecognition();
    }
    if (!this.recognition) return false;

    if (this.restartTimer) clearTimeout(this.restartTimer);

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn("Recognition start threw:", e);
      // If already started or stuck, abort and restart fresh
      try {
        this.recognition.abort();
      } catch (err) {}
      this.initSpeechRecognition();
      setTimeout(() => {
        try { 
          this.recognition.start();
        } catch (err) {
          console.warn("Second start attempt failed:", err);
        }
      }, 150);
      return true;
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        try { this.recognition.abort(); } catch (err) {}
      }
    }
    this.stopAudioAnalyzer();
    this.onStateChange('idle');
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      this.startListening();
      return true;
    }
  }

  /* Audio Context & Live Microphone Spectrum */
  async startAudioAnalyzer() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      if (!this.micStream) {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
      }

      if (this.audioInterval) clearInterval(this.audioInterval);
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.audioInterval = setInterval(() => {
        if (this.isListening && !this.isSpeaking && this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
          this.onAudioData(dataArray);
        }
      }, 40);
    } catch (err) {
      // Audio analyzer is an optional aesthetic visualizer; speech recognition still functions without it
      console.warn("Audio stream visualizer not active:", err);
    }
  }

  stopAudioAnalyzer() {
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
      this.audioInterval = null;
    }
  }

  /* Text-To-Speech (TTS) Engine */
  initSpeechSynthesis() {
    if (!('speechSynthesis' in window)) return;
    this.synth = window.speechSynthesis;

    const loadVoices = () => {
      this.availableVoices = this.synth.getVoices();
      // Select best default voice: Prefer English female/natural voice (like EDITH/Jarvis)
      if (!this.selectedVoice && this.availableVoices.length > 0) {
        this.selectedVoice = 
          this.availableVoices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Victoria'))) ||
          this.availableVoices.find(v => v.lang.startsWith('en')) ||
          this.availableVoices[0];
      }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  getVoices() {
    return this.availableVoices || [];
  }

  setVoice(voiceName) {
    if (!this.availableVoices) return;
    const v = this.availableVoices.find(item => item.name === voiceName);
    if (v) this.selectedVoice = v;
  }

  speak(text) {
    if (!('speechSynthesis' in window) || !text) return;

    this.stopSpeaking();
    this.isSpeaking = true;
    this.onStateChange('speaking');

    // Resume speech synthesis if suspended by browser
    if (this.synth.paused) {
      try { this.synth.resume(); } catch (e) {}
    }

    // Clean markdown formatting before speaking
    const cleanSpeech = text
      .replace(/[*_#`~]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.voiceRate;
    utterance.pitch = this.voicePitch;

    // Simulated speech reactive frequency data for visualizer
    const speechPulse = setInterval(() => {
      if (!this.isSpeaking) {
        clearInterval(speechPulse);
        return;
      }
      const fakeData = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        fakeData[i] = Math.floor(60 + Math.random() * 160);
      }
      this.onAudioData(fakeData);
    }, 50);

    utterance.onend = () => {
      this.isSpeaking = false;
      clearInterval(speechPulse);
      if (this.isListening) {
        this.onStateChange('listening');
      } else {
        this.onStateChange('idle');
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      this.isSpeaking = false;
      clearInterval(speechPulse);
      if (this.isListening) {
        this.onStateChange('listening');
      } else {
        this.onStateChange('idle');
      }
    };

    try {
      this.synth.speak(utterance);
    } catch (e) {
      console.warn("Synth speak failed:", e);
      this.isSpeaking = false;
    }
  }

  stopSpeaking() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    this.isSpeaking = false;
  }
}

window.EdithVoiceEngine = EdithVoiceEngine;
