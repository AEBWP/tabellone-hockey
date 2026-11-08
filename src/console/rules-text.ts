import type { Rules } from '../engine'
import { t } from '../i18n/ui.svelte'
import { isBuiltinPreset, type SavedPreset } from '../shared/library'

/** Nome di un regolamento: quelli già pronti seguono la lingua della console. */
export function presetLabel(p: SavedPreset): string {
  return isBuiltinPreset(p) ? t(p.name) : p.name
}

/**
 * Descrizione breve di un regolamento nella lingua della console,
 * es. "3 × 20′, supplementare 5′, rigori".
 */
export function describeRules(r: Rules): string {
  const len = (ms: number) => {
    const s = Math.round(ms / 1000)
    return s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`
  }
  if (r.clockOnly) {
    const clock = t('solo cronometro {length}', { length: len(r.periodMs) })
    if (r.shiftHornMs <= 0) return clock
    return `${clock}, ${t('cambio ogni {length}', { length: len(r.shiftHornMs) })}`
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
  if (r.shiftHornMs > 0) parts.push(t('cambio ogni {length}', { length: len(r.shiftHornMs) }))
  return parts.join(', ')
}
