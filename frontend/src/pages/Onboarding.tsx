import { useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, ArrowRight, Sparkles, Loader2 } from 'lucide-react'
import { ChainFlowAPI } from '../api/client'

export function Onboarding({ onComplete }: { onComplete: (companyName: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<'blank' | 'sample' | null>(null)

  async function start(withSample: boolean) {
    const trimmed = name.trim()
    if (!trimmed) { setError(true); return }
    setBusy(withSample ? 'sample' : 'blank')
    try {
      await ChainFlowAPI.updateSettings(trimmed)
      if (withSample) await ChainFlowAPI.loadSeed()
      onComplete(trimmed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-base px-4 pt-[10vh]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl border border-hairline bg-white p-8 shadow-[0_12px_32px_rgba(16,24,40,0.14)]"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-soft text-indigo">
          <Building2 size={26} />
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-ink">Set up your workspace</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Give your company a name to get started. You can rename it anytime from Workspace settings.
        </p>

        <div className="mt-6">
          <label className="mb-1.5 block text-xs font-semibold text-ink">
            Company name <span className="text-rose">*</span>
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(false) }}
            placeholder="e.g. Meridian Outdoor Supply"
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo/40 ${error ? 'border-rose bg-rose-soft' : 'border-hairline'}`}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={() => start(false)}
            disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo py-2.5 text-sm font-semibold text-white hover:bg-indigo-dk disabled:opacity-70"
          >
            {busy === 'blank' ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Start with a blank workspace
          </button>
          <button
            onClick={() => start(true)}
            disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2.5 text-sm font-semibold text-ink hover:bg-panel-raised disabled:opacity-70"
          >
            {busy === 'sample' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Or explore with sample data first
          </button>
        </div>
      </motion.div>
    </div>
  )
}
