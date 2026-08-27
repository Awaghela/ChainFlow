import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Search, Plus } from 'lucide-react'
import { ChainFlowAPI } from '../api/client'
import type { ExceptionRecord, ReviewState } from '../types'
import { ExceptionRow } from '../components/ExceptionRow'
import { ExceptionDrawer } from '../components/ExceptionDrawer'
import { STATE_LABEL } from '../lib/format'
import { useApp } from '../context/AppContext'

const FILTERS: { key: ReviewState | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: STATE_LABEL.pending },
  { key: 'in_review', label: STATE_LABEL.in_review },
  { key: 'escalated', label: STATE_LABEL.escalated },
  { key: 'approved', label: STATE_LABEL.approved },
  { key: 'rejected', label: STATE_LABEL.rejected },
]

export function Exceptions() {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ReviewState | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { openAddRecord, refreshToken } = useApp()

  useEffect(() => {
    setLoading(true)
    ChainFlowAPI.listExceptions().then(e => { setExceptions(e); setLoading(false) })
  }, [refreshToken])

  const filtered = useMemo(() => {
    return exceptions
      .filter(e => filter === 'all' || e.review_state === filter)
      .filter(e =>
        !query ||
        e.exception_id.toLowerCase().includes(query.toLowerCase()) ||
        (e.po_number ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (e.description ?? '').toLowerCase().includes(query.toLowerCase())
      )
  }, [exceptions, filter, query])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Exceptions</h1>
          <p className="mt-1 text-sm text-ink-muted">{exceptions.length} delivery exception{exceptions.length === 1 ? '' : 's'} in your workspace.</p>
        </div>
        <button onClick={() => openAddRecord('delivery_exception')} className="flex items-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-dk">
          <Plus size={15} /> Log exception
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key ? 'text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {filter === f.key && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-full bg-indigo"
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by ID, PO, description…"
            className="w-full rounded-lg border border-hairline bg-panel py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-indigo focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-ink-faint" size={22} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline py-16 text-center text-sm text-ink-faint">
          {exceptions.length === 0 ? 'No exceptions logged yet.' : 'No exceptions match this filter.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e, i) => (
            <ExceptionRow key={e.id} exc={e} index={i} onClick={() => setOpenId(e.exception_id)} />
          ))}
        </div>
      )}

      <ExceptionDrawer
        exceptionId={openId}
        onClose={() => setOpenId(null)}
        onUpdated={updated => setExceptions(prev => prev.map(e => (e.exception_id === updated.exception_id ? updated : e)))}
      />
    </div>
  )
}
