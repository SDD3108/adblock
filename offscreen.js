import {DEFAULT_MODEL, PROMPT, cropRect, apiError} from './shared.js'
let busy = false
async function processImage(m) {
  let timer, bitmap
  try {
    const binary = atob(m.screenshot.split(',')[1])
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}))
    const r = cropRect(m.rect, m.viewport, bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = r.width; canvas.height = r.height
    canvas.getContext('2d').drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
    bitmap.close(); bitmap = null; m.screenshot = null
    const data = canvas.toDataURL('image/png').split(',')[1]
    if (data.length > 18000000) throw new Error('Область слишком большая. Выдели меньший фрагмент.')
    const model = (m.model || DEFAULT_MODEL).replace(/^models\//, '')
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Некорректное имя модели в настройках.')
    const controller = new AbortController()
    timer = setTimeout(() => controller.abort(), 120000)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': m.apiKey}, signal: controller.signal,
      body: JSON.stringify({contents: [{role: 'user', parts: [{text: m.prompt || PROMPT}, {inline_data: {mime_type: 'image/png', data}}]}], generationConfig: {maxOutputTokens: 8192}})
    })
    if (!response.ok) throw new Error(apiError(response.status))
    const json = await response.json()
    const candidate = json.candidates?.[0]
    const text = candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('\n').trim()
    if (!text) throw new Error(json.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY' ? 'Gemini заблокировал запрос. Попробуй другой фрагмент.' : 'Gemini не вернул текст. Попробуй другую модель или более чёткое выделение.')
    await chrome.runtime.sendMessage({type: 'result', id: m.id, status: 'done', text: text + (candidate.finishReason === 'MAX_TOKENS' ? '\n\n[Ответ обрезан по лимиту. Выдели меньше вопросов.]' : '')})
  } catch (e) {
    const text = e.name === 'AbortError' ? 'Ответ не получен за 2 минуты. Повтори попытку.' : e instanceof TypeError ? 'Ошибка соединения с Gemini. Проверь интернет и доступность API.' : e.message
    await chrome.runtime.sendMessage({type: 'result', id: m.id, status: 'error', text}).catch(() => {})
  } finally { clearTimeout(timer); bitmap?.close(); m.apiKey = null; m.screenshot = null; busy = false }
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (sender.id !== chrome.runtime.id || m.target !== 'offscreen' || m.type !== 'process') return
  if (busy) { reply({ok: false}); return }
  busy = true; reply({ok: true}); void processImage(m)
})
