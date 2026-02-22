/**
 * SoundEngine — Procedural Web Audio API sound system.
 *
 * All sounds are synthesized in real-time. No audio files.
 * Designed for Igloo Inc / museum-grade multisensory UI.
 *
 * Sound categories:
 *  - Typing: Smooth Cherry MX Brown mechanical keyboard clacks
 *  - Ambient: Ultra-low continuous drone (felt more than heard)
 *  - UI: Panel slides, magnetic ticks, confirmation clicks
 *  - Scroll: Fabric/friction micro-sounds tied to scroll velocity
 *  - Data: Counting ticks, value settle, metric resolve
 */

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let ambientGain: GainNode | null = null
let ambientOscLow: OscillatorNode | null = null
let ambientOscHarmonic: OscillatorNode | null = null
let ambientLfo: OscillatorNode | null = null
let ambientRunning = false
let initialized = false

const MASTER_VOLUME = 0.35
const AMBIENT_VOLUME = 0.012

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

function getMaster(): GainNode {
  const c = getCtx()
  if (!masterGain) {
    masterGain = c.createGain()
    masterGain.gain.value = MASTER_VOLUME
    masterGain.connect(c.destination)
  }
  return masterGain
}

export function initAudio(): void {
  if (initialized) return
  initialized = true
  getCtx()
  getMaster()
}

// ─── Ambient Drone ─────────────────────────────────────────────────────────

export function startAmbient(): void {
  if (ambientRunning) return
  const c = getCtx()
  const master = getMaster()

  ambientGain = c.createGain()
  ambientGain.gain.value = 0
  ambientGain.connect(master)

  // Deep sub-bass hum (barely perceptible)
  ambientOscLow = c.createOscillator()
  ambientOscLow.type = 'sine'
  ambientOscLow.frequency.value = 42 // Deep hum
  const lowGain = c.createGain()
  lowGain.gain.value = 0.6
  ambientOscLow.connect(lowGain)
  lowGain.connect(ambientGain)

  // Harmonic overtone — gentle drift
  ambientOscHarmonic = c.createOscillator()
  ambientOscHarmonic.type = 'sine'
  ambientOscHarmonic.frequency.value = 84
  const harmonicGain = c.createGain()
  harmonicGain.gain.value = 0.15
  ambientOscHarmonic.connect(harmonicGain)
  harmonicGain.connect(ambientGain)

  // Very slow LFO to modulate harmonic frequency for "drift"
  ambientLfo = c.createOscillator()
  ambientLfo.type = 'sine'
  ambientLfo.frequency.value = 0.05 // Once every 20 seconds
  const lfoGain = c.createGain()
  lfoGain.gain.value = 3 // +-3Hz drift on the harmonic
  ambientLfo.connect(lfoGain)
  lfoGain.connect(ambientOscHarmonic.frequency)

  ambientOscLow.start()
  ambientOscHarmonic.start()
  ambientLfo.start()

  // Fade in over 3 seconds
  ambientGain.gain.setTargetAtTime(AMBIENT_VOLUME, c.currentTime, 1.0)

  ambientRunning = true
}

export function stopAmbient(): void {
  if (!ambientRunning || !ctx || !ambientGain) return
  const now = ctx.currentTime
  ambientGain.gain.setTargetAtTime(0, now, 0.5)
  setTimeout(() => {
    ambientOscLow?.stop()
    ambientOscHarmonic?.stop()
    ambientLfo?.stop()
    ambientOscLow = null
    ambientOscHarmonic = null
    ambientLfo = null
    ambientGain = null
    ambientRunning = false
  }, 2000)
}

// ─── Typing Sounds (Smooth Cherry MX Brown) ────────────────────────────────

export function playTypeClick(emphasis: 'normal' | 'headline' | 'metric' | 'soft' = 'normal'): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const volumeMap = { headline: 0.16, metric: 0.13, normal: 0.08, soft: 0.03 }
  const vol = volumeMap[emphasis]

  // Natural pitch variation for brown switches
  const basePitch = 1550 + (Math.random() - 0.5) * 250
  const timingJitter = Math.random() * 0.001

  // Main clack — smooth sine wave with gentle attack
  const mainOsc = c.createOscillator()
  mainOsc.type = 'sine'
  mainOsc.frequency.setValueAtTime(basePitch, now + timingJitter)
  mainOsc.frequency.exponentialRampToValueAtTime(basePitch * 0.82, now + timingJitter + 0.045)

  const mainGain = c.createGain()
  mainGain.gain.setValueAtTime(0, now + timingJitter)
  mainGain.gain.linearRampToValueAtTime(vol, now + timingJitter + 0.006) // Soft attack
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + timingJitter + 0.09) // Natural decay

  mainOsc.connect(mainGain)
  mainGain.connect(master)
  mainOsc.start(now + timingJitter)
  mainOsc.stop(now + timingJitter + 0.12)

  // Tactile overtone — subtle mechanical character without harshness
  const tactileOsc = c.createOscillator()
  tactileOsc.type = 'sine'
  tactileOsc.frequency.setValueAtTime(basePitch * 2.3, now + timingJitter)

  const tactileGain = c.createGain()
  tactileGain.gain.setValueAtTime(0, now + timingJitter)
  tactileGain.gain.linearRampToValueAtTime(vol * 0.12, now + timingJitter + 0.003)
  tactileGain.gain.exponentialRampToValueAtTime(0.001, now + timingJitter + 0.06)

  tactileOsc.connect(tactileGain)
  tactileGain.connect(master)
  tactileOsc.start(now + timingJitter)
  tactileOsc.stop(now + timingJitter + 0.09)
}

// ─── Gentle Typewriter Blip (extremely subtle) ────────────────────────────

/** Ultra-soft typewriter tap — barely perceptible, gentle sine blip */
export function playTypeSoft(emphasis: 'normal' | 'headline' | 'metric' | 'soft' = 'normal'): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  // Extremely quiet — felt more than heard
  const volumeMap = { headline: 0.018, metric: 0.014, normal: 0.01, soft: 0.005 }
  const vol = volumeMap[emphasis]

  // Gentle pitch variation
  const pitch = 900 + (Math.random() - 0.5) * 200

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(pitch, now)
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, now + 0.04)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.004) // Very soft attack
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05) // Quick gentle fade

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.06)
}

// ─── UI Micro-Sounds ───────────────────────────────────────────────────────

/** Soft mechanical glide — for panels sliding in */
export function playPanelSlide(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  // Filtered noise sweep
  const duration = 0.25
  const bufferLen = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferLen, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    const t = i / bufferLen
    const env = Math.sin(t * Math.PI) * 0.3 // Smooth arc
    data[i] = (Math.random() * 2 - 1) * env
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(800, now)
  filter.frequency.linearRampToValueAtTime(2000, now + duration * 0.5)
  filter.frequency.linearRampToValueAtTime(600, now + duration)
  filter.Q.value = 2

  const gain = c.createGain()
  gain.gain.value = 0.04

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  noise.start(now)
}

/** Gentle confirmation click — for values settling */
export function playConfirmClick(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.06)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0.06, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.1)
}

/** Subtle magnetic tick — for HUD elements locking into place */
export function playMagneticTick(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const bufferLen = Math.floor(c.sampleRate * 0.008)
  const buffer = c.createBuffer(1, bufferLen, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    const t = i / bufferLen
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40)
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 4000
  filter.Q.value = 3

  const gain = c.createGain()
  gain.gain.value = 0.035

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  noise.start(now)
}

/** Faint counting tick — for metrics counting up */
export function playCountTick(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 1600 + Math.random() * 400

  const gain = c.createGain()
  gain.gain.setValueAtTime(0.025, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.03)
}

/** Subtle spatial cue — for focus shift */
export function playFocusShift(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.12)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.03, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.2)
}

/** Low tonal sweep — for contours drawing / map surfaces */
export function playTonalSweep(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, now)
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.4)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.025, now + 0.05)
  gain.gain.setTargetAtTime(0, now + 0.2, 0.1)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.5)
}

/** Low-end ripple — for surface changes / region activation */
export function playRipple(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, now)
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.15)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.4)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.04, now + 0.03)
  gain.gain.setTargetAtTime(0, now + 0.15, 0.1)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.5)
}

/** Quiet pulse — for region activation */
export function playPulse(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 200

  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 8
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.5
  lfo.connect(lfoGain)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.03, now + 0.05)
  gain.gain.setTargetAtTime(0, now + 0.1, 0.08)

  lfoGain.connect(gain.gain)
  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  lfo.start(now)
  osc.stop(now + 0.35)
  lfo.stop(now + 0.35)
}

/** Soft lock-in click — for overlay appearance */
export function playLockIn(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  // Two-tone click: higher then lower
  const osc1 = c.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.value = 1200

  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = 800

  const gain1 = c.createGain()
  gain1.gain.setValueAtTime(0.04, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  const gain2 = c.createGain()
  gain2.gain.setValueAtTime(0.001, now)
  gain2.gain.setValueAtTime(0.035, now + 0.04)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

  osc1.connect(gain1)
  gain1.connect(master)
  osc2.connect(gain2)
  gain2.connect(master)

  osc1.start(now)
  osc1.stop(now + 0.05)
  osc2.start(now + 0.035)
  osc2.stop(now + 0.1)
}

// ─── Scroll Sound ──────────────────────────────────────────────────────────

let lastScrollSoundTime = 0
const SCROLL_SOUND_MIN_INTERVAL = 40 // ms between scroll sounds

/** Micro fabric/friction sound — called on scroll events, volume tied to velocity */
export function playScrollTick(velocity: number): void {
  const now = performance.now()
  if (now - lastScrollSoundTime < SCROLL_SOUND_MIN_INTERVAL) return
  lastScrollSoundTime = now

  const c = getCtx()
  const master = getMaster()
  const t = c.currentTime

  // Clamp velocity to reasonable range
  const v = Math.min(Math.abs(velocity), 50) / 50 // 0-1

  const bufferLen = Math.floor(c.sampleRate * 0.012)
  const buffer = c.createBuffer(1, bufferLen, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    const p = i / bufferLen
    const env = Math.exp(-p * 30)
    data[i] = (Math.random() * 2 - 1) * env
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2000 + v * 3000 // Higher pitch at faster scroll
  filter.Q.value = 1.5

  const gain = c.createGain()
  // Soft at slow scroll, slightly louder at fast — but always subtle
  gain.gain.value = 0.008 + v * 0.025

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  noise.start(t)
}

// ─── Button Interaction Sounds ─────────────────────────────────────────────

/** Hover sound — ultra-subtle */
export function playHover(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 600 + Math.random() * 200

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.015, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.1)
}

/** Button press — gentle click (soft and subtle) */
export function playButtonPress(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  // Soft click noise
  const bufferLen = Math.floor(c.sampleRate * 0.012)
  const buffer = c.createBuffer(1, bufferLen, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    const t = i / bufferLen
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 25)
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2700
  filter.Q.value = 1.6

  const clickGain = c.createGain()
  clickGain.gain.value = 0.032 // Much gentler

  noise.connect(filter)
  filter.connect(clickGain)
  clickGain.connect(master)
  noise.start(now)

  // Gentle tonal component
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(630, now)
  osc.frequency.exponentialRampToValueAtTime(460, now + 0.07)

  const toneGain = c.createGain()
  toneGain.gain.setValueAtTime(0.018, now) // Much quieter
  toneGain.gain.exponentialRampToValueAtTime(0.0003, now + 0.08)

  osc.connect(toneGain)
  toneGain.connect(master)
  osc.start(now)
  osc.stop(now + 0.1)
}

/** Muted tonal resolve — for panel settling into place */
export function playPanelSettle(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(350, now)
  osc.frequency.exponentialRampToValueAtTime(280, now + 0.15)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0.03, now)
  gain.gain.setTargetAtTime(0, now + 0.06, 0.05)

  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.25)
}

/** Step transition whoosh (non-swoopy, calm) */
export function playStepTransition(direction: 'forward' | 'backward'): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  const duration = 0.2
  const bufferLen = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferLen, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    const t = i / bufferLen
    const env = Math.sin(t * Math.PI) * 0.25
    data[i] = (Math.random() * 2 - 1) * env
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'

  if (direction === 'forward') {
    filter.frequency.setValueAtTime(600, now)
    filter.frequency.linearRampToValueAtTime(1800, now + duration)
  } else {
    filter.frequency.setValueAtTime(1800, now)
    filter.frequency.linearRampToValueAtTime(600, now + duration)
  }
  filter.Q.value = 1.5

  const gain = c.createGain()
  gain.gain.value = 0.03

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  noise.start(now)
}

// ─── Slider Interaction Sounds ─────────────────────────────────────────────

/** Gentle rubber band stretch sound — subtle and ASMR-like for slider movement */
export function playSliderStretch(): void {
  const c = getCtx()
  const master = getMaster()
  const now = c.currentTime

  // Soft sine tone with slight pitch variation (rubber band tension effect)
  const osc = c.createOscillator()
  osc.type = 'sine'
  // Start slightly lower, rise slightly for "stretch" effect
  osc.frequency.setValueAtTime(280 + Math.random() * 20, now)
  osc.frequency.linearRampToValueAtTime(320 + Math.random() * 30, now + 0.08)
  osc.frequency.exponentialRampToValueAtTime(270, now + 0.15)

  // Subtle harmonic for warmth (like the string resonance)
  const harmonic = c.createOscillator()
  harmonic.type = 'sine'
  harmonic.frequency.setValueAtTime(560, now) // Octave above
  harmonic.frequency.linearRampToValueAtTime(640, now + 0.08)
  harmonic.frequency.exponentialRampToValueAtTime(540, now + 0.15)

  // Main envelope: soft attack, smooth decay
  const mainGain = c.createGain()
  mainGain.gain.setValueAtTime(0, now)
  mainGain.gain.linearRampToValueAtTime(0.016, now + 0.02) // Soft attack
  mainGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.15) // Smooth decay

  // Harmonic is quieter
  const harmonicGain = c.createGain()
  harmonicGain.gain.setValueAtTime(0, now)
  harmonicGain.gain.linearRampToValueAtTime(0.006, now + 0.025)
  harmonicGain.gain.exponentialRampToValueAtTime(0.0003, now + 0.15)

  osc.connect(mainGain)
  mainGain.connect(master)
  harmonic.connect(harmonicGain)
  harmonicGain.connect(master)

  osc.start(now)
  osc.stop(now + 0.2)
  harmonic.start(now)
  harmonic.stop(now + 0.2)
}
