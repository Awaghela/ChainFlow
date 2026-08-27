import { useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { ChainFlowAPI } from '../api/client'
import { TYPE_META, type RecordType } from '../lib/recordSchemas'
import { DataTable, type ColumnDef } from '../components/DataTable'
import { AddRecordModal } from '../components/AddRecordModal'

const TABS: RecordType[] = ['purchase_order', 'shipment_update', 'inventory_change', 'supplier_email']

const COLUMNS: Record<RecordType, ColumnDef[]> = {
  purchase_order: [
    { key: 'po_number', label: 'PO number', mono: true }, { key: 'supplier_id', label: 'Supplier' },
    { key: 'requested_delivery_date', label: 'Requested delivery' }, { key: 'cost_center', label: 'Cost center' },
  ],
  shipment_update: [
    { key: 'shipment_id', label: 'Shipment', mono: true }, { key: 'po_number', label: 'PO number', mono: true },
    { key: 'carrier', label: 'Carrier' }, { key: 'status', label: 'Status' }, { key: 'eta', label: 'ETA' },
  ],
  inventory_change: [
    { key: 'sku', label: 'SKU', mono: true }, { key: 'warehouse_id', label: 'Warehouse' },
    { key: 'change_type', label: 'Type' }, { key: 'quantity_delta', label: 'Qty Δ' },
  ],
  supplier_email: [
    { key: 'sender', label: 'Sender' }, { key: 'subject', label: 'Subject', wrap: true },
    { key: 'referenced_po_number', label: 'Ref. PO', mono: true }, { key: 'promised_date', label: 'Promised date' },
  ],
  delivery_exception: [],
}

const LOADERS: Record<RecordType, () => Promise<any[]>> = {
  purchase_order: ChainFlowAPI.listPurchaseOrders,
  shipment_update: ChainFlowAPI.listShipments,
  inventory_change: ChainFlowAPI.listInventoryChanges,
  supplier_email: ChainFlowAPI.listSupplierEmails,
  delivery_exception: async () => [],
}

export function Records() {
  const [tab, setTab] = useState<RecordType>('purchase_order')
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  async function loadCounts() {
    const results = await Promise.all(TABS.map(t => LOADERS[t]()))
    const c: Record<string, number> = {}
    TABS.forEach((t, i) => { c[t] = results[i].length })
    setCounts(c)
    return results
  }

  async function loadTab(t: RecordType) {
    setLoading(true)
    const data = await LOADERS[t]()
    setRows(data)
    setLoading(false)
  }

  useEffect(() => { loadCounts().then(results => { setRows(results[0]); setLoading(false) }) }, [])
  useEffect(() => { loadTab(tab) }, [tab])

  async function refreshAll() { await loadCounts(); await loadTab(tab) }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Records</h1>
          <p className="mt-1 text-sm text-ink-muted">Every record ingested into your workspace, browsable by type.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-dk">
          <Plus size={15} /> Add record
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t ? 'bg-indigo text-white' : 'bg-panel-raised text-ink-muted hover:bg-panel-raised-2 hover:text-ink'
            }`}
          >
            {TYPE_META[t].label} <span className="opacity-75">({counts[t] ?? '—'})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-ink-faint" size={22} /></div>
      ) : (
        <DataTable rows={rows} columns={COLUMNS[tab]} emptyMessage={`No ${TYPE_META[tab].label.toLowerCase()} records yet. Click "Add record" to create one.`} />
      )}

      <AddRecordModal open={modalOpen} initialType={tab} onClose={() => setModalOpen(false)} onCreated={refreshAll} />
    </div>
  )
}
