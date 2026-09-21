import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ArrowRight, Sparkles, Loader2, Plus, ChevronRight, Trash2 } from 'lucide-react'
import { ChainFlowAPI, setActiveWorkspaceId, type WorkspaceOut } from '../api/client'

export function Onboarding({ onEnter }: { onEnter: (workspaceId: string, companyName: string) => void }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceOut[] | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<'blank' | 'sample' | string | null>(null)

  useEffect(() => {
    ChainFlowAPI.listWorkspaces()
      .then(ws => { setWorkspaces(ws); setShowCreateForm(ws.length === 0) })
      .catch(() => { setWorkspaces([]); setShowCreateForm(true) })
  }, [])

  async function resume(ws: WorkspaceOut) {
    setBusy(ws.id)
    setActiveWorkspaceId(ws.id)
    onEnter(ws.id, ws.company_name)
  }

  async function remove(ws: WorkspaceOut, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Permanently delete "${ws.company_name}" and everything in it? This can't be undone.`)) return
    setBusy(`delete:${ws.id}`)
    try {
      await ChainFlowAPI.deleteWorkspace(ws.id)
      setWorkspaces(prev => {
        const next = (prev ?? []).filter(w => w.id !== ws.id)
        // Deleted the last one -- jump straight to the create form instead
        // of leaving the user on an empty "Welcome back" screen with
        // nothing to resume and an extra click needed to get anywhere.
        if (next.length === 0) setShowCreateForm(true)
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  async function createNew(withSample: boolean) {
    const trimmed = name.trim()
    if (!trimmed) { setError(true); return }
    setBusy(withSample ? 'sample' : 'blank')
    try {
      const ws = await ChainFlowAPI.createWorkspace(trimmed)
      setActiveWorkspaceId(ws.id)
      if (withSample) await ChainFlowAPI.loadSeed()
      onEnter(ws.id, ws.company_name)
    } finally {
      setBusy(null)
    }
  }

  const loading = workspaces === null

  return (
    <div className="flex min-h-screen items-start justify-center bg-base px-4 pt-[8vh] pb-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl border border-hairline bg-white p-8 shadow-[0_12px_32px_rgba(16,24,40,0.14)]"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-soft text-indigo">
          <Building2 size={26} />
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-ink">
          {loading ? 'Loading workspaces…' : workspaces!.length > 0 ? 'Welcome back' : 'Set up your workspace'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {workspaces && workspaces.length > 0
            ? 'Pick a workspace to resume, or start a new one.'
            : 'Give your company a name to get started. You can rename it anytime from Workspace settings.'}
        </p>

        {loading && (
          <div className="mt-8 flex justify-center"><Loader2 size={20} className="animate-spin text-ink-faint" /></div>
        )}

        {!loading && workspaces!.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            {workspaces!.map(ws => (
              <div
                key={ws.id}
                onClick={() => !busy && resume(ws)}
                role="button"
                tabIndex={0}
                className={`group flex items-center justify-between gap-3 rounded-lg border border-hairline bg-white px-4 py-3 text-left hover:border-indigo hover:bg-indigo-soft ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{ws.company_name}</p>
                  <p className="text-[11px] text-ink-faint">Created {new Date(ws.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={e => remove(ws, e)}
                    disabled={!!busy}
                    title="Delete this workspace"
                    className="pointer-events-auto rounded-md p-1.5 text-ink-faint opacity-0 hover:bg-rose-soft hover:text-rose group-hover:opacity-100 disabled:opacity-100"
                  >
                    {busy === `delete:${ws.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                  {busy === ws.id ? <Loader2 size={16} className="animate-spin text-ink-faint" /> : <ChevronRight size={16} className="text-ink-faint" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-2.5 text-sm font-semibold text-ink-muted hover:border-indigo hover:text-indigo"
          >
            <Plus size={15} /> Create a new workspace
          </button>
        )}

        <AnimatePresence>
          {!loading && showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={workspaces && workspaces.length > 0 ? 'mt-5 border-t border-hairline-soft pt-5' : 'mt-6'}>
                <label className="mb-1.5 block text-xs font-semibold text-ink">
                  Company name <span className="text-rose">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setError(false) }}
                  placeholder="e.g. Meridian Outdoor Supply"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo/40 ${error ? 'border-rose bg-rose-soft' : 'border-hairline'}`}
                />

                <div className="mt-4 flex flex-col gap-2.5">
                  <button
                    onClick={() => createNew(false)}
                    disabled={!!busy}
                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo py-2.5 text-sm font-semibold text-white hover:bg-indigo-dk disabled:opacity-70"
                  >
                    {busy === 'blank' ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    Start with a blank workspace
                  </button>
                  <button
                    onClick={() => createNew(true)}
                    disabled={!!busy}
                    className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2.5 text-sm font-semibold text-ink hover:bg-panel-raised disabled:opacity-70"
                  >
                    {busy === 'sample' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Or explore with sample data first
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
