export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export const SEVERITY_COLOR: Record<string, string> = {
  low: 'var(--color-teal)',
  medium: 'var(--color-amber)',
  high: 'var(--color-rose)',
  critical: 'var(--color-rose)',
}

export const STATE_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In review',
  approved: 'Cleared',
  rejected: 'Rejected',
  escalated: 'Escalated',
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
