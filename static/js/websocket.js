/**
 * E.D.I.T.H. WebSocket & Serverless Hybrid Client
 * Real-time bidirectional streaming with automatic HTTP fallback for Vercel
 */
class EdithWebSocketClient {
  constructor(options = {}) {
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.socket = null;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.isConnected = false;
    this.isServerless = false;
    this.failedAttempts = 0;

    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.isServerless = false;
        this.failedAttempts = 0;
        this.onStatusChange(true, false);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        
        // Start ping interval
        this.pingTimer = setInterval(() => {
          if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (e) {
          console.error("Malformed websocket payload:", e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.failedAttempts++;
        if (this.pingTimer) clearInterval(this.pingTimer);

        if (this.failedAttempts >= 2) {
          // Switch to Vercel Serverless mode: HTTP REST is operational
          this.isServerless = true;
          this.onStatusChange(true, true);
        } else {
          this.onStatusChange(false, false);
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.socket.onerror = (err) => {
        console.warn("WebSocket not available (switching to serverless HTTP if on Vercel):", err);
      };

    } catch (e) {
      console.warn("Failed to establish WebSocket, enabling serverless mode:", e);
      this.isServerless = true;
      this.onStatusChange(true, true);
    }
  }

  async send(payload) {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
      return true;
    }

    // Serverless HTTP Fallback (Native Vercel support)
    const text = payload.transcript || payload.text;
    if (text) {
      this.onMessage({ type: "user_message", text: text });
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          for (let evt of data.events) {
            this.onMessage(evt);
          }
        }
        return true;
      } catch (err) {
        console.error("Serverless query fallback error:", err);
        this.onMessage({
          type: "error",
          message: `Serverless query error: ${err.message}`
        });
        return false;
      }
    }

    if (payload.type === "reset") {
      try {
        await fetch("/api/reset", { method: "POST" });
        this.onMessage({ type: "status", message: "Cognitive buffer cleared." });
        return true;
      } catch (e) {}
    }

    return false;
  }

  sendVoiceInput(transcript) {
    return this.send({
      type: "voice_input",
      transcript: transcript
    });
  }

  sendTextInput(text) {
    return this.send({
      type: "text_input",
      text: text
    });
  }

  resetSession() {
    return this.send({
      type: "reset"
    });
  }
}

window.EdithWebSocketClient = EdithWebSocketClient;
