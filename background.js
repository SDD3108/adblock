import {getApiKey} from './config.js'

let creating
let starting = false
const ready = chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}).then(() => chrome.storage.local.remove('apiKey'))
const ownPage = sender => !sender.tab && sender.url?.startsWith(chrome.runtime.getURL(''))
async function state(value) { await chrome.storage.session.set({result: {...value, updated: Date.now()}}) }
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})
  if(contexts.length){
    return
  }
  if (!creating) creating = chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Crop screenshot blobs and process the selected image while the popup is closed.'}).finally(() => { creating = null })
  await creating
}
async function start(tab){
  await ready
  if(starting){
    return
  }
  starting = true
  try {
    const {result} = await chrome.storage.session.get('result')
    if (result?.status === 'loading' && Date.now() - result.updated < 150000) return
    const apiKey = getApiKey()
    if (!apiKey) { await state({status: 'error', text: 'Вставь Gemini API key в config.js, сохрани файл и обнови расширение в chrome://extensions.'}); return }
    if (!tab?.id) [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true})
    if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Открой обычную страницу http/https. Служебные страницы Chrome недоступны.')
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['selection.js']})
  } catch { await state({status: 'error', text: 'Не удалось начать выделение. Открой обычный сайт; Chrome Web Store и служебные страницы недоступны.'}) }
  finally { starting = false }
}
async function capture(message, sender) {
  await ready
  if (!sender.tab || sender.frameId !== 0) throw new Error('Недопустимый источник запроса.')
  const {result} = await chrome.storage.session.get('result')
  if (result?.status === 'loading' && Date.now() - result.updated < 150000) throw new Error('Дождись предыдущего ответа.')
  const apiKey = getApiKey()
  const {model, prompt} = await chrome.storage.local.get(['model', 'prompt'])
  if (!apiKey) throw new Error('Вставь ключ в config.js и обнови расширение.')
  const active = await chrome.tabs.query({active: true, windowId: sender.tab.windowId})
  if (active[0]?.id !== sender.tab.id) throw new Error('Вкладка изменилась. Выдели область заново.')
  const id = crypto.randomUUID()
  await state({id, status: 'loading', text: 'Распознаю вопросы и готовлю ответ…'})
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {format: 'png'})
    const after = await chrome.tabs.query({active: true, windowId: sender.tab.windowId})
    if (after[0]?.id !== sender.tab.id) throw new Error('Вкладка изменилась. Повтори выделение.')
    await ensureOffscreen()
    const response = await chrome.runtime.sendMessage({target: 'offscreen', type: 'process', id, screenshot, rect: message.rect, viewport: message.viewport, apiKey, model, prompt})
    if (!response?.ok) throw new Error('Обработчик занят. Повтори попытку.')
    return {ok: true}
  } catch (e) { await state({id, status: 'error', text: e.message}); throw e }
}
chrome.commands.onCommand.addListener((command, tab) => { if (command === 'select-area') void start(tab) })
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target === 'offscreen') return
  let task
  if (message.type === 'capture') task = capture(message, sender)
  else if (message.type === 'start' && ownPage(sender)) task = start().then(() => ({ok: true}))
  else if (message.type === 'result' && sender.url === chrome.runtime.getURL('offscreen.html')) task = (async () => {
    const {result} = await chrome.storage.session.get('result')
    if (result?.id === message.id) await state({id: message.id, status: message.status, text: message.text})
    return {ok: true}
  })()
  else return
  task.then(reply, error => reply({ok: false, error: error.message}))
  return true
})
