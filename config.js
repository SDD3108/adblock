// КЛЮЧ МЕНЯТЬ ТУТ ЕСЛИ ЧО
export const API_KEY = 'AQ.Ab8RN6JDxFnaysOH17aoH_8B8Hs3UeK8L0-7upjSob-1K3Ybow'

export function getApiKey() {
  const key = API_KEY.trim()
  return key === 'PASTE_YOUR_API_KEY_HERE' ? '' : key
}
