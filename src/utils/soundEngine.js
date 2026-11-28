// Zero-dependency Web Audio API Synthesizer for SHELTER B-04: THE CHITIN FALL
// Generates: 50Hz fluorescent/ventilation ambient drone, heavy steel door knocks,
// Geiger counter clicks, shortwave radio static, UV buzz, thermal sweep,
// Bakelite intercom clicks, hydraulic blast doors, and lockdown alarms.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.droneNodes = null;
    this.geigerTimer = null;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.droneNodes && this.droneNodes.masterGain && this.ctx) {
      this.droneNodes.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.065,
        this.ctx.currentTime,
        0.15
      );
    }
    if (muted) {
      this.stopGeigerLoop();
    }
  }

  isMuted() {
    return this.muted;
  }

  // Continuous Soviet bunker 50Hz fluorescent hum + low concrete ventilation rumble
  startAmbientDrone() {
    const ctx = this.ensureContext();
    if (!ctx || this.droneNodes) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = this.muted ? 0 : 0.065;
    masterGain.connect(ctx.destination);

    // 50Hz mains fluorescent hum
    const humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 50;

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 140;

    const humGain = ctx.createGain();
    humGain.gain.value = 0.24;

    humOsc.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(masterGain);
    humOsc.start();

    // 100Hz harmonic subtle tube buzz
    const tubeOsc = ctx.createOscillator();
    tubeOsc.type = 'sine';
    tubeOsc.frequency.value = 100;
    const tubeGain = ctx.createGain();
    tubeGain.gain.value = 0.08;
    tubeOsc.connect(tubeGain);
    tubeGain.connect(masterGain);
    tubeOsc.start();

    // Low concrete ventilation brown-noise rumble
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 85;
    noiseFilter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();

    this.droneNodes = { masterGain, humOsc, tubeOsc, noise };
  }

  // Heavy muffled metallic knocks on the reinforced steel bulkhead
  playDoorKnock(count = 3) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + i * 0.34 + (Math.random() * 0.04);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115 - i * 4, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);

      filter.type = 'lowpass';
      filter.frequency.value = 280;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.42, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.21);
    }
  }

  // Single Geiger-Müller tube click
  playGeigerClick(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.004);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(0.32, 0.16 * intensity);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  // Burst of Geiger clicks scaled to CPM (0 = eerie silence, 40 = normal ticks, 200+ = frantic rattle)
  playGeigerBurst(cpm) {
    this.stopGeigerLoop();
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (cpm <= 2) {
      // One dull switch click then eerie dead silence
      this.playButtonClick();
      return;
    }

    const clicks = cpm > 120 ? 18 : cpm > 70 ? 10 : 5;
    let count = 0;
    const runNext = () => {
      if (this.muted || count >= clicks) return;
      this.playGeigerClick(cpm > 120 ? 1.4 : 0.9);
      count++;
      const baseDelay = cpm > 120 ? 45 : cpm > 70 ? 110 : 210;
      this.geigerTimer = window.setTimeout(
        runNext,
        baseDelay + Math.random() * baseDelay
      );
    };
    runNext();
  }

  stopGeigerLoop() {
    if (this.geigerTimer) {
      window.clearTimeout(this.geigerTimer);
      this.geigerTimer = null;
    }
  }

  // Shortwave radio static burst & carrier whistle
  playRadioStatic(duration = 0.55) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1100, t);
    bandpass.frequency.linearRampToValueAtTime(1950, t + duration);
    bandpass.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);

    // Subtle shortwave heterodyne tone
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(920, t);
    tone.frequency.exponentialRampToValueAtTime(640, t + duration * 0.8);
    toneGain.gain.setValueAtTime(0.035, t);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    tone.connect(toneGain);
    toneGain.connect(ctx.destination);
    tone.start(t);
    tone.stop(t + duration);
  }

  // UV penlight electrical ballast click & subtle ultraviolet buzz
  playUvBuzz() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.linearRampToValueAtTime(320, t + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // Thermal FLIR scan calibration chirp
  playThermalScan() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.22);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // Paper ledger page flip rustle
  playPaperFlip() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.1;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  // Bakelite intercom switch click + short voice transmission blip
  playIntercomClick(isEerie = false) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isEerie ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isEerie ? 170 : 540, t);
    osc.frequency.exponentialRampToValueAtTime(isEerie ? 95 : 220, t + 0.055);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Tactile mechanical switch click
  playButtonClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.035);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  // ADMIT: Heavy hydraulic airlock hiss & latch release
  playAdmitDoor() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // Pneumatic hiss
    const dur = 0.65;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + dur);
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);

    // Heavy low thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(90, t + 0.12);
    thud.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    thudGain.gain.setValueAtTime(0.32, t + 0.12);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(t + 0.12);
    thud.stop(t + 0.5);
  }

  // DENY: Steel deadbolt slam
  playDenySlam() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.24);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 360;

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // PURGE: Industrial blast-door lockdown klaxon + incinerator roar
  playPurgeAlarm() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.32;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.linearRampToValueAtTime(360, t + 0.24);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.27);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.29);
    }
  }

  // Night horror sting when a resident dies or Hollow strikes
  playNightHorror() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const freqs = [110, 116.5, 233];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 1.1);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.25);
    });
  }

  // Soft concrete bunker boot footstep
  playFootstep(stepIndex = 0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = stepIndex % 2 === 0 ? 78 : 68;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.08);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Heavy industrial bulkhead lever clunk
  playLeverPull() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.11);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}

export const soundEngine = new SoundEngine();
