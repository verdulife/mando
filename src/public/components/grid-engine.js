import { CODES } from '../layouts/diccionario.js'

export const SVG_ICONS = {
  SELECT: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="3" y="6" width="12" height="9" rx="1.5" opacity="0.6" /><rect x="9" y="9" width="12" height="9" rx="1.5" /></svg>',
  START: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="4" y="6" width="16" height="2.5" rx="1.2" /><rect x="4" y="11" width="16" height="2.5" rx="1.2" /><rect x="4" y="16" width="16" height="2.5" rx="1.2" /></svg>',
}

export function buildLayout(config) {
  const app = document.createElement('div')
  app.id = 'app'
  app.className = 'h-dvh w-full grid grid-cols-12 grid-rows-6 gap-[2px] p-[2px]'

  // Detect valid rectangular areas (CSS grid-template-areas silently fails on non-rectangular ones)
  const matrix = config.areas.map(row => row.split(/\s+/))
  const validCodes = new Set()
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      const code = matrix[r][c]
      if (code === '--' || validCodes.has(code)) continue
      let minR = r, maxR = r, minC = c, maxC = c
      for (let rr = 0; rr < 6; rr++)
        for (let cc = 0; cc < 12; cc++)
          if (matrix[rr][cc] === code) {
            minR = Math.min(minR, rr); maxR = Math.max(maxR, rr)
            minC = Math.min(minC, cc); maxC = Math.max(maxC, cc)
          }
      let valid = true
      for (let rr = minR; rr <= maxR; rr++)
        for (let cc = minC; cc <= maxC; cc++)
          if (matrix[rr][cc] !== code) { valid = false; break }
      if (valid) validCodes.add(code)
    }
  }

  app.style.gridTemplateAreas = config.areas.map(row =>
    '"' + row.split(/\s+/).map(t => t === '--' ? '.' : (validCodes.has(t) ? t : '.')).join(' ') + '"'
  ).join(' ')

  const used = new Set()
  for (const row of config.areas) {
    for (const token of row.split(/\s+/)) {
      if (token === '--' || !validCodes.has(token) || used.has(token)) continue
      used.add(token)
      const el = createComponent(token, config.components?.[token])
      if (el) {
        el.style.gridArea = token
        app.appendChild(el)
      }
    }
  }

  return app
}

export function createComponent(code, overrides) {
  const def = { ...(CODES[code] || {}), ...(overrides || {}) }
  if (!def.type) return
  switch (def.type) {
    case 'button': {
      const el = document.createElement('mando-button')
      el.setAttribute('name', code)
      if (def.label) el.setAttribute('label', def.label)
      const icon = def.icon ? (SVG_ICONS[def.icon] || def.icon) : null
      if (icon) el.setAttribute('icon', icon)
      if (def.color) el.setAttribute('color', def.color)
      if (def.class) el.setAttribute('class', def.class)
      return el
    }
    case 'joystick': {
      const el = document.createElement('mando-joystick')
      el.setAttribute('axis-x', def.axisX || code + 'X')
      el.setAttribute('axis-y', def.axisY || code + 'Y')
      return el
    }
    case 'abxy':
    case 'ab':
    case 'abx':
    case 'dpad': {
      const el = document.createElement('mando-pad')
      el.setAttribute('mode', def.type === 'abxy' ? 'abxy' : def.type === 'dpad' ? 'dpad' : def.type)
      if (def.debug) el.setAttribute('debug', '')
      return el
    }
  }
}
