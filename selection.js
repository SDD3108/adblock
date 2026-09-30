(() => {
  if (globalThis.__areaCleanup) { globalThis.__areaCleanup(); return }
  const host = document.createElement('div')
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;'
  const root = host.attachShadow({mode: 'closed'})
  root.innerHTML = `<style>:host{all:initial}*{box-sizing:border-box}.overlay{position:fixed;inset:0;cursor:crosshair;user-select:none;touch-action:none;background:rgba(0,0,0,.2)}.box{display:none;position:absolute;border:2px solid #e62939;background:transparent;box-shadow:0 0 0 99999px rgba(0,0,0,.32);pointer-events:none}.hint{position:absolute;top:18px;left:50%;transform:translateX(-50%);padding:10px 16px;background:#fff;border-radius:8px;color:#222;font:14px system-ui;white-space:nowrap;pointer-events:none}</style><div class="overlay"><div class="box"></div><div class="hint">Выдели область с вопросами · Esc — отмена</div></div>`
  const overlay = root.querySelector('.overlay'), box = root.querySelector('.box'), hint = root.querySelector('.hint')
  let begin, end, done = false
  const viewport = {width: innerWidth, height: innerHeight}
  const point = e => ({x: Math.max(0, Math.min(innerWidth, e.clientX)), y: Math.max(0, Math.min(innerHeight, e.clientY))})
  const rect = () => ({x: Math.min(begin.x, end.x), y: Math.min(begin.y, end.y), width: Math.abs(end.x - begin.x), height: Math.abs(end.y - begin.y)})
  function cleanup() {
    done = true; host.remove()
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('resize', cleanup)
    window.removeEventListener('blur', cleanup)
    window.removeEventListener('wheel', block, true)
    window.removeEventListener('scroll', cleanup, true)
    delete globalThis.__areaCleanup
  }
  const block = e => { e.preventDefault(); e.stopImmediatePropagation() }
  function key(e) { block(e); if (e.key === 'Escape') cleanup() }
  overlay.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    e.preventDefault(); begin = end = point(e); overlay.setPointerCapture(e.pointerId)
    hint.hidden = true; overlay.style.background = 'transparent'; box.style.display = 'block'
    Object.assign(box.style, {left: `${begin.x}px`, top: `${begin.y}px`, width: '0px', height: '0px'})
  })
  overlay.addEventListener('pointermove', e => {
    if (!begin) return
    end = point(e); const r = rect()
    Object.assign(box.style, {left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px`})
  })
  overlay.addEventListener('pointerup', async e => {
    if (!begin || done) return
    end = point(e); const area = rect(); cleanup()
    if (area.width < 5 || area.height < 5) return
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const response = await chrome.runtime.sendMessage({type: 'capture', rect: area, viewport})
      if (!response?.ok) console.warn('AdBlock:', response?.error || 'Не удалось отправить выделение')
    } catch { /* Extension may have been reloaded during selection. */ }
  })
  overlay.addEventListener('pointercancel', cleanup)
  overlay.addEventListener('contextmenu', e => { block(e); cleanup() })
  window.addEventListener('keydown', key, true)
  window.addEventListener('resize', cleanup)
  window.addEventListener('blur', cleanup)
  window.addEventListener('scroll', cleanup, true)
  window.addEventListener('wheel', block, {capture: true, passive: false})
  globalThis.__areaCleanup = cleanup
  document.documentElement.append(host)
})()
