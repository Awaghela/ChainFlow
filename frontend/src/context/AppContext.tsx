import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { RecordType } from '../lib/recordSchemas'

interface AppContextValue {
  companyName: string
  setCompanyName: (name: string) => void
  addModalOpen: boolean
  addModalType?: RecordType
  openAddRecord: (type?: RecordType) => void
  closeAddRecord: () => void
  refreshToken: number
  bumpRefresh: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children, initialCompanyName }: { children: ReactNode; initialCompanyName: string }) {
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalType, setAddModalType] = useState<RecordType | undefined>(undefined)
  const [refreshToken, setRefreshToken] = useState(0)

  const openAddRecord = useCallback((type?: RecordType) => { setAddModalType(type); setAddModalOpen(true) }, [])
  const closeAddRecord = useCallback(() => setAddModalOpen(false), [])
  const bumpRefresh = useCallback(() => setRefreshToken(t => t + 1), [])

  return (
    <AppContext.Provider value={{ companyName, setCompanyName, addModalOpen, addModalType, openAddRecord, closeAddRecord, refreshToken, bumpRefresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
