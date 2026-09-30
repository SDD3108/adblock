const homeView = document.querySelector('#home-view'), answersView = document.querySelector('#answers-view')
const help = document.querySelector('#help'), moreMenu = document.querySelector('#more-menu')
function showAnswers(show) {
  homeView.hidden = show
  answersView.hidden = !show
  help.setAttribute('aria-expanded', String(show))
  moreMenu.hidden = true
  document.querySelector('#more').setAttribute('aria-expanded', 'false')
}
help.onclick = () => showAnswers(answersView.hidden)
document.querySelector('#back').onclick = () => { showAnswers(false); help.focus() }
document.querySelector('#more').onclick = e => {
  moreMenu.hidden = !moreMenu.hidden
  e.currentTarget.setAttribute('aria-expanded', String(!moreMenu.hidden))
}
document.querySelector('#menu-settings').onclick = () => chrome.runtime.openOptionsPage()
document.querySelector('#menu-close').onclick = () => window.close()
document.querySelector('#dismiss-banner').onclick = () => { document.querySelector('#vpn-banner').hidden = true }
document.querySelector('#pause').onclick = e => {
  const paused = e.currentTarget.getAttribute('aria-pressed') !== 'true'
  e.currentTarget.setAttribute('aria-pressed', String(paused))
  document.querySelector('#pause-label').textContent = paused ? 'Resume on this site' : 'Pause on this site'
  document.querySelector('#pause-symbol').textContent = paused ? '▶' : 'Ⅱ'
}
const featureDialog = document.querySelector('#feature-dialog')
for (const button of document.querySelectorAll('.learn-more')) button.onclick = () => {
  document.querySelector('#feature-title').textContent = button.dataset.feature
  featureDialog.showModal()
}
document.querySelector('#close-dialog').onclick = () => featureDialog.close()
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !featureDialog.open) {
    e.preventDefault()
    showAnswers(false)
    help.focus()
  }
})
showAnswers(false)
void chrome.tabs.query({active: true, currentWindow: true}).then(([tab]) => {
  try { document.querySelector('#site-name').textContent = new URL(tab.url).hostname || 'Current website' } catch {}
}).catch(() => {})
const answer = document.querySelector('#answer'), status = document.querySelector('#status')
const copy = document.querySelector('#copy'), capture = document.querySelector('#capture'), clear = document.querySelector('#clear')
let current
function render(result) {
  current = result
  const stale = result?.status === 'loading' && Date.now() - result.updated > 150000
  const loading = result?.status === 'loading' && !stale
  status.textContent = loading ? 'Обработка… Можно закрыть это окно.' : stale ? 'Запрос прерван' : result?.status === 'error' ? 'Не удалось получить ответ' : result?.status === 'done' ? 'Ответ готов' : 'Готово к работе'
  answer.textContent = stale ? 'Запрос прерван. Выдели область заново.' : result?.text || 'Нажми сочетание клавиш, выдели вопрос и открой это окно.'
  answer.className = result?.status === 'error' || stale ? 'error' : ''
  copy.disabled = result?.status !== 'done'; capture.disabled = loading; clear.disabled = loading
}
document.querySelector('#settings').onclick = () => chrome.runtime.openOptionsPage()
capture.onclick = () => { chrome.runtime.sendMessage({type: 'start'}).catch(() => {}); window.close() }
copy.onclick = async () => { try { await navigator.clipboard.writeText(current.text); copy.textContent = 'Скопировано'; setTimeout(() => copy.textContent = 'Копировать', 1500) } catch { status.textContent = 'Выдели и скопируй текст вручную.' } }
clear.onclick = async () => { await chrome.storage.session.remove('result'); render() }
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.result) render(changes.result.newValue) })
const {result} = await chrome.storage.session.get('result'); render(result)
const commands = await chrome.commands.getAll()
const shortcut = commands.find(c => c.name === 'select-area')?.shortcut
document.querySelector('#shortcut').textContent = shortcut ? `${shortcut} · выделить область` : 'Назначь сочетание в chrome://extensions/shortcuts'
setInterval(() => { if (current?.status === 'loading') render(current) }, 5000)
