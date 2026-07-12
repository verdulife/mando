import { buildLayout } from './grid-engine.js'

class MandoGamepad extends HTMLElement {
  constructor() {
    super()
    this._ws = null
    this._reconnectTimer = null
    this._connecting = false
    this._audioCtx = null
    this._soundEnabled = true
    this._vibrationEnabled = true
    this._layoutId = null
  }

  async connectedCallback() {
    await this.render()
    this.setupListeners()
    this.connect()
  }

  disconnectedCallback() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer)
    if (this._ws) this._ws.close()
  }

  getLayoutId() {
    if (this._layoutId) return this._layoutId
    const attr = this.getAttribute('layout')
    if (attr) return attr
    const params = new URLSearchParams(location.search)
    const param = params.get('layout')
    if (param) return param
    return 'default'
  }

  async render() {
    const id = this.getLayoutId()

    // Status indicator
    this._statusEl = document.createElement('div')
    this._statusEl.id = 'status'
    this._statusEl.className = 'fixed top-2 left-1/2 -translate-x-1/2 max-w-[calc(100%-20px)] px-3.5 py-1.5 text-xs text-white bg-danger/90 rounded-full opacity-0 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap'
    this._statusEl.textContent = 'Conectando...'
    this.appendChild(this._statusEl)

    // Layout
    this._layoutId = id
    const res = await fetch(`/api/layouts/${id}`)
    const config = await res.json()
    this._layoutEl = buildLayout(config)
    this.appendChild(this._layoutEl)
  }

  async setLayout(id) {
    if (id === this._layoutId) return
    if (this._layoutEl) {
      this._layoutEl.remove()
    }
    this._layoutId = id
    const res = await fetch(`/api/layouts/${id}`)
    const config = await res.json()
    this._layoutEl = buildLayout(config)
    if (this._statusEl) {
      this.insertBefore(this._layoutEl, this._statusEl.nextSibling)
    } else {
      this.appendChild(this._layoutEl)
    }
  }

  setupListeners() {
    this.addEventListener('button-down', (e) => this.onButton(e.detail.name, true, e))
    this.addEventListener('button-up', (e) => this.onButton(e.detail.name, false, e))
    this.addEventListener('axis', (e) => this.onAxis(e.detail.axis, e.detail.value, e))
  }

  // ===== WebSocket =====

  connect() {
    if (this._ws) return
    if (this._connecting) return
    this._connecting = true
    this.setStatus('Conectando...')
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${location.host}/ws`
    this._ws = new WebSocket(wsUrl)

    this._ws.onopen = () => {
      this.setStatus('Conectado')
      this._connecting = false
      setTimeout(() => {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify({
            type: 'device_info',
            userAgent: navigator.userAgent || '',
            platform: navigator.platform || '',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1),
            layout: this._layoutId,
          }))
        }
      }, 100)
    }

    this._ws.onclose = () => {
      this.setStatus('Desconectado. Reconectando...')
      this._ws = null
      this._connecting = false
      if (this._reconnectTimer) clearTimeout(this._reconnectTimer)
      this._reconnectTimer = setTimeout(() => this.connect(), 1000)
    }

    this._ws.onerror = () => {
      this.setStatus('Error de conexión')
    }

    this._ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'hello' || data.type === 'settings') {
          this.updateSettings(data)
        }
      } catch {}
    }
  }

  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data))
    }
  }

  // ===== Input handlers =====

  onButton(name, pressed, event) {
    event.stopPropagation()
    this.send({ type: pressed ? 'button_down' : 'button_up', button: name })
    if (pressed) {
      this.triggerHaptic()
      this.playClick()
    } else {
      this.playClack()
    }
  }

  onAxis(axis, value, event) {
    event.stopPropagation()
    this.send({ type: 'axis', axis, value })
  }

  // ===== Haptic =====

  triggerHaptic() {
    if (this._vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(8)
    }
  }

  // ===== Audio =====

  initAudio() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume()
    }
  }

  playTone(type, freq, freqEnd, gainStart, gainEnd, startTime, dur) {
    const ctx = this._audioCtx
    if (!ctx) return
    const now = ctx.currentTime + startTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur)
    }
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(gainStart, now + 0.0005)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.005)
  }

  playClick() {
    if (!this._soundEnabled) return
    this.initAudio()
    this.playTone('triangle', 420, 420, 0.12, 0.001, 0, 0.025)
    this.playTone('square', 1400, 700, 0.08, 0.001, 0, 0.012)
  }

  playClack() {
    if (!this._soundEnabled) return
    this.initAudio()
    this.playTone('triangle', 300, 300, 0.12, 0.001, 0, 0.03)
    this.playTone('square', 1000, 500, 0.07, 0.001, 0, 0.014)
  }

  // ===== Settings =====

  updateSettings(settings) {
    if (typeof settings.soundEnabled === 'boolean') this._soundEnabled = settings.soundEnabled
    if (typeof settings.vibrationEnabled === 'boolean') this._vibrationEnabled = settings.vibrationEnabled
    if (typeof settings.layout === 'string') this.setLayout(settings.layout)
  }

  // ===== UI helpers =====

  setStatus(text) {
    this._statusEl.textContent = text
    this._statusEl.classList.toggle('visible', text !== 'Conectado')
  }
}
customElements.define('mando-gamepad', MandoGamepad)
