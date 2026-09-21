import axios from 'axios'
import type { ExceptionRecord, AuditEntry, SeedStatus, MetricsReport } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

export const api = axios.create({ baseURL: API_BASE })

// The active workspace id is attached to every request as a header rather
// than threaded through every single API call -- set it once (on boot, and
// whenever the user switches/creates a workspace) and every call below
// picks it up automatically. There's no login/password in this app; this
// header is the entire mechanism for "which workspace's data am I looking
// at right now."
let activeWorkspaceId: string | null = null
export function setActiveWorkspaceId(id: string | null) {
  activeWorkspaceId = id
}
api.interceptors.request.use(config => {
  if (activeWorkspaceId) {
    config.headers = config.headers || {}
    config.headers['X-Workspace-Id'] = activeWorkspaceId
  }
  return config
})

export interface WorkspaceOut { id: string; company_name: string; created_at: string }

export const ChainFlowAPI = {
  // --- Workspaces (no auth -- see setActiveWorkspaceId above) ---
  createWorkspace: (companyName: string) =>
    api.post<WorkspaceOut>('/workspaces', { company_name: companyName }).then(r => r.data),
  listWorkspaces: () => api.get<WorkspaceOut[]>('/workspaces').then(r => r.data),
  getWorkspace: (id: string) => api.get<WorkspaceOut>(`/workspaces/${id}`).then(r => r.data),
  renameWorkspace: (id: string, companyName: string) =>
    api.put<WorkspaceOut>(`/workspaces/${id}`, { company_name: companyName }).then(r => r.data),

  // --- Exceptions / review workflow ---
  listExceptions: (state?: string) =>
    api.get<ExceptionRecord[]>('/exceptions', { params: state ? { state } : {} }).then(r => r.data),

  getException: (exceptionId: string) =>
    api.get<ExceptionRecord>(`/exceptions/${exceptionId}`).then(r => r.data),

  createException: (payload: Record<string, any>) =>
    api.post(`/exceptions`, payload).then(r => r.data),

  summarize: (exceptionId: string) =>
    api.post<ExceptionRecord>(`/exceptions/${exceptionId}/summarize`).then(r => r.data),

  review: (exceptionId: string, action: string, actor: string, note?: string) =>
    api.post<ExceptionRecord>(`/exceptions/${exceptionId}/review`, { action, actor, note }).then(r => r.data),

  auditLog: (exceptionId: string) =>
    api.get<AuditEntry[]>(`/exceptions/${exceptionId}/audit`).then(r => r.data),

  // --- Other record types ---
  createPurchaseOrder: (payload: Record<string, any>) => api.post('/purchase-orders', payload).then(r => r.data),
  listPurchaseOrders: () => api.get<any[]>('/purchase-orders').then(r => r.data),

  createShipment: (payload: Record<string, any>) => api.post('/shipments', payload).then(r => r.data),
  listShipments: () => api.get<any[]>('/shipments').then(r => r.data),

  createInventoryChange: (payload: Record<string, any>) => api.post('/inventory-changes', payload).then(r => r.data),
  listInventoryChanges: () => api.get<any[]>('/inventory-changes').then(r => r.data),

  createSupplierEmail: (payload: Record<string, any>) => api.post('/supplier-emails', payload).then(r => r.data),
  listSupplierEmails: () => api.get<any[]>('/supplier-emails').then(r => r.data),

  // --- Seed / workspace data ---
  seedStatus: () => api.get<SeedStatus>('/seed/status').then(r => r.data),
  loadSeed: () => api.post<{ loaded: Record<string, number>; total: number }>('/seed/load').then(r => r.data),
  wipeAll: () => api.delete('/records/all').then(r => r.data),

  // --- Metrics / benchmark ---
  metrics: () => api.get<MetricsReport>('/metrics').then(r => r.data),
  recomputeMetrics: () => api.post<MetricsReport>('/metrics/recompute').then(r => r.data),
}
