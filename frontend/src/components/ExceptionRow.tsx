import { motion } from 'framer-motion'
import { AlertOctagon } from 'lucide-react'
import type { ExceptionRecord } from '../types'
import { relativeTime, SEVERITY_COLOR, titleCase } from '../lib/format'
import { StatusStamp } from './StatusStamp'

export function ExceptionRow({
  exc, onClick, index,
}: { exc: ExceptionRecord; onClick: () => void; index: number }) {
  const severityColor = SEVERITY_COLOR[exc.severity ?? 'medium']

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ x: 3 }}
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-hairline bg-panel py-3 px-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all hover:border-slate-300 hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] sm:px-5"
    >
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: severityColor }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[12.5px] font-semibold text-ink">{exc.exception_id}</span>
          <span className="text-xs text-ink-faint">·</span>
          <span className="text-xs text-ink-muted">{titleCase(exc.exception_type)}</span>
          {exc.missing_fields.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber">
              <AlertOctagon size={10} /> {exc.missing_fields.length} missing
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[12.5px] text-ink-muted">{exc.description || 'No description provided.'}</p>
        <p className="mt-1 font-mono text-[10.5px] text-ink-faint">
          {exc.po_number ?? '—'} {exc.shipment_id ? `· ${exc.shipment_id}` : ''} · {relativeTime(exc.detected_at)}
        </p>
      </div>

      <StatusStamp state={exc.review_state} size="sm" />
    </motion.button>
  )
}
