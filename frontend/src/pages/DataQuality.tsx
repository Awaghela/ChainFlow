import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Loader2, CheckCircle2, AlertTriangle, Layers, ListChecks } from 'lucide-react'
import { ChainFlowAPI } from '../api/client'
import type { MetricsReport } from '../types'
import { TYPE_META, type RecordType } from '../lib/recordSchemas'
import { KpiCard } from '../components/KpiCard'
import { useApp } from '../context/AppContext'

const TYPES: RecordType[] = ['purchase_order', 'shipment_update', 'inventory_change', 'supplier_email', 'delivery_exception']
const LOADERS: Record<RecordType, () => Promise<any[]>> = {
  purchase_order: ChainFlowAPI.listPurchaseOrders,
  shipment_update: ChainFlowAPI.listShipments,
  inventory_change: ChainFlowAPI.listInventoryChanges,
  supplier_email: ChainFlowAPI.listSupplierEmails,
  delivery_exception: () => ChainFlowAPI.listExceptions(),
}

export function DataQuality() {
  const [byType, setByType] = useState<Record<string, { total: number; withMissing: number }>>({})
  const [loading, setLoading] = useState(true)
  const [benchmark, setBenchmark] = useState<MetricsReport | null>(null)
  const { refreshToken } = useApp()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      Promise.all(TYPES.map(t => LOADERS[t]())),
      ChainFlowAPI.metrics().catch(() => null),
    ]).then(([results, report]) => {
      const map: Record<string, { total: number; withMissing: number }> = {}
      TYPES.forEach((t, i) => {
        const rows = results[i]
        map[t] = { total: rows.length, withMissing: rows.filter((r: any) => (r.missing_fields || []).length > 0).length }
      })
      setByType(map)
      setBenchmark(report)
      setLoading(false)
    })
  }, [refreshToken])

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-ink-faint" size={22} /></div>
  }

  const totalRecords = Object.values(byType).reduce((a, v) => a + v.total, 0)
  const totalWithMissing = Object.values(byType).reduce((a, v) => a + v.withMissing, 0)
  const completeness = totalRecords ? Math.round((1 - totalWithMissing / totalRecords) * 100) : 100

  const fd = benchmark?.missing_field_detection
  const tt = benchmark?.exception_triage_time

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Data quality</h1>
        <p className="mt-1 max-w-lg text-sm text-ink-muted">Live validation of your workspace data, plus how the underlying rules were benchmarked.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Overall completeness" value={`${completeness}%`} accent="var(--color-teal)" icon={<CheckCircle2 size={16} />} delay={0} sub="records with no missing fields" />
        <KpiCard label="Records flagged" value={totalWithMissing} accent="var(--color-amber)" icon={<AlertTriangle size={16} />} delay={0.05} sub={`out of ${totalRecords} total`} />
        <KpiCard label="Record types" value={5} accent="var(--color-indigo)" icon={<Layers size={16} />} delay={0.1} sub="monitored by the validator" />
        <KpiCard label="Validation ruleset" value="v2" accent="#7c3aed" icon={<ListChecks size={16} />} delay={0.15} sub="nested + conditional + text extraction" />
      </div>

      <div className="rounded-xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <p className="text-sm font-semibold text-ink">Missing-field flags by record type</p>
        <p className="mb-3.5 text-xs text-ink-faint">Records with at least one missing required field, live from your workspace</p>
        <div className="space-y-2.5">
          {TYPES.map(t => {
            const v = byType[t] || { total: 0, withMissing: 0 }
            const pct = v.total ? (v.withMissing / v.total) * 100 : 0
            return (
              <div key={t} className="grid grid-cols-[130px_1fr_60px] items-center gap-2.5 text-xs">
                <span className="truncate text-ink-muted">{TYPE_META[t].label}</span>
                <div className="h-4.5 overflow-hidden rounded bg-panel-raised">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className="h-full rounded" style={{ backgroundColor: TYPE_META[t].color }} />
                </div>
                <span className="text-right font-mono text-ink-muted">{v.withMissing}/{v.total}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FlaskConical size={15} className="text-indigo" /> How the validator was benchmarked
        </p>
        {fd && tt ? (
          <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-ink-muted">
            <p>
              Before rolling this ruleset out on real data, it was tested against a {fd.n_records}-record simulated
              dataset where the missing fields were known in advance (a deliberately corrupted "answer key"). A
              first-pass ruleset caught <span className="font-semibold text-ink">{fd.detection_rate_v1_pct}%</span> of
              the true gaps; after adding nested checks, conditional requirements, and text extraction for supplier
              emails, that rose to <span className="font-semibold text-ink">{fd.detection_rate_v2_pct}%</span>.
            </p>
            <p>
              A companion simulation modeled exception triage time across {tt.n_scenarios} scenarios — manual review
              ({tt.mean_manual_minutes} min average) vs. AI-assisted review with a generated summary
              ({tt.mean_ai_assisted_minutes} min average) — a{' '}
              <span className="font-semibold text-ink">{tt.mean_reduction_pct}%</span> reduction.
            </p>
            <p className="text-ink-faint">
              These are historical benchmark results, kept for reference — the completeness numbers above are
              computed live from your own workspace data, not from the benchmark set.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-ink-faint">Benchmark report unavailable — the backend's /api/metrics endpoint didn't respond.</p>
        )}
      </div>
    </div>
  )
}
