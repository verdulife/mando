import { buildLayout } from './components/grid-engine.js'
import './components/mando-button.js'
import './components/mando-joystick.js'
import './components/mando-pad.js'

export function openBuilder(existing) {
  const already = document.getElementById('builder-overlay')
  if (already) already.remove()

  const model = existing
    ? { ...existing, areas: [...existing.areas] }
    : emptyModel()

  const overlay = document.createElement('div')
  overlay.id = 'builder-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center'

  let selCode = null
  let selRect = null
  let dragFromRect = null

  function emptyModel() {
    const row = '-- '.repeat(11) + '--'
    return { id: '', name: '', areas: Array(6).fill(row) }
  }

  function gridToMatrix(a) {
    return a.map(r => r.split(/\s+/))
  }

  function matrixToAreas(m) {
    return m.map(r => r.join(' '))
  }

  function cloneMatrix(m) {
    return m.map(r => [...r])
  }

  function findAreaRect(matrix, row, col) {
    const code = matrix[row][col]
    if (code === '--') return null
    const cells = []
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 12; c++)
        if (matrix[r][c] === code) cells.push([r, c])
    if (!cells.length) return null
    const minR = Math.min(...cells.map(p => p[0]))
    const maxR = Math.max(...cells.map(p => p[0]))
    const minC = Math.min(...cells.map(p => p[1]))
    const maxC = Math.max(...cells.map(p => p[1]))
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        if (matrix[r][c] !== code) return { r, c, w: 1, h: 1, code }
    return { r: minR, c: minC, w: maxC - minC + 1, h: maxR - minR + 1, code }
  }

  function getValidRect(matrix, row, col) {
    const code = matrix[row][col]
    if (code === '--') return null
    let minR = row, maxR = row, minC = col, maxC = col
    for (let rr = 0; rr < 6; rr++)
      for (let cc = 0; cc < 12; cc++)
        if (matrix[rr][cc] === code) {
          minR = Math.min(minR, rr); maxR = Math.max(maxR, rr)
          minC = Math.min(minC, cc); maxC = Math.max(maxC, cc)
        }
    for (let rr = minR; rr <= maxR; rr++)
      for (let cc = minC; cc <= maxC; cc++)
        if (matrix[rr][cc] !== code) return null
    return { r: minR, c: minC, w: maxC - minC + 1, h: maxR - minR + 1, code }
  }

  function computeValidCells(matrix) {
    const valid = new Set()
    const visited = new Set()
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 12; c++) {
        const key = r * 12 + c
        if (visited.has(key)) continue
        const code = matrix[r][c]
        if (code === '--') { visited.add(key); continue }
        visited.add(key)
        const rect = getValidRect(matrix, r, c)
        if (rect) {
          for (let rr = rect.r; rr < rect.r + rect.h; rr++)
            for (let cc = rect.c; cc < rect.c + rect.w; cc++) {
              valid.add(rr * 12 + cc)
              visited.add(rr * 12 + cc)
            }
        }
      }
    }
    return valid
  }

  function codeExists(matrix, code) {
    if (code === '--') return false
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 12; c++)
        if (matrix[r][c] === code) return true
    return false
  }

  let resizeDir = null
  let resizeStartRect = null
  let resizeValid = false

  function renderPreview() {
    const container = document.getElementById('builder-preview')
    if (!container) return
    const w = container.offsetWidth
    const h = w * 0.48
    container.style.cssText = `width:100%;height:${h}px;position:relative`
    container.innerHTML = ''
    const m = gridToMatrix(model.areas)
    const areas = matrixToAreas(m)

    // Layer 1: buildLayout component preview (real components, normal flow, no pointer events)
    const config = { id: model.id, name: model.name, areas }
    const layoutEl = buildLayout(config)
    layoutEl.style.height = `${h}px`
    layoutEl.style.pointerEvents = 'none'
    container.appendChild(layoutEl)

    // Layer 2: cell grid with borders, code text (only for invalid areas), and interaction
    const validCells = computeValidCells(m)
    const grid = document.createElement('div')
    grid.style.cssText = 'position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(6,1fr)'
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 12; c++) {
        const code = m[r][c]
        const cell = document.createElement('div')
        cell.dataset.r = r
        cell.dataset.c = c
        let cs = 'border:0.125px solid rgba(255,255,255,0.008);display:flex;align-items:center;justify-content:center;font-size:7px;font-family:monospace;position:relative;'
        if (selRect && r >= selRect.r && r < selRect.r + selRect.h && c >= selRect.c && c < selRect.c + selRect.w) {
          cs += 'outline:2px solid #4c9aff;outline-offset:-1px;z-index:1;'
        }
        cell.style.cssText = cs
        // Show code text only for invalid areas (non-rectangular). Hide empty.
        const isValid = validCells.has(r * 12 + c)
        cell.textContent = code === '--' ? '' : (isValid ? '' : code)
        if (code !== '--') cell.style.color = isValid ? 'transparent' : 'rgba(255,255,255,0.2)'
        // Draggable cells for repositioning (only valid rect areas)
        if (code !== '--' && isValid) {
          cell.draggable = true
          cell.addEventListener('dragstart', e => {
            const rect = getValidRect(m, r, c)
            if (!rect) { e.preventDefault(); return }
            dragFromRect = { ...rect, grabR: r, grabC: c }
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', code)
          })
        }
        cell.addEventListener('dragover', e => e.preventDefault())
        cell.addEventListener('drop', e => {
          e.preventDefault()
          const dropCode = e.dataTransfer.getData('text/plain')
          if (!dropCode) return
          const targetR = parseInt(cell.dataset.r)
          const targetC = parseInt(cell.dataset.c)

          if (dragFromRect) {
            // Move: reposition entire area
            const src = dragFromRect
            dragFromRect = null
            const dr = targetR - src.grabR
            const dc = targetC - src.grabC
            const nr = src.r + dr
            const nc = src.c + dc
            if (nr < 0 || nc < 0 || nr + src.h > 6 || nc + src.w > 12) return
            // Check overlap (exclude source cells)
            for (let rr = nr; rr < nr + src.h; rr++)
              for (let cc = nc; cc < nc + src.w; cc++)
                if (!(rr >= src.r && rr < src.r + src.h && cc >= src.c && cc < src.c + src.w) && m[rr][cc] !== '--') return
            // Apply move
            for (let rr = src.r; rr < src.r + src.h; rr++)
              for (let cc = src.c; cc < src.c + src.w; cc++)
                m[rr][cc] = '--'
            for (let rr = nr; rr < nr + src.h; rr++)
              for (let cc = nc; cc < nc + src.w; cc++)
                m[rr][cc] = src.code
            selRect = { r: nr, c: nc, w: src.w, h: src.h, code: src.code }
          } else {
            // From toolbar: place / replace area (no duplicates)
            if (codeExists(m, dropCode)) return
            const area = findAreaRect(m, targetR, targetC)
            if (area && area.code !== '--') {
              for (let rr = area.r; rr < area.r + area.h; rr++)
                for (let cc = area.c; cc < area.c + area.w; cc++)
                  m[rr][cc] = dropCode
            } else {
              m[targetR][targetC] = dropCode
            }
            selCode = null; selRect = null
          }
          model.areas = matrixToAreas(m)
          renderPreview()
        })
        cell.addEventListener('click', () => {
          const targetR = parseInt(cell.dataset.r)
          const targetC = parseInt(cell.dataset.c)
          const area = findAreaRect(m, targetR, targetC)
          selRect = area
          selCode = area ? area.code : null
          renderPreview()
        })

        grid.appendChild(cell)
      }
    }
    container.appendChild(grid)

    // Layer 3: resize handles (4 directional bars)
    if (selRect && selRect.code) renderHandles(container, m)
  }

  function computeNewRect(e, container, dir, startRect, matrix) {
    const bbox = container.getBoundingClientRect()
    const cellW = container.offsetWidth / 12
    const cellH = container.offsetHeight / 6
    const { r, c, w, h, code } = startRect
    const mx = e.clientX - bbox.left
    const my = e.clientY - bbox.top
    const gridR = Math.round(my / cellH)
    const gridC = Math.round(mx / cellW)
    let nr = r, nc = c, nw = w, nh = h
    switch (dir) {
      case 'top': nr = Math.max(0, Math.min(gridR, r + h - 1)); nh = r + h - nr; break
      case 'bottom': nh = Math.max(1, Math.min(gridR - r + 1, 6 - r)); break
      case 'left': nc = Math.max(0, Math.min(gridC, c + w - 1)); nw = c + w - nc; break
      case 'right': nw = Math.max(1, Math.min(gridC - c + 1, 12 - c)); break
    }
    let valid = true
    for (let rr = nr; rr < nr + nh; rr++) {
      for (let cc = nc; cc < nc + nw; cc++) {
        if (matrix[rr][cc] !== '--' && matrix[rr][cc] !== code) { valid = false; break }
      }
      if (!valid) break
    }
    return { r: nr, c: nc, w: nw, h: nh, valid, code }
  }

  function positionOverlay(el, rect, container) {
    const cellW = container.offsetWidth / 12
    const cellH = container.offsetHeight / 6
    el.style.top = `${rect.r * cellH}px`
    el.style.left = `${rect.c * cellW}px`
    el.style.width = `${rect.w * cellW}px`
    el.style.height = `${rect.h * cellH}px`
  }

  function renderHandles(container, matrix) {
    const cellW = container.offsetWidth / 12
    const cellH = container.offsetHeight / 6
    const { r, c, w, h } = selRect

    const overlay = document.createElement('div')
    overlay.id = 'resize-overlay'
    overlay.style.display = 'none'
    overlay.style.cssText = 'position:absolute;z-index:6;pointer-events:none;border:2px solid #4c9aff;background:rgba(76,154,255,0.08);border-radius:2px'
    container.appendChild(overlay)

    const dirs = [
      { d: 'top',    cursor: 'ns-resize', pos: `top:${r * cellH - 4}px;left:${c * cellW}px;width:${w * cellW}px;height:8px` },
      { d: 'bottom', cursor: 'ns-resize', pos: `top:${(r + h) * cellH - 4}px;left:${c * cellW}px;width:${w * cellW}px;height:8px` },
      { d: 'left',   cursor: 'ew-resize', pos: `left:${c * cellW - 4}px;top:${r * cellH}px;height:${h * cellH}px;width:8px` },
      { d: 'right',  cursor: 'ew-resize', pos: `left:${(c + w) * cellW - 4}px;top:${r * cellH}px;height:${h * cellH}px;width:8px` },
    ]

    for (const { d, cursor, pos } of dirs) {
      const handle = document.createElement('div')
      handle.style.cssText = `position:absolute;z-index:5;cursor:${cursor};${pos};border-radius:2px;background:rgba(76,154,255,0)`
      handle.addEventListener('pointerdown', e => {
        e.preventDefault()
        handle.setPointerCapture(e.pointerId)
        resizeDir = d
        resizeStartRect = { ...selRect }
        resizeValid = true
        overlay.style.display = 'block'
        overlay.style.border = '2px solid #4c9aff'
        overlay.style.background = 'rgba(76,154,255,0.08)'
        positionOverlay(overlay, selRect, container)
      })
      handle.addEventListener('pointermove', e => {
        if (!resizeDir || !resizeStartRect) return
        e.preventDefault()
        const r2 = computeNewRect(e, container, resizeDir, resizeStartRect, matrix)
        if (r2) {
          resizeValid = r2.valid
          positionOverlay(overlay, r2, container)
          overlay.style.border = r2.valid ? '2px solid #4c9aff' : '2px solid #ff4d4d'
          overlay.style.background = r2.valid ? 'rgba(76,154,255,0.08)' : 'rgba(255,77,77,0.08)'
        }
      })
      handle.addEventListener('pointerup', e => {
        if (!resizeDir || !resizeStartRect) return
        e.preventDefault()
        try { handle.releasePointerCapture(e.pointerId) } catch {}
        if (resizeValid) {
          const r2 = computeNewRect(e, container, resizeDir, resizeStartRect, matrix)
          if (r2 && r2.valid) {
            for (let rr = resizeStartRect.r; rr < resizeStartRect.r + resizeStartRect.h; rr++)
              for (let cc = resizeStartRect.c; cc < resizeStartRect.c + resizeStartRect.w; cc++)
                matrix[rr][cc] = '--'
            for (let rr = r2.r; rr < r2.r + r2.h; rr++)
              for (let cc = r2.c; cc < r2.c + r2.w; cc++)
                matrix[rr][cc] = resizeStartRect.code
            model.areas = matrixToAreas(matrix)
            selRect = { r: r2.r, c: r2.c, w: r2.w, h: r2.h, code: resizeStartRect.code }
          }
        }
        resizeDir = null; resizeStartRect = null; resizeValid = false
        overlay.style.display = 'none'
        renderPreview()
      })
      handle.addEventListener('pointercancel', () => {
        resizeDir = null; resizeStartRect = null; resizeValid = false
        overlay.style.display = 'none'
        renderPreview()
      })
      container.appendChild(handle)
    }
  }

  function applyCode(code) {
    if (!selRect) return
    const m = gridToMatrix(model.areas)
    // Prevent duplicate: code already exists outside the selected area
    if (code !== '--') {
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 12; c++)
          if (m[r][c] === code && !(r >= selRect.r && r < selRect.r + selRect.h && c >= selRect.c && c < selRect.c + selRect.w)) return
    }
    for (let r = selRect.r; r < selRect.r + selRect.h; r++)
      for (let c = selRect.c; c < selRect.c + selRect.w; c++)
        m[r][c] = code
    model.areas = matrixToAreas(m)
    selCode = code
    renderPreview()
  }

  function buildToolbar() {
    const codes = ['PD', 'AY', 'AB', 'ABX', 'BA', 'BB', 'BX', 'BY', 'LT', 'LB', 'RB', 'RT', 'L3', 'R3', 'SE', 'ST', 'LS', 'RS']
    const bar = document.createElement('div')
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:14px 20px;border-radius:8px'
    const TITLES = { PD: 'D-Pad', AY: 'ABXY', AB: 'A+B', ABX: 'ABX', BA: 'Botón A', BB: 'Botón B', BX: 'Botón X', BY: 'Botón Y', LT: 'Gatillo Izquierdo', LB: 'Hombro Izquierdo', RB: 'Hombro Derecho', RT: 'Gatillo Derecho', L3: 'Pulsar Joystick Izquierdo', R3: 'Pulsar Joystick Derecho', SE: 'SELECT', ST: 'START', LS: 'Joystick Izquierdo', RS: 'Joystick Derecho' }
    for (const code of codes) {
      const btn = document.createElement('div')
      btn.textContent = code
      btn.title = TITLES[code] || code
      btn.draggable = true
      btn.style.cssText = 'padding:8px 14px;font-size:13px;font-weight:600;font-family:monospace;border-radius:6px;cursor:grab;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;user-select:none;transition:background .15s;display:flex;align-items:center;justify-content:center;line-height:1'
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(76,154,255,0.2)'; btn.style.borderColor = '#4c9aff' })
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.06)'; btn.style.borderColor = 'rgba(255,255,255,0.1)' })
      btn.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', code) })
      btn.addEventListener('click', () => applyCode(code))
      bar.appendChild(btn)
    }
    const eraser = document.createElement('div')
    eraser.textContent = '🗑️'
    eraser.title = 'Borrar área'
    eraser.style.cssText = 'padding:3px 8px;font-size:13px;border-radius:4px;cursor:pointer;background:rgba(255,77,77,0.12);border:1px solid rgba(255,77,77,0.25);color:#ff4d4d;user-select:none;transition:background .15s'
    eraser.addEventListener('click', () => applyCode('--'))
    bar.appendChild(eraser)
    return bar
  }

  function buildBody() {
    overlay.innerHTML = ''
    const modal = document.createElement('div')
    modal.style.cssText = 'background:#151515;border:1px solid rgba(255,255,255,0.1);border-radius:12px;width:min(95vw,1100px);max-height:90vh;display:flex;flex-direction:column;overflow:hidden'

    // Header
    const header = document.createElement('div')
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06)'
    const hTitle = document.createElement('span')
    hTitle.textContent = existing ? 'Editar layout' : 'Crear layout'
    hTitle.style.cssText = 'font-size:16px;font-weight:700;color:#eee'
    const hBtns = document.createElement('div')
    hBtns.style.cssText = 'display:flex;gap:6px'
    const btnImport = document.createElement('button')
    btnImport.textContent = 'Importar'
    btnImport.style.cssText = 'padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#bbb;cursor:pointer'
    const inputFile = document.createElement('input')
    inputFile.type = 'file'
    inputFile.accept = '.json'
    inputFile.style.display = 'none'
    btnImport.appendChild(inputFile)
    btnImport.addEventListener('click', () => inputFile.click())
    inputFile.addEventListener('change', async () => {
      const file = inputFile.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.areas && Array.isArray(data.areas) && data.areas.length === 6) {
          model.id = data.id || ''
          model.name = data.name || ''
          model.areas = data.areas
          nameInput.value = model.name
          selCode = null; selRect = null
          renderPreview()
        }
      } catch { alert('JSON inválido') }
    })
    const btnExport = document.createElement('button')
    btnExport.textContent = 'Exportar'
    btnExport.style.cssText = 'padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#bbb;cursor:pointer'
    btnExport.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ id: model.id || 'mi-layout', name: nameInput.value || 'Mi Layout', areas: model.areas }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${model.id || 'mi-layout'}.json`; a.click()
      URL.revokeObjectURL(url)
    })
    const btnClose = document.createElement('button')
    btnClose.textContent = '✕'
    btnClose.style.cssText = 'font-size:16px;background:none;border:none;color:#888;cursor:pointer;padding:0 4px'
    btnClose.addEventListener('click', () => overlay.remove())
    hBtns.appendChild(btnImport)
    hBtns.appendChild(btnExport)
    hBtns.appendChild(btnClose)
    header.appendChild(hTitle)
    header.appendChild(hBtns)
    modal.appendChild(header)

    // Name input
    const nameRow = document.createElement('div')
    nameRow.style.cssText = 'padding:8px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06)'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = 'Nombre:'
    nameLabel.style.cssText = 'font-size:12px;color:#888;white-space:nowrap'
    const nameInput = document.createElement('input')
    nameInput.value = model.name
    nameInput.placeholder = 'Mi Layout'
    nameInput.style.cssText = 'flex:1;padding:5px 8px;font-size:13px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#eee;outline:none'
    nameRow.appendChild(nameLabel)
    nameRow.appendChild(nameInput)
    modal.appendChild(nameRow)

    // Toolbar
    modal.appendChild(buildToolbar())

    // Preview area
    const previewWrap = document.createElement('div')
    previewWrap.style.cssText = 'position:relative;margin:14px 20px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);background:#000'
    const preview = document.createElement('div')
    preview.id = 'builder-preview'
    preview.style.cssText = 'width:100%'
    previewWrap.appendChild(preview)
    modal.appendChild(previewWrap)

    // Footer
    const footer = document.createElement('div')
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06)'
    const btnCancel = document.createElement('button')
    btnCancel.textContent = 'Cancelar'
    btnCancel.style.cssText = 'padding:6px 14px;font-size:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#bbb;cursor:pointer'
    btnCancel.addEventListener('click', () => overlay.remove())
    const btnSave = document.createElement('button')
    btnSave.textContent = 'Guardar'
    btnSave.style.cssText = 'padding:6px 14px;font-size:12px;border-radius:6px;border:none;background:#4c9aff;color:#fff;cursor:pointer;font-weight:600'
    btnSave.addEventListener('click', async () => {
      const name = nameInput.value.trim() || 'Mi Layout'
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mi-layout'
      const res = await fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, areas: model.areas })
      })
      if (res.ok) {
        overlay.remove()
        if (typeof window._refreshLayouts === 'function') window._refreshLayouts()
      } else {
        const err = await res.json()
        alert('Error: ' + (err.error || 'desconocido'))
      }
    })
    footer.appendChild(btnCancel)
    footer.appendChild(btnSave)
    modal.appendChild(footer)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    renderPreview()
  }

  buildBody()
}

window.openBuilder = openBuilder
