import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Plus, Boxes, Truck, Layers, Mail, AlertTriangle, type LucideIcon } from 'lucide-react'
import { FIELD_SCHEMAS, TYPE_META, idFor, type RecordType, type FieldDef } from '../lib/recordSchemas'
import { ChainFlowAPI } from '../api/client'
import { useToast } from '../context/ToastContext'

const TYPE_ICONS: Record<RecordType, LucideIcon> = {
  purchase_order: Boxes, shipment_update: Truck, inventory_change: Layers,
  supplier_email: Mail, delivery_exception: AlertTriangle,
}

interface LineItem { sku: string; qty: string; unit_price: string }

export function AddRecordModal({
  open, initialType, onClose, onCreated,
}: { open: boolean; initialType?: RecordType; onClose: () => void; onCreated: (type: RecordType) => void }) {
  const [type, setType] = useState<RecordType | null>(initialType ?? null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineItems, setLineItems] = useState<LineItem[]>([{ sku: '', qty: '', unit_price: '' }])
  const [submitting, setSubmitting] = useState(false)
  const { push } = useToast()

  function reset() {
    setType(initialType ?? null)
    setValues({})
    setErrors({})
    setLineItems([{ sku: '', qty: '', unit_price: '' }])
  }
  function handleClose() { reset(); onClose() }

  function pickType(t: RecordType) { setType(t); setValues({}); setErrors({}) }

  function setField(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  async function handleSubmit() {
    if (!type) return
    const schema = FIELD_SCHEMAS[type].filter(f => !f.showIf || f.showIf(values))
    const newErrors: Record<string, string> = {}
    schema.forEach(f => { if (f.required && !(values[f.key] || '').trim()) newErrors[f.key] = 'This field is required.' })
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

    const rec: Record<string, any> = { record_type: type, id: idFor(type) }
    schema.forEach(f => { rec[f.key] = values[f.key] || null })
    if (type === 'purchase_order') {
      if (!rec.po_number) rec.po_number = rec.id
      rec.line_items = lineItems.filter(li => li.sku || li.qty || li.unit_price)
        .map(li => ({ sku: li.sku || null, qty: li.qty ? +li.qty : null, unit_price: li.unit_price ? +li.unit_price : null }))
      if (!rec.line_items.length) rec.line_items = [{ sku: null, qty: null, unit_price: null }]
    }
    if (type === 'shipment_update' && !rec.shipment_id) rec.shipment_id = rec.id
    if (type === 'delivery_exception' && !rec.exception_id) rec.exception_id = rec.id
    if (type === 'inventory_change' && rec.quantity_delta != null) rec.quantity_delta = +rec.quantity_delta

    setSubmitting(true)
    try {
      const creators: Record<RecordType, (p: any) => Promise<any>> = {
        purchase_order: ChainFlowAPI.createPurchaseOrder,
        shipment_update: ChainFlowAPI.createShipment,
        inventory_change: ChainFlowAPI.createInventoryChange,
        supplier_email: ChainFlowAPI.createSupplierEmail,
        delivery_exception: ChainFlowAPI.createException,
      }
      await creators[type](rec)
      push('success', `${TYPE_META[type].label} added`, `${rec.id} is now in your workspace.`)
      onCreated(type)
      handleClose()
    } catch {
      push('error', 'Could not save record', 'Check that the backend API is reachable.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose} className="fixed inset-0 z-[55] bg-slate-900/45 backdrop-blur-[2px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[min(560px,calc(100vw-32px))] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl bg-white shadow-2xl"
          >
            {!type ? (
              <>
                <div className="flex items-start justify-between border-b border-hairline-soft px-6 py-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">What are you adding?</h3>
                    <p className="mt-1 text-xs text-ink-muted">Choose a record type to get started.</p>
                  </div>
                  <button onClick={handleClose} className="rounded-md p-1.5 text-ink-faint hover:bg-panel-raised hover:text-ink"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-6 sm:grid-cols-2">
                  {(Object.keys(TYPE_META) as RecordType[]).map(t => {
                    const Icon = TYPE_ICONS[t]
                    return (
                      <button key={t} onClick={() => pickType(t)}
                        className="flex items-center gap-3 rounded-xl border border-hairline bg-white p-3.5 text-left hover:border-indigo hover:bg-indigo-soft">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: TYPE_META[t].bg, color: TYPE_META[t].color }}>
                          <Icon size={18} />
                        </span>
                        <span>
                          <p className="text-[13px] font-medium text-ink">{TYPE_META[t].label}</p>
                          <p className="text-[11px] text-ink-faint">{TYPE_META[t].sub}</p>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-hairline-soft px-6 py-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">Add {TYPE_META[type].label.toLowerCase()}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{TYPE_META[type].sub}</p>
                  </div>
                  <button onClick={handleClose} className="rounded-md p-1.5 text-ink-faint hover:bg-panel-raised hover:text-ink"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {FIELD_SCHEMAS[type].filter(f => !f.showIf || f.showIf(values)).map(f => (
                    <FieldRow key={f.key} field={f} value={values[f.key] || ''} error={errors[f.key]} onChange={v => setField(f.key, v)} />
                  ))}
                  {type === 'purchase_order' && (
                    <LineItemsEditor items={lineItems} onChange={setLineItems} />
                  )}
                </div>
                <div className="flex justify-end gap-2.5 border-t border-hairline-soft px-6 py-4">
                  <button onClick={handleClose} className="rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-panel-raised">Cancel</button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-dk disabled:opacity-70">
                    <Plus size={14} /> {submitting ? 'Adding…' : 'Add record'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function FieldRow({ field, value, error, onChange }: { field: FieldDef; value: string; error?: string; onChange: (v: string) => void }) {
  const base = 'w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-indigo/40 focus:border-indigo'
  const borderClass = error ? 'border-rose bg-rose-soft' : 'border-hairline'
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-xs font-semibold text-ink">
        {field.label}{field.required && <span className="ml-0.5 text-rose">*</span>}
      </label>
      {field.type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={`${base} ${borderClass}`}>
          <option value="">Select…</option>
          {field.options?.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className={`${base} ${borderClass} resize-y`} />
      ) : (
        <input type={field.type} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={`${base} ${borderClass}`} />
      )}
      {error && <p className="mt-1 text-[11px] text-rose">{error}</p>}
    </div>
  )
}

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function update(i: number, key: keyof LineItem, val: string) {
    const next = [...items]; next[i] = { ...next[i], [key]: val }; onChange(next)
  }
  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [{ sku: '', qty: '', unit_price: '' }])
  }
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-xs font-semibold text-ink">Line items</label>
      <div className="mb-1 grid grid-cols-[1fr_70px_90px_28px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        <span>SKU</span><span>Qty</span><span>Unit price</span><span />
      </div>
      {items.map((it, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_70px_90px_28px] gap-2">
          <input value={it.sku} onChange={e => update(i, 'sku', e.target.value)} placeholder="SKU-AB-1234" className="rounded-md border border-hairline px-2.5 py-2 text-xs" />
          <input value={it.qty} onChange={e => update(i, 'qty', e.target.value)} type="number" placeholder="100" className="rounded-md border border-hairline px-2.5 py-2 text-xs" />
          <input value={it.unit_price} onChange={e => update(i, 'unit_price', e.target.value)} type="number" step="0.01" placeholder="12.50" className="rounded-md border border-hairline px-2.5 py-2 text-xs" />
          <button onClick={() => remove(i)} className="flex items-center justify-center rounded-md bg-rose-soft text-rose"><X size={13} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { sku: '', qty: '', unit_price: '' }])} className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo">
        <Plus size={13} /> Add line item
      </button>
    </div>
  )
}
