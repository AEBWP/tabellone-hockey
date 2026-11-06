import type { Rules } from '../engine'
import { t } from '../i18n/ui.svelte'

/**
 * Descrizione breve di un regolamento nella lingua della console,
 * es. "3 × 20′, supplementare 5′, rigori".
 */
export function describeRules(r: Rules): string {
  const len = (ms: number) => {
    const s = Math.round(ms / 1000)
    return s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`
  }
  const parts = [`${r.periods} × ${len(r.periodMs)}`]
  if (r.overtime.enabled) {
    const length = len(r.overtime.periodMs)
    parts.push(
      r.overtime.maxPeriods === 0
        ? t('supplementare {length} a oltranza', { length })
        : t('supplementare {length}', { length }),
    )
  }
  if (r.shootout.enabled) parts.push(t('rigori'))
  if (!r.overtime.enabled && !r.shootout.enabled) parts.push(t('pareggio possibile'))
  return parts.join(', ')
}
