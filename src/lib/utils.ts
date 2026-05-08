/** Convert ml to oz (1 oz = 29.5735 ml) */
export function mlToOz(ml: number): number {
  return Math.round((ml / 29.5735) * 10) / 10
}

/** Convert oz to ml */
export function ozToMl(oz: number): number {
  return Math.round(oz * 29.5735)
}

/** Format amount with correct unit label */
export function formatAmount(ml: number, unit: 'ml' | 'oz'): string {
  if (unit === 'oz') return `${mlToOz(ml)} oz`
  return `${ml} ml`
}

/** Parse user input (in their preferred unit) to ml */
export function parseToMl(value: number, unit: 'ml' | 'oz'): number {
  if (unit === 'oz') return ozToMl(value)
  return Math.round(value)
}

/** Format duration in minutes to h m string */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Get duration in minutes between two dates */
export function getDurationMinutes(start: string, end: string | null): number {
  if (!end) return 0
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

/** Format a date for display */
export function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr))
}

/** Check if a date is today */
export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

/** Get baby age string */
export function getBabyAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const days = Math.floor((now.getTime() - birth.getTime()) / 86400000)
  if (days < 7) return `${days}d old`
  if (days < 30) return `${Math.floor(days / 7)}w old`
  const months = Math.floor(days / 30.44)
  if (months < 24) return `${months}mo old`
  return `${Math.floor(months / 12)}y old`
}
