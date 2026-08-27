import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function KpiCard({
  label, value, unit, accent = 'var(--color-indigo)', icon, sub, delay = 0,
}: {
  label: string
  value: string | number
  unit?: string
  accent?: string
  icon?: ReactNode
  sub?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-xl border border-hairline bg-panel p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] sm:p-5"
    >
      <div
        className="absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-[0.16] blur-xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl sm:text-[27px] font-semibold tabular-nums text-ink">{value}</span>
        {unit && <span className="text-sm text-ink-muted">{unit}</span>}
      </div>
      {sub && <p className="mt-1 text-[11.5px] text-ink-faint">{sub}</p>}
    </motion.div>
  )
}
