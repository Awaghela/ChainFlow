import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Sparkles, CheckCircle2, XOctagon, ArrowUpCircle, Loader2, Database, History } from 'lucide-react'
import type { AuditEntry, ExceptionRecord } from '../types'
import { ChainFlowAPI } from '../api/client'
import { StatusStamp } from './StatusStamp'
import { relativeTime, titleCase, SEVERITY_COLOR } from '../lib/format'
import { useToast } from '../context/ToastContext'

export function ExceptionDrawer({
  exceptionId, onClose, onUpdated,
}: { exceptionId: string | null; onClose: () => void; onUpdated: (exc: ExceptionRecord) => void }) {
  const [exc, setExc] = useState<ExceptionRecord | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const { push } = useToast()

  useEffect(() => {
    if (!exceptionId) return
    setExc(null)
    ChainFlowAPI.getException(exceptionId).then(setExc)
    ChainFlowAPI.auditLog(exceptionId).then(setAudit)
  }, [exceptionId])

  async function refresh() {
    if (!exceptionId) return
    const [e, a] = await Promise.all([ChainFlowAPI.getException(exceptionId), ChainFlowAPI.auditLog(exceptionId)])
    setExc(e)
    setAudit(a)
    onUpdated(e)
  }

  async function handleSummarize() {
    if (!exceptionId) return
    setLoadingSummary(true)
    try {
      const updated = await ChainFlowAPI.summarize(exceptionId)
      setExc(updated)
      onUpdated(updated)
      push(
        updated.ai_cache_hit ? 'info' : 'success',
        updated.ai_cache_hit ? 'Served from cache' : 'AI triage brief generated',
        updated.ai_cache_hit ? 'Redis returned a cached summary — no LLM call needed.' : 'Summary + suggested action ready for review.'
      )
      await refresh()
    } catch {
      push('error', 'Could not generate summary', 'Check that the backend API is reachable.')
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleReview(action: 'start_review' | 'approve' | 'reject' | 'escalate') {
    if (!exceptionId) return
    setActingOn(action)
    try {
      const updated = await ChainFlowAPI.review(exceptionId, action, 'ops_analyst', note || undefined)
      setExc(updated)
      onUpdated(updated)
      setNote('')
      const copy: Record<string, [string, string]> = {
        start_review: ['info', 'Moved to in review'],
        approve: ['success', 'Exception cleared'],
        reject: ['error', 'Exception rejected'],
        escalate: ['warning', 'Escalated for follow-up'],
      } as const
      const [kind, title] = copy[action]
      push(kind as any, title)
      await refresh()
    } catch {
      push('error', 'Action failed', 'That transition may not be valid from the current state.')
    } finally {
      setActingOn(null)
    }
  }

  const open = !!exceptionId

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-hairline bg-white shadow-2xl"
          >
            {!exc ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="animate-spin text-ink-faint" size={22} />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-hairline-soft px-5 py-4">
                  <div>
                    <p className="font-mono text-sm font-medium text-ink">{exc.exception_id}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{titleCase(exc.exception_type)} · {relativeTime(exc.detected_at)}</p>
                  </div>
                  <button onClick={onClose} className="rounded-md p-1.5 text-ink-faint hover:bg-panel-raised hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  <div className="flex items-center justify-between">
                    <StatusStamp state={exc.review_state} />
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                      style={{ color: SEVERITY_COLOR[exc.severity ?? 'medium'], backgroundColor: 'transparent', border: `1px solid ${SEVERITY_COLOR[exc.severity ?? 'medium']}` }}
                    >
                      {exc.severity ?? 'unknown'} severity
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-ink">{exc.description}</p>

                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    <Field label="PO number" value={exc.po_number} />
                    <Field label="Shipment" value={exc.shipment_id} />
                    <Field label="Related SKU" value={exc.related_sku} />
                    <Field label="Detected" value={exc.detected_at ? new Date(exc.detected_at).toLocaleDateString() : null} />
                  </div>

                  {exc.missing_fields.length > 0 && (
                    <div className="rounded-lg border border-amber/30 bg-amber-soft/40 px-3 py-2.5">
                      <p className="text-xs font-medium text-amber">Missing required fields</p>
                      <p className="mt-1 font-mono text-[11px] text-ink-muted">{exc.missing_fields.join(', ')}</p>
                    </div>
                  )}

                  <div className="rounded-lg border border-hairline bg-panel-raised p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                        <Sparkles size={13} className="text-indigo" /> AI triage brief
                      </p>
                      {exc.ai_cache_hit === 1 && (
                        <span className="flex items-center gap-1 text-[10px] text-teal"><Database size={11} /> cached</span>
                      )}
                    </div>

                    {exc.ai_summary ? (
                      <>
                        <p className="mt-2 text-[13px] leading-relaxed text-ink">{exc.ai_summary}</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-indigo">→ {exc.ai_suggested_action}</p>
                        {exc.ai_confidence != null && (
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between text-[10px] text-ink-faint">
                              <span>Confidence</span><span>{Math.round(exc.ai_confidence * 100)}%</span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-hairline">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${exc.ai_confidence * 100}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="h-full rounded-full bg-indigo"
                              />
                            </div>
                          </div>
                        )}
                        <button
                          onClick={handleSummarize}
                          disabled={loadingSummary}
                          className="mt-3 text-[11px] text-ink-faint hover:text-ink-muted"
                        >
                          Regenerate
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleSummarize}
                        disabled={loadingSummary}
                        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-indigo-soft py-2 text-xs font-medium text-indigo hover:bg-indigo/20 disabled:opacity-60"
                      >
                        {loadingSummary ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {loadingSummary ? 'Generating…' : 'Generate AI triage brief'}
                      </button>
                    )}
                  </div>

                  {audit.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                        <History size={13} /> Audit trail
                      </p>
                      <div className="mt-2 space-y-2 border-l border-hairline-soft pl-3">
                        {audit.map(a => (
                          <div key={a.id} className="text-[11px]">
                            <p className="text-ink-muted">
                              <span className="font-medium text-ink">{a.actor}</span> — {a.action.replace(/_/g, ' ')}
                              {a.new_state ? ` → ${a.new_state}` : ''}
                            </p>
                            <p className="text-ink-faint">{relativeTime(a.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {exc.review_state !== 'approved' && exc.review_state !== 'rejected' && (
                  <div className="border-t border-hairline-soft px-5 py-4 space-y-2.5">
                    <input
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Add a review note (optional)"
                      className="w-full rounded-md border border-hairline bg-base px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-indigo focus:outline-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <ActionButton
                        label="Clear"
                        icon={CheckCircle2}
                        color="var(--color-teal)"
                        busy={actingOn === 'approve'}
                        onClick={() => handleReview('approve')}
                      />
                      <ActionButton
                        label="Escalate"
                        icon={ArrowUpCircle}
                        color="var(--color-amber)"
                        busy={actingOn === 'escalate'}
                        onClick={() => handleReview('escalate')}
                      />
                      <ActionButton
                        label="Reject"
                        icon={XOctagon}
                        color="var(--color-rose)"
                        busy={actingOn === 'reject'}
                        onClick={() => handleReview('reject')}
                      />
                    </div>
                    {exc.review_state === 'pending' && (
                      <button
                        onClick={() => handleReview('start_review')}
                        className="w-full text-center text-[11px] text-ink-faint hover:text-ink-muted"
                      >
                        Mark as in review without deciding yet
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-ink-muted">{value ?? '—'}</p>
    </div>
  )
}

function ActionButton({
  label, icon: Icon, color, onClick, busy,
}: { label: string; icon: any; color: string; onClick: () => void; busy: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-center gap-1 rounded-md border border-hairline py-2 text-[11px] font-medium transition-colors hover:bg-panel-raised disabled:opacity-60"
      style={{ color }}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {label}
    </motion.button>
  )
}
