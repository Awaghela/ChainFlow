import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Layers, ShieldAlert, CheckCircle2, PackageSearch, Loader2, ArrowRight, Plus } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import { ChainFlowAPI } from '../api/client'
import type { ExceptionRecord } from '../types'
import { TYPE_META, type RecordType } from '../lib/recordSchemas'
import { KpiCard } from '../components/KpiCard'
import { ExceptionRow } from '../components/ExceptionRow'
import { ExceptionDrawer } from '../components/ExceptionDrawer'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

const TABS: RecordType[] = ['purchase_order', 'shipment_update', 'inventory_change', 'supplier_email']
const LOADERS: Record<RecordType, () => Promise<any[]>> = {
  purchase_order: ChainFlowAPI.listPurchaseOrders,
  shipment_update: ChainFlowAPI.listShipments,
  inventory_change: ChainFlowAPI.listInventoryChanges,
  supplier_email: ChainFlowAPI.listSupplierEmails,
  delivery_exception: async () => [],
}
const SEV_COLORS: Record<string, string> = { critical: '#be123c', high: '#f43f5e', medium: '#f0b429', low: '#10b981' }

export function Overview() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const { openAddRecord, refreshToken, companyName } = useApp()
  const { push } = useToast()

  async function load() {
    setLoading(true)
    try {
      const [otherResults, exc] = await Promise.all([
        Promise.all(TABS.map(t => LOADERS[t]())),
        ChainFlowAPI.listExceptions(),
      ])
      const c: Record<string, number> = {}
      TABS.forEach((t, i) => { c[t] = otherResults[i].length })
      c.delivery_exception = exc.length
      setCounts(c)
      setExceptions(exc)
    } catch {
      push('error', 'Cannot reach the ChainFlow API', 'Is the backend running on the configured VITE_API_BASE?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshToken])

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0)
  const pending = exceptions.filter(e => e.review_state === 'pending' || e.review_state === 'in_review').length
  const cleared = exceptions.filter(e => e.review_state === 'approved').length
  const recent = [...exceptions].sort((a, b) => new Date(b.detected_at || 0).getTime() - new Date(a.detected_at || 0).getTime()).slice(0, 5)

  const sevCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  exceptions.forEach(e => { if (e.severity && sevCounts[e.severity] != null) sevCounts[e.severity]++ })
  const donutData = Object.entries(sevCounts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))

  const typeRows = (Object.keys(TYPE_META) as RecordType[]).map(t => ({ name: TYPE_META[t].label, value: counts[t] || 0, color: TYPE_META[t].color }))
  const maxTypeCount = Math.max(1, ...typeRows.map(r => r.value))

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-ink-faint" size={24} /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Overview</h1>
          <p className="mt-1 text-sm text-ink-muted">{companyName} · live status across your supply chain records.</p>
        </div>
        <button onClick={() => openAddRecord()} className="flex items-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-dk">
          <Plus size={15} /> Add record
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total records" value={totalRecords} accent="var(--color-indigo)" icon={<Layers size={16} />} delay={0} sub="across 5 record types" />
        <KpiCard label="Open exceptions" value={pending} accent="var(--color-amber)" icon={<ShieldAlert size={16} />} delay={0.05} sub="pending or in review" />
        <KpiCard label="Cleared" value={cleared} accent="var(--color-teal)" icon={<CheckCircle2 size={16} />} delay={0.1} sub="approved exceptions" />
        <KpiCard label="Missing fields" value={exceptions.filter(e => e.missing_fields.length > 0).length} accent="var(--color-rose)" icon={<PackageSearch size={16} />} delay={0.15} sub="exceptions need attention" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <p className="text-sm font-semibold text-ink">Records by type</p>
          <p className="mb-3.5 text-xs text-ink-faint">What's currently in your workspace</p>
          <div className="space-y-2.5">
            {typeRows.map(r => (
              <div key={r.name} className="grid grid-cols-[110px_1fr_36px] items-center gap-2.5 text-xs">
                <span className="truncate text-ink-muted">{r.name}</span>
                <div className="h-4.5 overflow-hidden rounded bg-panel-raised">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(r.value / maxTypeCount) * 100}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className="h-full rounded" style={{ backgroundColor: r.color }} />
                </div>
                <span className="text-right font-mono text-ink-muted">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <p className="text-sm font-semibold text-ink">Exceptions by severity</p>
          <p className="mb-1 text-xs text-ink-faint">{exceptions.length} total exception{exceptions.length === 1 ? '' : 's'}</p>
          {exceptions.length ? (
            <div className="flex items-center gap-4">
              <div className="h-[130px] w-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                      {donutData.map((d, i) => <Cell key={i} fill={SEV_COLORS[d.name]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEV_COLORS[d.name] }} />
                    <span className="min-w-16 capitalize text-ink-muted">{d.name}</span>
                    <span className="font-mono font-semibold text-ink">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-faint">No exceptions logged yet.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Recent exceptions</h2>
          <Link to="/exceptions" className="flex items-center gap-1 text-xs font-semibold text-indigo hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.length ? recent.map((e, i) => (
            <ExceptionRow key={e.id} exc={e} index={i} onClick={() => setOpenId(e.exception_id)} />
          )) : (
            <div className="rounded-xl border border-dashed border-hairline py-10 text-center text-sm text-ink-faint">
              No exceptions yet — add one to see it here.
            </div>
          )}
        </div>
      </div>

      <ExceptionDrawer
        exceptionId={openId}
        onClose={() => setOpenId(null)}
        onUpdated={updated => setExceptions(prev => prev.map(e => (e.exception_id === updated.exception_id ? updated : e)))}
      />
    </div>
  )
}
