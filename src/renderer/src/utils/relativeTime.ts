import type { Translate } from '../i18n'

export function relativeTime(ts: number, t: Translate): string {
  const diff = Math.max(0, Date.now() - ts)
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('time.justNow')
  if (min < 60) return t('time.minAgo', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t(hr === 1 ? 'time.hrAgo' : 'time.hrsAgo', { n: hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t(day === 1 ? 'time.dayAgo' : 'time.daysAgo', { n: day })
  const mo = Math.floor(day / 30)
  return t('time.moAgo', { n: mo })
}
