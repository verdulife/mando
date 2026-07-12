class MandoButton extends HTMLElement {
  constructor() {
    super()
    this._pressed = false
    this._capturedPointerId = null
  }

  connectedCallback() {
    this.render()
    this.setupEvents()
  }

  render() {
    const name = this.getAttribute('name') || ''
    const label = this.getAttribute('label') || name
    const icon = this.getAttribute('icon')
    const cls = this.getAttribute('class') || ''
    const color = this.getAttribute('color')

    if (cls) this.className = cls
    else this.className = 'mando-btn'
    this.style.position = 'relative'
    this.style.overflow = 'hidden'

    if (icon) {
      this.innerHTML = icon
    } else {
      this.textContent = label
    }

    if (color) this.style.setProperty('color', color)

    this._glow = document.createElement('div')
    this._glow.style.cssText = `
      position:absolute;width:250px;height:250px;border-radius:50%;
      pointer-events:none;opacity:0;
      transition:opacity 100ms ease-out;
      background:radial-gradient(circle,rgba(30,130,255,0.2) 0%,rgba(30,130,255,0) 50%,transparent 70%);
      filter:blur(44px);
      transform:translate(-50%,-50%);
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
  }

  setupEvents() {
    const name = this.getAttribute('name') || ''

    const press = (e) => {
      e.preventDefault()
      if (this._pressed) return
      try { this.setPointerCapture(e.pointerId); this._capturedPointerId = e.pointerId } catch {}
      this._pressed = true
      this.classList.add('active')
      this._innerGlow.style.opacity = '1'
      this.updateGlows(e)
      this.dispatchEvent(new CustomEvent('button-down', { detail: { name }, bubbles: true }))
    }

    const move = (e) => {
      if (!this._pressed || this._capturedPointerId !== e.pointerId) return
      e.preventDefault()
      this.updateGlows(e)
    }

    const release = (e) => {
      e.preventDefault()
      if (!this._pressed) return
      if (this._capturedPointerId !== null) {
        try { this.releasePointerCapture(this._capturedPointerId) } catch {}
        this._capturedPointerId = null
      }
      this._pressed = false
      this.classList.remove('active')
      this._glow.style.opacity = '0'
      this._innerGlow.style.opacity = '0'
      this.dispatchEvent(new CustomEvent('button-up', { detail: { name }, bubbles: true }))
    }

    this.addEventListener('pointerdown', press)
    this.addEventListener('pointermove', move)
    this.addEventListener('pointerup', release)
    this.addEventListener('pointercancel', release)
    this.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  updateGlows(e) {
    const rect = this.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this._glow.style.left = `${x}px`
    this._glow.style.top = `${y}px`
    this._glow.style.opacity = '1'
  }
}
customElements.define('mando-button', MandoButton)
