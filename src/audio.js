// audio.js - Synthesized Sound Effects for Game of Amazons
// No external assets required.

let actx = null

const initAudio = () => {
  if (!actx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) actx = new AudioContext()
  }
  if (actx && actx.state === 'suspended') {
    actx.resume()
  }
}

// Master volume control
export const AUDIO_STATE = { muted: false }

export const playSound = (type) => {
  if (AUDIO_STATE.muted) return
  initAudio()
  if (!actx) return

  const t = actx.currentTime

  if (type === 'pop') {
    // Soft, rounded pop for selections
    const osc = actx.createOscillator()
    const gain = actx.createGain()
    osc.connect(gain)
    gain.connect(actx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1)

    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1)

    osc.start(t)
    osc.stop(t + 0.1)
  }

  if (type === 'move') {
    // Sliding swoosh for piece moving
    const osc = actx.createOscillator()
    const gain = actx.createGain()
    osc.connect(gain)
    gain.connect(actx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(250, t)
    osc.frequency.linearRampToValueAtTime(400, t + 0.15)

    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05)
    gain.gain.linearRampToValueAtTime(0, t + 0.15)

    osc.start(t)
    osc.stop(t + 0.15)
  }

  if (type === 'shoot') {
    // Thud/Impact for the arrow landing
    const osc = actx.createOscillator()
    const gain = actx.createGain()
    
    // Add a simple low-pass filter
    const filter = actx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1200, t)
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.2)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(actx.destination)

    osc.type = 'square'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15)

    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2)

    osc.start(t)
    osc.stop(t + 0.2)
  }

  if (type === 'error') {
    // Dull flat line for errors
    const osc = actx.createOscillator()
    const gain = actx.createGain()
    osc.connect(gain)
    gain.connect(actx.destination)

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, t)
    
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
    gain.gain.linearRampToValueAtTime(0, t + 0.15)

    osc.start(t)
    osc.stop(t + 0.15)
  }

  if (type === 'win') {
    // Pleasant ascending arpeggio
    const playNote = (freq, delay) => {
      const osc = actx.createOscillator()
      const gain = actx.createGain()
      osc.connect(gain)
      gain.connect(actx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      gain.gain.setValueAtTime(0, t + delay)
      gain.gain.linearRampToValueAtTime(0.3, t + delay + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.6)

      osc.start(t + delay)
      osc.stop(t + delay + 0.6)
    }

    playNote(523.25, 0)    // C5
    playNote(659.25, 0.15) // E5
    playNote(783.99, 0.3)  // G5
    playNote(1046.50, 0.45)// C6
  }
}
