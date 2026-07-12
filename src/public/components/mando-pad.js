const ABX_ROTATION = Math.PI / 6

function letterPos(angleDeg) {
  const a = angleDeg * Math.PI / 180
  const k = 25
  const left = 50 + k * Math.cos(a) - 19
  const top  = 50 + k * Math.sin(a) - 19
  return `top:${top}%;left:${left}%`
}

class MandoPad extends HTMLElement {
  constructor() {
    super()
    this._pointers = new Map()
    this._counts = {}
    this._refs = {}
    this._glowPool = []
    this._glowIndex = 0
  }

  connectedCallback() {
    this.render()
    this.setupEvents()
  }

  render() {
    const mode = this.getAttribute('mode') || 'abxy'
    this.className = 'relative rounded-xl bg-panel border border-panel-border/30'
    this.style.overflow = 'hidden'

    this._counts = {}
    this._refs = {}

    const SVG_LINE_V = '<svg viewBox="0 0 24 24" width="50" height="50" fill="currentColor"><rect x="11.5" y="0" width="0.5" height="24" rx="0.25"/></svg>'
    const SVG_LINE_H = '<svg viewBox="0 0 24 24" width="50" height="50" fill="currentColor"><rect x="0" y="11.5" width="24" height="0.5" rx="0.25"/></svg>'

    const buttons = mode === 'dpad' ? [
      { ref: 'UP',    svg: SVG_LINE_V, pos: 'top-[6%] left-[31%]', color: '#888888' },
      { ref: 'LEFT',  svg: SVG_LINE_H, pos: 'top-[31%] left-[6%]', color: '#888888' },
      { ref: 'RIGHT', svg: SVG_LINE_H, pos: 'top-[31%] right-[6%]', color: '#888888' },
      { ref: 'DOWN',  svg: SVG_LINE_V, pos: 'bottom-[6%] left-[31%]', color: '#888888' },
    ] : mode === 'ab' ? [
      { ref: 'A', text: 'A', pos: 'bottom:10%;left:10%', color: '#4ade80' },
      { ref: 'B', text: 'B', pos: 'top:10%;right:10%', color: '#ff4d4d' },
    ] : mode === 'abx' ? [
      { ref: 'A', text: 'A', pos: letterPos(90),  color: '#4ade80' },
      { ref: 'B', text: 'B', pos: letterPos(210), color: '#ff4d4d' },
      { ref: 'X', text: 'X', pos: letterPos(330), color: '#4c9aff' },
    ] : [
      { ref: 'Y', text: 'Y', pos: 'top-[6%] left-[31%]', color: '#f5d742' },
      { ref: 'X', text: 'X', pos: 'top-[31%] left-[6%]', color: '#4c9aff' },
      { ref: 'B', text: 'B', pos: 'top-[31%] right-[6%]', color: '#ff4d4d' },
      { ref: 'A', text: 'A', pos: 'bottom-[6%] left-[31%]', color: '#4ade80' },
    ]

    for (const { ref, text, svg, pos, color, rot, decorative } of buttons) {
      const el = document.createElement('div')
      el.className = 'face-btn-ref'
      if (pos.includes(';')) {
        el.style.cssText = pos
      } else {
        el.className += ` ${pos}`
      }
      el.style.color = color
      if (svg) {
        el.innerHTML = svg
      } else {
        el.textContent = text
      }
      if (rot !== undefined) {
        el.style.transform = `rotate(${rot}deg)`
      }
      this.appendChild(el)
      this._refs[ref] = el
      if (!decorative) {
        this._counts[ref] = 0
      }
    }

    this._innerGlow = document.createElement('div')
    this._innerGlow.style.cssText = `
      position:absolute;inset:0;pointer-events:none;opacity:0;
      transition:opacity 100ms ease-out;
      border-radius:inherit;
      border:0.5px solid rgba(30,130,255,0.2);
      box-shadow:inset 0 0 1.5px 0.5px rgba(30,130,255,0.04);
    `
    this.appendChild(this._innerGlow)

    for (let i = 0; i < 4; i++) {
      const g = document.createElement('div')
      g.style.cssText = `
        position:absolute;width:250px;height:250px;border-radius:50%;
        pointer-events:none;opacity:0;
        transition:opacity 100ms ease-out;
        background:radial-gradient(circle,rgba(30,130,255,0.2) 0%,rgba(30,130,255,0) 50%,transparent 70%);
        filter:blur(44px);
        transform:translate(-50%,-50%);
      `
      this.appendChild(g)
      this._glowPool.push(g)
    }

    if (this.hasAttribute('debug') && mode === 'abx') {
      const svgNS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(svgNS, 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10'

      const r = 12
      const a1 = ABX_ROTATION, a2 = ABX_ROTATION + 2 * Math.PI / 3, a3 = ABX_ROTATION + 4 * Math.PI / 3
      function pt(angle) {
        return { x: 12 + r * Math.cos(angle), y: 12 + r * Math.sin(angle) }
      }
      const p1 = pt(a1), p2 = pt(a2), p3 = pt(a3)

      function sector(start, end, color) {
        const pS = pt(start), pE = pt(end)
        const path = document.createElementNS(svgNS, 'path')
        const large = end - start > Math.PI ? 1 : 0
        path.setAttribute('d', `M 12 12 L ${pS.x.toFixed(1)} ${pS.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${pE.x.toFixed(1)} ${pE.y.toFixed(1)} Z`)
        path.setAttribute('fill', color)
        path.setAttribute('stroke', color.replace('0.15', '0.4'))
        path.setAttribute('stroke-width', '0.5')
        return path
      }

      svg.appendChild(sector(a1, a2, 'rgba(74,222,128,0.15)'))
      svg.appendChild(sector(a2, a3, 'rgba(255,77,77,0.12)'))
      svg.appendChild(sector(a3, 2 * Math.PI, 'rgba(76,154,255,0.15)'))

      function label(angle, text, color) {
        const p = pt(angle)
        const t = document.createElementNS(svgNS, 'text')
        t.setAttribute('x', p.x.toFixed(1))
        t.setAttribute('y', p.y.toFixed(1))
        t.setAttribute('text-anchor', 'middle')
        t.setAttribute('dominant-baseline', 'central')
        t.setAttribute('font-size', '3')
        t.setAttribute('fill', color)
        t.setAttribute('font-weight', 'bold')
        t.textContent = text
        return t
      }
      svg.appendChild(label(a1 + Math.PI / 3, 'A', 'rgba(74,222,128,0.8)'))
      svg.appendChild(label(a2 + Math.PI / 3, 'B', 'rgba(255,77,77,0.8)'))
      svg.appendChild(label(a3 + Math.PI / 3 - 2 * Math.PI, 'X', 'rgba(76,154,255,0.8)'))

      this.appendChild(svg)
    }
  }

  getButtonFromAngle(angle) {
    const mode = this.getAttribute('mode') || 'abxy'
    if (mode === 'dpad') {
      if (angle >= 15 * Math.PI / 8 || angle < Math.PI / 8) return 'RIGHT'
      if (angle < 3 * Math.PI / 8) return 'RIGHT+DOWN'
      if (angle < 5 * Math.PI / 8) return 'DOWN'
      if (angle < 7 * Math.PI / 8) return 'DOWN+LEFT'
      if (angle < 9 * Math.PI / 8) return 'LEFT'
      if (angle < 11 * Math.PI / 8) return 'LEFT+UP'
      if (angle < 13 * Math.PI / 8) return 'UP'
      return 'UP+RIGHT'
    }
    if (mode === 'ab') {
      if (angle >= Math.PI / 4 && angle < 5 * Math.PI / 4) return 'A'
      return 'B'
    }
    if (mode === 'abx') {
      const a = (angle - ABX_ROTATION + 2 * Math.PI) % (2 * Math.PI)
      if (a < 2 * Math.PI / 3) return 'A'
      if (a < 4 * Math.PI / 3) return 'B'
      return 'X'
    }
    if (angle >= 7 * Math.PI / 4 || angle < Math.PI / 4) return 'B'
    if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) return 'A'
    if (angle >= 3 * Math.PI / 4 && angle < 5 * Math.PI / 4) return 'X'
    return 'Y'
  }

  getButtonFromEvent(event) {
    const rect = this.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = event.clientX - cx
    const dy = event.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxR = Math.min(rect.width, rect.height) / 2
    const mode = this.getAttribute('mode') || 'abxy'
    let angle = Math.atan2(dy, dx)
    if (angle < 0) angle += 2 * Math.PI
    if (mode === 'ab' || mode === 'abx') return this.getButtonFromAngle(angle)
    if (dist < maxR * 0.10) return null
    return this.getButtonFromAngle(angle)
  }

  acquireGlow(e) {
    const g = this._glowPool[this._glowIndex % 4]
    this._glowIndex++
    const rect = this.getBoundingClientRect()
    g.style.left = `${e.clientX - rect.left}px`
    g.style.top = `${e.clientY - rect.top}px`
    g.style.opacity = '1'
    return g
  }

  releaseGlow(g) {
    g.style.opacity = '0'
  }

  moveGlow(g, e) {
    const rect = this.getBoundingClientRect()
    g.style.left = `${e.clientX - rect.left}px`
    g.style.top = `${e.clientY - rect.top}px`
  }

  pressButton(button) {
    if (!button) return
    const mode = this.getAttribute('mode') || 'abxy'
    if (mode === 'dpad') {
      const parts = button.split('+')
      const m = { UP: 'dpadVert', DOWN: 'dpadVert', LEFT: 'dpadHorz', RIGHT: 'dpadHorz' }
      const v = { UP: 1, DOWN: -1, LEFT: -1, RIGHT: 1 }
      for (const part of parts) {
        if (!this._refs[part]) continue
        const wasPressed = this._counts[part] > 0
        this._counts[part]++
        if (!wasPressed) {
          this._refs[part].classList.add('active')
          this.dispatchEvent(new CustomEvent('axis', { detail: { axis: m[part], value: v[part] }, bubbles: true }))
        }
      }
      return
    }
    if (!this._refs[button]) return
    const wasPressed = this._counts[button] > 0
    this._counts[button]++
    if (!wasPressed) {
      this._refs[button].classList.add('active')
      this.dispatchEvent(new CustomEvent('button-down', { detail: { name: button }, bubbles: true }))
    }
  }

  releaseButton(button) {
    if (!button) return
    const mode = this.getAttribute('mode') || 'abxy'
    if (mode === 'dpad') {
      const parts = button.split('+')
      const m = { UP: 'dpadVert', DOWN: 'dpadVert', LEFT: 'dpadHorz', RIGHT: 'dpadHorz' }
      for (const part of parts) {
        if (!this._refs[part]) continue
        this._counts[part]--
        if (this._counts[part] === 0) {
          this._refs[part].classList.remove('active')
          this.dispatchEvent(new CustomEvent('axis', { detail: { axis: m[part], value: 0 }, bubbles: true }))
        }
      }
      return
    }
    if (!this._refs[button]) return
    this._counts[button]--
    if (this._counts[button] === 0) {
      this._refs[button].classList.remove('active')
      this.dispatchEvent(new CustomEvent('button-up', { detail: { name: button }, bubbles: true }))
    }
  }

  setupEvents() {
    this.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (this._pointers.has(e.pointerId)) return
      try { this.setPointerCapture(e.pointerId) } catch {}
      this._innerGlow.style.opacity = '1'
      const btn = this.getButtonFromEvent(e)
      const glow = this.acquireGlow(e)
      this._pointers.set(e.pointerId, { button: btn, glow })
      this.pressButton(btn)
    })

    this.addEventListener('pointermove', (e) => {
      const entry = this._pointers.get(e.pointerId)
      if (!entry) return
      e.preventDefault()
      this.moveGlow(entry.glow, e)
      const oldBtn = entry.button
      const newBtn = this.getButtonFromEvent(e)
      if (oldBtn !== newBtn) {
        this.releaseButton(oldBtn)
        entry.button = newBtn
        this.pressButton(newBtn)
      }
    })

    this.addEventListener('pointerup', (e) => {
      const entry = this._pointers.get(e.pointerId)
      if (!entry) return
      e.preventDefault()
      try { this.releasePointerCapture(e.pointerId) } catch {}
      this._pointers.delete(e.pointerId)
      if (this._pointers.size === 0) this._innerGlow.style.opacity = '0'
      this.releaseGlow(entry.glow)
      this.releaseButton(entry.button)
    })

    this.addEventListener('pointercancel', (e) => {
      const entry = this._pointers.get(e.pointerId)
      if (!entry) return
      try { this.releasePointerCapture(e.pointerId) } catch {}
      this._pointers.delete(e.pointerId)
      if (this._pointers.size === 0) this._innerGlow.style.opacity = '0'
      this.releaseGlow(entry.glow)
      this.releaseButton(entry.button)
    })

    this.addEventListener('contextmenu', (e) => e.preventDefault())
  }
}
customElements.define('mando-pad', MandoPad)
