/**
 * Robust Web Audio Ambient Soundscape Engine for FaithSync Live Devotions.
 * Synthesizes peaceful prayer and study soundscapes natively with Web Audio API.
 * Guarantees zero missing audio assets, zero network dropouts, and instant playback.
 */

class AmbientSoundEngine {
  private audioCtx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private nodes: (AudioNode | number)[] = []
  private isPlaying: boolean = false
  private isMuted: boolean = false
  private currentDiscipline: 'prayer' | 'study' = 'prayer'
  private baseVolume: number = 0.35

  private initContext(): boolean {
    if (typeof window === 'undefined') return false
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtxClass) return false
        this.audioCtx = new AudioCtxClass()
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume()
      }
      if (!this.masterGain && this.audioCtx) {
        this.masterGain = this.audioCtx.createGain()
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.baseVolume, this.audioCtx.currentTime)
        this.masterGain.connect(this.audioCtx.destination)
      }
      return true
    } catch (e) {
      console.warn('Audio Context initialization error:', e)
      return false
    }
  }

  public start(discipline: 'prayer' | 'study' = 'prayer', muted: boolean = false) {
    if (typeof window === 'undefined') return
    this.currentDiscipline = discipline
    this.isMuted = muted

    if (!this.initContext() || !this.audioCtx || !this.masterGain) return

    this.stop()
    this.isPlaying = true

    const now = this.audioCtx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(0.001, now)
    this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.baseVolume, now + 1.2)

    if (discipline === 'prayer') {
      this.createPrayerDrone()
    } else {
      this.createStudyAmbiance()
    }
  }

  /**
   * Prayer Mode: Sacred Contemplative Drone
   * Harmonious warm triad (E2 = 82.41Hz, B2 = 123.47Hz, E3 = 164.81Hz, G#3 = 207.65Hz)
   * with a resonant lowpass filter for gentle, comforting prayer focus.
   */
  private createPrayerDrone() {
    if (!this.audioCtx || !this.masterGain) return

    const freqs = [82.41, 123.47, 164.81, 207.65]
    const filter = this.audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(320, this.audioCtx.currentTime)
    filter.Q.setValueAtTime(1.2, this.audioCtx.currentTime)
    filter.connect(this.masterGain)

    freqs.forEach((freq, idx) => {
      if (!this.audioCtx) return
      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime)

      // Slight detune for warm shimmering chorus
      const detuneAmount = (idx - 1.5) * 4
      osc.detune.setValueAtTime(detuneAmount, this.audioCtx.currentTime)

      const layerVol = idx === 0 ? 0.4 : 0.2
      gain.gain.setValueAtTime(layerVol, this.audioCtx.currentTime)

      osc.connect(gain)
      gain.connect(filter)
      osc.start()
      this.nodes.push(osc)
    })
  }

  /**
   * Study Mode: Peaceful Still Waters Atmosphere
   * Soft pink-noise river wash with warm acoustic resonance for scripture clarity.
   */
  private createStudyAmbiance() {
    if (!this.audioCtx || !this.masterGain) return

    // Warm resonant tone layers (D3 = 146.83Hz, A3 = 220Hz, F#4 = 369.99Hz)
    const freqs = [146.83, 220.0, 369.99]
    const toneFilter = this.audioCtx.createBiquadFilter()
    toneFilter.type = 'lowpass'
    toneFilter.frequency.setValueAtTime(450, this.audioCtx.currentTime)
    toneFilter.connect(this.masterGain)

    freqs.forEach((freq) => {
      if (!this.audioCtx) return
      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime)
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime)

      osc.connect(gain)
      gain.connect(toneFilter)
      osc.start()
      this.nodes.push(osc)
    })

    // Pink noise buffer generator for gentle flowing stream
    const bufferSize = this.audioCtx.sampleRate * 2
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.015
      b6 = white * 0.115926
    }

    const whiteNoise = this.audioCtx.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true

    const noiseFilter = this.audioCtx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(400, this.audioCtx.currentTime)
    noiseFilter.Q.setValueAtTime(0.7, this.audioCtx.currentTime)

    const noiseGain = this.audioCtx.createGain()
    noiseGain.gain.setValueAtTime(0.2, this.audioCtx.currentTime)

    whiteNoise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)

    whiteNoise.start()
    this.nodes.push(whiteNoise)
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (!this.audioCtx || !this.masterGain) return
    const now = this.audioCtx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : this.baseVolume, now + 0.2)
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted)
    return this.isMuted
  }

  public getIsMuted(): boolean {
    return this.isMuted
  }

  public stop() {
    if (this.nodes.length > 0) {
      this.nodes.forEach((node) => {
        try {
          if (typeof (node as any).stop === 'function') {
            ;(node as any).stop()
          }
          if (typeof (node as any).disconnect === 'function') {
            ;(node as any).disconnect()
          }
        } catch {}
      })
      this.nodes = []
    }
    this.isPlaying = false
  }
}

export const ambientSound = new AmbientSoundEngine()
