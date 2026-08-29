/**
 * Local Timezone-Safe Date Utility
 * Ensures that early morning / midnight sessions are correctly attributed
 * to the user's local calendar day rather than UTC.
 */

export function getLocalDateKey(input?: Date | string | number | null): string {
  if (!input) return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getStartOfLocalDay(input?: Date | string | number): Date {
  const d = input ? new Date(input) : new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEndOfLocalDay(input?: Date | string | number): Date {
  const d = input ? new Date(input) : new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export function formatLocalDateDisplay(
  input?: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = input ? new Date(input) : new Date()
  return d.toLocaleDateString('en-US', options || { month: 'short', day: 'numeric' })
}
