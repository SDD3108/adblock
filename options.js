import {DEFAULT_MODEL, PROMPT, apiError} from './shared.js'
import {getApiKey} from './config.js'
const model = document.querySelector('#model'), prompt = document.querySelector('#prompt'), notice = document.querySelector('#notice')
await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})
const settings = await chrome.storage.local.get(['model', 'prompt'])
model.value = settings.model || DEFAULT_MODEL; prompt.value = settings.prompt || PROMPT
document.querySelector('#key-status').textContent = getApiKey() ? 'Ключ указан в config.js. Его работоспособность можно проверить загрузкой моделей.' : 'Вставь ключ в config.js вместо PASTE_YOUR_API_KEY_HERE, сохрани файл и обнови расширение в chrome://extensions.'
document.querySelector('#form').onsubmit = async e => {
  e.preventDefault()
  const name = model.value.trim().replace(/^models\//, '')
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) { notice.textContent = 'Проверь имя модели.'; return }
  await chrome.storage.local.set({model: name, prompt: prompt.value.trim()})
  notice.textContent = 'Сохранено. Открой сайт и нажми ⇧⌘S (Mac) или Ctrl+Shift+S.'
}
document.querySelector('#shortcuts').onclick = () => chrome.tabs.create({url: 'chrome://extensions/shortcuts'})
document.querySelector('#models-button').onclick = async e => {
  if (!getApiKey()) { notice.textContent = 'Сначала вставь ключ в config.js и обнови расширение.'; return }
  e.target.disabled = true; notice.textContent = 'Запрашиваю список моделей…'
  try {
    let token, names = []
    do {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
      url.searchParams.set('pageSize', '100'); if (token) url.searchParams.set('pageToken', token)
      const response = await fetch(url, {headers: {'x-goog-api-key': getApiKey()}, signal: AbortSignal.timeout(20000)})
      if (!response.ok) throw new Error(apiError(response.status))
      const data = await response.json()
      names.push(...(data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini') && !/image|tts|robotics|computer-use/.test(m.name)).map(m => m.name.replace(/^models\//, '')))
      token = data.nextPageToken
    } while (token)
    document.querySelector('#models').replaceChildren(...names.map(name => { const option = document.createElement('option'); option.value = name; return option }))
    notice.textContent = names.length ? `Получено моделей: ${names.length}. Выбери модель в поле выше и нажми «Сохранить».` : 'Подходящие модели не найдены. Проверь доступ проекта к Gemini API.'
  } catch (error) { notice.textContent = error.name === 'TimeoutError' ? 'Сервер не ответил. Повтори позже.' : error instanceof TypeError ? 'Не удалось подключиться к Gemini API.' : error.message }
  finally { e.target.disabled = false }
}
