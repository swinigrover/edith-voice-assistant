/**
 * E.D.I.T.H. Holographic Arc Reactor & Audio Visualizer
 * Renders multi-ring orbital reticles, particle physics, and audio-reactive waveforms.
 */
class EdithVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; // idle | listening | thinking | speaking
    this.audioData = new Uint8Array(64);
    this.rotationOuter = 0;
    this.rotationInner = 0;
    this.pulsePhase = 0;
    this.particles = [];
    this.numParticles = 48;

    this.initCanvasSize();
    this.initParticles();
    window.addEventListener('resize', () => this.initCanvasSize());
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 140;
      this.particles.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 1 + Math.random() * 2.5,
        speed: (0.2 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1),
        radius: dist,
        angle: angle,
        opacity: 0.2 + Math.random() * 0.7
      });
    }
  }

  setState(newState) {
    this.state = newState;
  }

  setAudioData(dataArray) {
    if (dataArray && dataArray.length > 0) {
      this.audioData = dataArray;
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const baseRadius = Math.min(cx, cy) * 0.48;

    // Speed up rotations based on state
    let speedMult = 1;
    if (this.state === 'listening') speedMult = 1.4;
    else if (this.state === 'thinking') speedMult = 3.5;
    else if (this.state === 'speaking') speedMult = 1.8;

    this.rotationOuter += 0.005 * speedMult;
    this.rotationInner -= 0.008 * speedMult;
    this.pulsePhase += 0.04 * speedMult;

    // Average audio energy
    let avgAudio = 0;
    for (let i = 0; i < this.audioData.length; i++) {
      avgAudio += this.audioData[i];
    }
    avgAudio = avgAudio / (this.audioData.length || 1);
    const audioNormalized = Math.min(avgAudio / 128, 1.5);

    // Dynamic glow color
    let mainColor = '#00f2fe';
    let glowColor = 'rgba(0, 242, 254, ';
    if (this.state === 'thinking') {
      mainColor = '#f59e0b';
      glowColor = 'rgba(245, 158, 11, ';
    } else if (this.state === 'speaking') {
      mainColor = '#38bdf8';
      glowColor = 'rgba(56, 189, 248, ';
    }

    this.ctx.save();
    this.ctx.translate(cx, cy);

    // 1. Draw Holographic Starfield / Particles
    this.drawParticles(glowColor);

    // 2. Draw Outer Segmented Reticle Ring
    this.drawSegmentedRing(baseRadius * 1.25, this.rotationOuter, glowColor, mainColor);

    // 3. Draw Inner Counter-Rotating Reticle
    this.drawInnerReticle(baseRadius * 0.95, this.rotationInner, glowColor);

    // 4. Draw Reactive Waveform Ring
    this.drawWaveformRing(baseRadius * 0.75, audioNormalized, mainColor, glowColor);

    // 5. Draw Glowing Core Arc Reactor
    this.drawCore(baseRadius * 0.35, audioNormalized, mainColor, glowColor);

    this.ctx.restore();

    requestAnimationFrame(this.animate);
  }

  drawParticles(glowColor) {
    for (let p of this.particles) {
      let speed = p.speed;
      if (this.state === 'thinking') speed *= 3.5;
      p.angle += speed * 0.01;
      const x = Math.cos(p.angle) * p.radius;
      const y = Math.sin(p.angle) * p.radius;

      this.ctx.beginPath();
      this.ctx.arc(x, y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = glowColor + p.opacity + ')';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = glowColor + '0.8)';
      this.ctx.fill();
    }
  }

  drawSegmentedRing(radius, angle, glowColor, mainColor) {
    this.ctx.save();
    this.ctx.rotate(angle);
    const segments = 24;
    const step = (Math.PI * 2) / segments;

    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, i * step, (i + 0.6) * step);
        this.ctx.strokeStyle = (i % 6 === 0) ? mainColor : glowColor + '0.4)';
        this.ctx.lineWidth = (i % 6 === 0) ? 3 : 1.5;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = mainColor;
        this.ctx.stroke();

        // Little radial tick
        const tickA = i * step;
        const x1 = Math.cos(tickA) * (radius - 5);
        const y1 = Math.sin(tickA) * (radius - 5);
        const x2 = Math.cos(tickA) * (radius + 5);
        const y2 = Math.sin(tickA) * (radius + 5);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = mainColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  drawInnerReticle(radius, angle, glowColor) {
    this.ctx.save();
    this.ctx.rotate(angle);

    // 4 targeting arcs
    for (let i = 0; i < 4; i++) {
      const arcStart = (i * Math.PI / 2) + 0.2;
      const arcEnd = arcStart + Math.PI / 3;

      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, arcStart, arcEnd);
      this.ctx.strokeStyle = glowColor + '0.6)';
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = glowColor + '0.7)';
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawWaveformRing(radius, audioNormalized, mainColor, glowColor) {
    const points = 72;
    const step = (Math.PI * 2) / points;

    this.ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const idx = i % points;
      const angle = idx * step;

      // Audio offset or simulated idle pulse
      let offset = 0;
      if (this.state === 'listening' || this.state === 'speaking') {
        const dataVal = this.audioData[idx % this.audioData.length] || 0;
        offset = (dataVal / 255) * 26 + (Math.sin(this.pulsePhase + i * 0.4) * 5);
      } else if (this.state === 'thinking') {
        offset = Math.sin(this.pulsePhase * 2 + i * 0.6) * 12 + Math.cos(this.pulsePhase + i * 0.2) * 8;
      } else {
        // Idle breathing wave
        offset = Math.sin(this.pulsePhase + i * 0.3) * 6;
      }

      const r = radius + offset;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.strokeStyle = mainColor;
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowBlur = 14;
    this.ctx.shadowColor = mainColor;
    this.ctx.stroke();
  }

  drawCore(radius, audioNormalized, mainColor, glowColor) {
    const pulse = Math.sin(this.pulsePhase) * 4;
    const currentR = Math.max(15, radius + pulse + (audioNormalized * 10));

    // Outer glow
    const grad = this.ctx.createRadialGradient(0, 0, currentR * 0.2, 0, 0, currentR * 1.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, mainColor);
    grad.addColorStop(0.8, glowColor + '0.25)');
    grad.addColorStop(1, 'transparent');

    this.ctx.beginPath();
    this.ctx.arc(0, 0, currentR * 1.5, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Solid core ring
    this.ctx.beginPath();
    this.ctx.arc(0, 0, currentR * 0.6, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = mainColor;
    this.ctx.fill();
  }
}

window.EdithVisualizer = EdithVisualizer;
