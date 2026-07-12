class MandoJoystick extends HTMLElement {
  constructor() {
    super()
    this._pointerId = null
    this._lastAxis = { x: 0, y: 0 }
    this._center = { x: 0, y: 0 }
    this._maxRadius = 0
    this._deadzone = 0.05
  }

  connectedCallback() {
    this.render()
    this.setupEvents()
  }

  render() {
    this.className = 'bg-panel border border-panel-border/30 rounded-xl relative flex items-center justify-center text-muted'
    this.style.overflow = 'hidden'

    this._glow = document.createElement('div')
    this._glow.style.cssText = `
      position:absolute;width:250px;height:250px;border-radius:50%;
      pointer-events:none;opacity:0;
      transition:opacity 100ms ease-out;
      background:radial-gradient(circle,rgba(30,130,255,0.2) 0%,rgba(30,130,255,0) 50%,transparent 70%);
      filter:blur(44px);
      transform:translate(-50%,-50%);left:50%;top:50%;
    `
    this.appendChild(this._glow)

    this._innerGlow = document.createElement('div')
    this._innerGlow.style.cssText = `
      position:absolute;inset:0;pointer-events:none;opacity:0;
      transition:opacity 100ms ease-out;
      border-radius:inherit;
      border:0.5px solid rgba(30,130,255,0.2);
      box-shadow:inset 0 0 1.5px 0.5px rgba(30,130,255,0.04);
    `
    this.appendChild(this._innerGlow)

    this._centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this._centerDot.setAttribute('width', '8')
    this._centerDot.setAttribute('height', '8')
    this._centerDot.setAttribute('viewBox', '0 0 8 8')
    this._centerDot.style.cssText = 'pointer-events:none; display:block; opacity:0.25; color:#888;'
    this._centerDot.innerHTML = '<circle cx="4" cy="4" r="2.5" fill="currentColor"/>'
    this.appendChild(this._centerDot)
  }

  setupEvents() {
    const dzn = this.getAttribute('deadzone')
    if (dzn !== null) this._deadzone = parseFloat(dzn) || 0.05
    const axisX = this.getAttribute('axis-x') || 'leftX'
    const axisY = this.getAttribute('axis-y') || 'leftY'

    this.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (this._pointerId !== null) return
      try { this.setPointerCapture(e.pointerId); this._pointerId = e.pointerId } catch {}

      const rect = this.getBoundingClientRect()
      this._center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      this._maxRadius = Math.min(rect.width, rect.height) / 2

      this._glow.style.opacity = '1'
      this._innerGlow.style.opacity = '1'
      this.moveDot(e.clientX, e.clientY)
      this.sendAxes(e, axisX, axisY)
    })

    this.addEventListener('pointermove', (e) => {
      if (this._pointerId !== e.pointerId) return
      e.preventDefault()
      this.moveDot(e.clientX, e.clientY)
      this.sendAxes(e, axisX, axisY)
    })

    this.addEventListener('pointerup', (e) => {
      if (this._pointerId !== e.pointerId) return
      e.preventDefault()
      try { this.releasePointerCapture(this._pointerId) } catch {}
      this._pointerId = null
      this._glow.style.opacity = '0'
      this._glow.style.left = '50%'
      this._glow.style.top = '50%'
      this._innerGlow.style.opacity = '0'
      if (this._lastAxis.x !== 0) {
        this._lastAxis.x = 0
        this.dispatchEvent(new CustomEvent('axis', { detail: { axis: axisX, value: 0 }, bubbles: true }))
      }
      if (this._lastAxis.y !== 0) {
        this._lastAxis.y = 0
        this.dispatchEvent(new CustomEvent('axis', { detail: { axis: axisY, value: 0 }, bubbles: true }))
      }
    })

    this.addEventListener('pointercancel', (e) => {
      if (this._pointerId !== e.pointerId) return
      try { this.releasePointerCapture(this._pointerId) } catch {}
      this._pointerId = null
      this._glow.style.opacity = '0'
      this._glow.style.left = '50%'
      this._glow.style.top = '50%'
      this._innerGlow.style.opacity = '0'
      this._lastAxis = { x: 0, y: 0 }
    })

    this.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  moveDot(clientX, clientY) {
    const rect = this.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    let dx = clientX - rect.left
    let dy = clientY - rect.top
    const dist = Math.sqrt((dx - cx) ** 2 + (dy - cy) ** 2)
    const maxR = Math.min(rect.width, rect.height) / 2
    if (dist > maxR) {
      const r = maxR / dist
      dx = cx + (dx - cx) * r
      dy = cy + (dy - cy) * r
    } else if (dist < 1) {
      dx = cx
      dy = cy
    }
    this._glow.style.left = `${dx}px`
    this._glow.style.top = `${dy}px`
  }

  sendAxes(event, axisX, axisY) {
    const dx = event.clientX - this._center.x
    const dy = event.clientY - this._center.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    let normX = 0
    let normY = 0
    if (dist > 0) {
      const clamped = Math.min(dist, this._maxRadius)
      const r = clamped / dist
      normX = (dx * r) / this._maxRadius
      normY = (dy * r) / this._maxRadius
    }
    if (Math.abs(normX) < this._deadzone) normX = 0
    if (Math.abs(normY) < this._deadzone) normY = 0
    normY = -normY
    const rx = Math.round(normX * 100) / 100
    const ry = Math.round(normY * 100) / 100
    if (rx !== this._lastAxis.x) {
      this._lastAxis.x = rx
      this.dispatchEvent(new CustomEvent('axis', { detail: { axis: axisX, value: rx }, bubbles: true }))
    }
    if (ry !== this._lastAxis.y) {
      this._lastAxis.y = ry
      this.dispatchEvent(new CustomEvent('axis', { detail: { axis: axisY, value: ry }, bubbles: true }))
    }
  }
}
customElements.define('mando-joystick', MandoJoystick)
