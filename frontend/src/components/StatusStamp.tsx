import { motion } from 'framer-motion'
import type { ReviewState } from '../types'

const CONFIG: Record<ReviewState, { label: string; color: string; bg: string; rotate: number }> = {
  pending:    { label: 'PENDING',   color: 'var(--color-ink-muted)', bg: '#ffffff',                  rotate: -4 },
  in_review:  { label: 'IN REVIEW', color: 'var(--color-indigo)',    bg: 'var(--color-indigo-soft)',  rotate: -3 },
  approved:   { label: 'CLEARED',   color: 'var(--color-teal)',      bg: 'var(--color-teal-soft)',    rotate: -6 },
  rejected:   { label: 'REJECTED',  color: 'var(--color-rose)',      bg: 'var(--color-rose-soft)',    rotate: -4 },
  escalated:  { label: 'ESCALATE',  color: 'var(--color-amber)',     bg: 'var(--color-amber-soft)',   rotate: -5 },
}

/**
 * The manifest "stamp" — this project's signature element. Renders like an
 * ink stamp on a shipping ticket, with a double-ring border to read as a
 * rubber stamp impression on paper, animating in with a slight overshoot
 * when a review decision lands.
 */
export function StatusStamp({ state, size = 'md' }: { state: ReviewState; size?: 'sm' | 'md' }) {
  const cfg = CONFIG[state]
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
  return (
    <motion.span
      key={state}
      initial={{ opacity: 0, scale: 1.6, rotate: cfg.rotate }}
      animate={{ opacity: 1, scale: 1, rotate: cfg.rotate }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={`ink-stamp inline-flex items-center justify-center rounded-md font-mono font-bold tracking-[0.1em] ${pad}`}
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
      }}
    >
      {cfg.label}
    </motion.span>
  )
}
