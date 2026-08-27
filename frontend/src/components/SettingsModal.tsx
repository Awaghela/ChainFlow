import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { X, Sparkles, Trash2 } from 'lucide-react'
import { ChainFlowAPI } from '../api/client'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { companyName, setCompanyName, bumpRefresh } = useApp()
  const [name, setName] = useState(companyName)
  const [busy, setBusy] = useState<string | null>(null)
  const { push } = useToast()

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy('save')
    try {
      await ChainFlowAPI.updateSettings(trimmed)
      setCompanyName(trimmed)
      push('success', 'Workspace updated')
      onClose()
    } catch {
      push('error', 'Could not save settings')
    } finally { setBusy(null) }
  }

  async function handleLoadSample() {
    setBusy('sample')
    try {
      await ChainFlowAPI.loadSeed()
      push('success', 'Sample data loaded', '150 example records added to your workspace.')
      bumpRefresh()
      onClose()
    } catch {
      push('error', 'Could not load sample data')
    } finally { setBusy(null) }
  }

  async function handleClear() {
    if (!confirm("This clears all records in this workspace. This can't be undone. Continue?")) return
    setBusy('clear')
    try {
      await ChainFlowAPI.wipeAll()
      push('warning', 'Workspace cleared', 'All records were removed.')
      bumpRefresh()
      onClose()
    } catch {
      push('error', 'Could not clear workspace')
    } finally { setBusy(null) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[55] bg-slate-900/45 backdrop-blur-[2px]" />
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-hairline-soft px-6 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Workspace settings</h3>
                <p className="mt-1 text-xs text-ink-muted">Manage your company name and data.</p>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-ink-faint hover:bg-panel-raised hover:text-ink"><X size={18} /></button>
            </div>
            <div className="px-6 py-4">
              <label className="mb-1.5 block text-xs font-semibold text-ink">Company name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] text-ink focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/40" />
              <div className="my-4 border-t border-hairline-soft" />
              <p className="mb-2 text-xs font-semibold text-ink">Data</p>
              <button onClick={handleLoadSample} disabled={!!busy}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2.5 text-xs font-semibold text-ink hover:bg-panel-raised disabled:opacity-60">
                <Sparkles size={14} /> {busy === 'sample' ? 'Loading…' : 'Load sample dataset (150 records)'}
              </button>
              <button onClick={handleClear} disabled={!!busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose/30 bg-rose-soft py-2.5 text-xs font-semibold text-rose hover:bg-rose/10 disabled:opacity-60">
                <Trash2 size={14} /> {busy === 'clear' ? 'Clearing…' : 'Clear all workspace data'}
              </button>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-hairline-soft px-6 py-4">
              <button onClick={onClose} className="rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-panel-raised">Cancel</button>
              <button onClick={handleSave} disabled={!!busy} className="rounded-lg bg-indigo px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-dk disabled:opacity-70">
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
