import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'range'
export interface PeriodValue {
  mode: PeriodMode
  from: Date | null
  to: Date | null
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function startOfDay(d: Date) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
function endOfDay(d: Date) {
  const c = new Date(d)
  c.setHours(23, 59, 59, 999)
  return c
}
function startOfWeek(d: Date) {
  const c = startOfDay(d)
  const day = (c.getDay() + 6) % 7 // lunes = 0
  c.setDate(c.getDate() - day)
  return c
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function periodLabel(v: PeriodValue): string {
  if (!v.from) return 'Todo el historial'
  const f = fmtISO(v.from)
  if (v.mode === 'day') return f
  if (!v.to) return f
  if (v.mode === 'week') return `${f} — ${fmtISO(v.to)}`
  if (v.mode === 'month') return `${MONTHS[v.from.getMonth()]} ${v.from.getFullYear()}`
  if (v.mode === 'year') return String(v.from.getFullYear())
  if (sameDay(v.from, v.to)) return f
  return `${f} — ${fmtISO(v.to)}`
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const anchor = value.from ?? new Date()
  const [view, setView] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() })
  const [rangeStart, setRangeStart] = useState<Date | null>(value.from)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(value.to)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    const a = value.from ?? new Date()
    setView({ year: a.getFullYear(), month: a.getMonth() })
    setRangeStart(value.from)
    setRangeEnd(value.to)
  }, [value.from, value.to, open])

  const days = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const offset = (first.getDay() + 6) % 7
    const cells: (Date | null)[] = Array.from({ length: offset }, () => null)
    const total = new Date(view.year, view.month + 1, 0).getDate()
    for (let d = 1; d <= total; d += 1) cells.push(new Date(view.year, view.month, d))
    return cells
  }, [view])

  const inRange = (d: Date) => {
    if (!rangeStart) return false
    const end = rangeEnd ?? rangeStart
    return d >= startOfDay(rangeStart) && d <= endOfDay(end)
  }

  const setMode = (mode: PeriodMode) => {
    const today = new Date()
    if (mode === 'day') onChange({ mode, from: value.from ?? startOfDay(today), to: value.from ? endOfDay(value.from) : endOfDay(today) })
    else if (mode === 'week') {
      const base = value.from ?? today
      const ws = startOfWeek(base)
      const we = endOfDay(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6))
      onChange({ mode, from: ws, to: we })
    } else if (mode === 'month') {
      const base = value.from ?? today
      onChange({ mode, from: new Date(base.getFullYear(), base.getMonth(), 1), to: endOfDay(new Date(base.getFullYear(), base.getMonth() + 1, 0)) })
    } else if (mode === 'year') {
      const base = value.from ?? today
      onChange({ mode, from: new Date(base.getFullYear(), 0, 1), to: endOfDay(new Date(base.getFullYear(), 11, 31)) })
    } else {
      onChange({ mode, from: rangeStart, to: rangeEnd })
    }
    if (mode !== 'range') setOpen(false)
  }

  const pickDay = (d: Date) => {
    if (value.mode === 'range') {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(startOfDay(d))
        setRangeEnd(null)
      } else {
        const s = rangeStart
        const e = endOfDay(d)
        const [from, to] = d < s ? [startOfDay(d), endOfDay(s)] : [s, e]
        setRangeStart(from)
        setRangeEnd(to)
        onChange({ mode: 'range', from, to })
        setOpen(false)
      }
      return
    }
    if (value.mode === 'day') onChange({ mode: 'day', from: startOfDay(d), to: endOfDay(d) })
    else if (value.mode === 'week') {
      const ws = startOfWeek(d)
      onChange({ mode: 'week', from: ws, to: endOfDay(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6)) })
    }
    setOpen(false)
  }

  const years = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, i) => y - 6 + i)
  }, [])

  const tabBtn = (mode: PeriodMode, label: string) => (
    <button
      key={mode}
      type="button"
      onClick={() => setMode(mode)}
      className={cn(
        'flex-1 px-2 py-1.5 text-[0.6rem] font-semibold uppercase tracking-widest transition-colors',
        value.mode === mode ? 'bg-gold text-night' : 'text-bone hover:text-gold',
      )}
    >
      {label}
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border border-gold/25 bg-night px-3 py-2.5 text-left text-xs text-ivory transition-colors hover:border-gold/50 focus:border-gold focus:outline-none"
      >
        <CalendarDays size={14} className="shrink-0 text-gold" />
        <span className="truncate">{periodLabel(value)}</span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-[19rem] border border-gold/25 bg-carbon p-3 shadow-2xl shadow-black/70 animate-scale-in">
          <div className="mb-2 flex border border-gold/15 bg-night">
            {tabBtn('day', 'Día')}
            {tabBtn('week', 'Semana')}
            {tabBtn('month', 'Mes')}
            {tabBtn('year', 'Año')}
            {tabBtn('range', 'Rango')}
          </div>

          {value.mode === 'year' ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { onChange({ mode: 'year', from: new Date(y, 0, 1), to: endOfDay(new Date(y, 11, 31)) }); setOpen(false) }}
                  className={cn(
                    'border px-2 py-2 text-xs transition-colors',
                    value.from?.getFullYear() === y ? 'border-gold bg-gold/15 text-gold' : 'border-gold/15 text-ivory hover:border-gold/40',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : value.mode === 'month' ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange({ mode: 'month', from: new Date(view.year, i, 1), to: endOfDay(new Date(view.year, i + 1, 0)) }); setOpen(false) }}
                  className={cn(
                    'border px-2 py-2 text-[0.7rem] transition-colors',
                    value.from?.getFullYear() === view.year && value.from?.getMonth() === i
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-gold/15 text-ivory hover:border-gold/40',
                  )}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between">
                <button type="button" aria-label="Mes anterior" onClick={() => setView((v) => ({ ...v, ...(v.month === 0 ? { year: v.year - 1, month: 11 } : { month: v.month - 1 }) }))}
                  className="p-1 text-bone hover:text-gold"><ChevronLeft size={16} /></button>
                <span className="text-xs font-medium text-ivory">{MONTHS[view.month]} {view.year}</span>
                <button type="button" aria-label="Mes siguiente" onClick={() => setView((v) => ({ ...v, ...(v.month === 11 ? { year: v.year + 1, month: 0 } : { month: v.month + 1 }) }))}
                  className="p-1 text-bone hover:text-gold"><ChevronRight size={16} /></button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((w, i) => <span key={i} className="text-[0.6rem] text-bone">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((d, i) =>
                  d ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickDay(d)}
                      className={cn(
                        'aspect-square text-[0.7rem] transition-colors',
                        value.from && sameDay(d, value.from) ? 'bg-gold font-bold text-night'
                          : value.to && sameDay(d, value.to) ? 'border border-gold text-gold'
                            : inRange(d) ? 'bg-gold/15 text-gold'
                              : 'text-ivory hover:bg-gold/10',
                      )}
                    >
                      {d.getDate()}
                    </button>
                  ) : (
                    <span key={i} />
                  ),
                )}
              </div>
              {value.mode === 'range' && (
                <p className="mt-2 text-[0.62rem] text-bone">
                  {rangeStart && !rangeEnd ? 'Elige la fecha final' : 'Elige fecha inicial y final'}
                </p>
              )}
            </>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-gold/15 pt-2">
            <button
              type="button"
              onClick={() => { onChange({ ...value, from: null, to: null }); setOpen(false) }}
              className="flex items-center gap-1 text-[0.62rem] uppercase tracking-widest text-bone hover:text-gold"
            >
              <X size={12} /> Todo
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[0.62rem] font-semibold uppercase tracking-widest text-gold hover:text-gold-soft"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
