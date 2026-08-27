export type RecordType = 'purchase_order' | 'shipment_update' | 'inventory_change' | 'supplier_email' | 'delivery_exception'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: string[]
  showIf?: (values: Record<string, any>) => boolean
}

export const TYPE_META: Record<RecordType, { label: string; sub: string; color: string; bg: string }> = {
  purchase_order:     { label: 'Purchase order',    sub: 'Order placed with a supplier',        color: 'var(--color-indigo)', bg: 'var(--color-indigo-soft)' },
  shipment_update:    { label: 'Shipment update',   sub: 'Tracking / carrier status',           color: '#0369a1',             bg: '#e0f2fe' },
  inventory_change:   { label: 'Inventory change',  sub: 'Stock receipt, adjustment, count',    color: '#7c3aed',             bg: '#f1e9fe' },
  supplier_email:     { label: 'Supplier email',    sub: 'Correspondence from a vendor',        color: 'var(--color-teal)',   bg: 'var(--color-teal-soft)' },
  delivery_exception: { label: 'Delivery exception',sub: 'Something that needs review',         color: 'var(--color-rose)',   bg: 'var(--color-rose-soft)' },
}

export const FIELD_SCHEMAS: Record<RecordType, FieldDef[]> = {
  purchase_order: [
    { key: 'po_number', label: 'PO number', type: 'text', required: true },
    { key: 'supplier_id', label: 'Supplier ID', type: 'text', required: true, placeholder: 'SUP-014' },
    { key: 'order_date', label: 'Order date', type: 'date', required: true },
    { key: 'requested_delivery_date', label: 'Requested delivery date', type: 'date', required: true },
    { key: 'cost_center', label: 'Cost center', type: 'text', required: true, placeholder: 'CC-210' },
    { key: 'buyer_email', label: 'Buyer email', type: 'email', required: true },
  ],
  shipment_update: [
    { key: 'shipment_id', label: 'Shipment ID', type: 'text', required: true },
    { key: 'po_number', label: 'PO number', type: 'text' },
    { key: 'carrier', label: 'Carrier', type: 'text', required: true },
    { key: 'tracking_number', label: 'Tracking number', type: 'text', required: true },
    { key: 'ship_date', label: 'Ship date', type: 'date' },
    { key: 'eta', label: 'ETA', type: 'date', required: true },
    { key: 'origin', label: 'Origin', type: 'text' },
    { key: 'destination', label: 'Destination', type: 'text', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['in_transit', 'delayed', 'delivered', 'customs_hold'] },
  ],
  inventory_change: [
    { key: 'sku', label: 'SKU', type: 'text', required: true },
    { key: 'warehouse_id', label: 'Warehouse', type: 'text', required: true, placeholder: 'WH-DEN' },
    { key: 'change_type', label: 'Change type', type: 'select', required: true, options: ['receipt', 'shipment', 'adjustment', 'cycle_count'] },
    { key: 'quantity_delta', label: 'Quantity change', type: 'number', required: true, placeholder: 'e.g. -25 or 120' },
    { key: 'recorded_by', label: 'Recorded by', type: 'text', required: true },
    { key: 'timestamp', label: 'Timestamp', type: 'datetime-local', required: true },
    { key: 'reason_code', label: 'Reason code', type: 'text', placeholder: 'Required for adjustments', showIf: v => v.change_type === 'adjustment' },
  ],
  supplier_email: [
    { key: 'sender', label: 'Sender email', type: 'email', required: true },
    { key: 'subject', label: 'Subject', type: 'text', required: true },
    { key: 'received_at', label: 'Received at', type: 'datetime-local', required: true },
    { key: 'body', label: 'Email body', type: 'textarea', placeholder: 'Paste or write the email content…' },
    { key: 'referenced_po_number', label: 'Referenced PO number', type: 'text' },
    { key: 'promised_date', label: 'Promised date (if mentioned)', type: 'date' },
    { key: 'requested_action', label: 'Requested action', type: 'select', options: ['confirm_receipt', 'await_update', 'acknowledge_partial'] },
  ],
  delivery_exception: [
    { key: 'exception_id', label: 'Exception ID', type: 'text', required: true },
    { key: 'po_number', label: 'PO number', type: 'text' },
    { key: 'shipment_id', label: 'Shipment ID', type: 'text' },
    { key: 'exception_type', label: 'Exception type', type: 'select', required: true, options: ['quantity_mismatch', 'damaged', 'late_arrival', 'wrong_item', 'missing_docs', 'customs_hold'] },
    { key: 'detected_at', label: 'Detected at', type: 'datetime-local', required: true },
    { key: 'severity', label: 'Severity', type: 'select', required: true, options: ['low', 'medium', 'high', 'critical'] },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'related_sku', label: 'Related SKU', type: 'text', showIf: v => ['quantity_mismatch', 'damaged', 'wrong_item'].includes(v.exception_type) },
  ],
}

export function idFor(type: RecordType): string {
  const stamp = Date.now().toString().slice(-6)
  const map: Record<RecordType, string> = {
    purchase_order: `PO-${stamp}`, shipment_update: `SHP-${stamp}`, inventory_change: `INV-${stamp}`,
    supplier_email: `EML-${stamp}`, delivery_exception: `EXC-${stamp}`,
  }
  return map[type]
}
