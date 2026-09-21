import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { RecordType } from '../lib/recordSchemas'
import { setActiveWorkspaceId } from '../api/client'

export const ACTIVE_WORKSPACE_KEY = 'chainflow:active_workspace_id'

interface AppContextValue {
  workspaceId: string
  companyName: string
  setCompanyName: (name: string) => void
  addModalOpen: boolean
  addModalType?: RecordType
  openAddRecord: (type?: RecordType) => void
  closeAddRecord: () => void
  refreshToken: number
  bumpRefresh: () => void
  logout: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({
  children, workspaceId, initialCompanyName, onLogout,
}: { children: ReactNode; workspaceId: string; initialCompanyName: string; onLogout: () => void }) {
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalType, setAddModalType] = useState<RecordType | undefined>(undefined)
  const [refreshToken, setRefreshToken] = useState(0)

  const openAddRecord = useCallback((type?: RecordType) => { setAddModalType(type); setAddModalOpen(true) }, [])
  const closeAddRecord = useCallback(() => setAddModalOpen(false), [])
  const bumpRefresh = useCallback(() => setRefreshToken(t => t + 1), [])

  const logout = useCallback(() => {
    // Only forgets which workspace THIS browser was pointed at -- nothing
    // server-side is touched, so the workspace and all its data are exactly
    // as they were the next time someone picks it from the resume list.
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    setActiveWorkspaceId(null)
    onLogout()
  }, [onLogout])

  return (
    <AppContext.Provider value={{
      workspaceId, companyName, setCompanyName, addModalOpen, addModalType,
      openAddRecord, closeAddRecord, refreshToken, bumpRefresh, logout,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
