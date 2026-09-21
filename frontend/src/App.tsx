import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { Records } from './pages/Records'
import { Exceptions } from './pages/Exceptions'
import { DataQuality } from './pages/DataQuality'
import { Onboarding } from './pages/Onboarding'
import { AppProvider, ACTIVE_WORKSPACE_KEY } from './context/AppContext'
import { ChainFlowAPI, setActiveWorkspaceId } from './api/client'

type BootState =
  | { status: 'loading' }
  | { status: 'loggedOut' }
  | { status: 'ready'; workspaceId: string; companyName: string }
  | { status: 'error' }

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' })

  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    if (!savedId) {
      setBoot({ status: 'loggedOut' })
      return
    }
    setActiveWorkspaceId(savedId)
    ChainFlowAPI.getWorkspace(savedId)
      .then(ws => setBoot({ status: 'ready', workspaceId: ws.id, companyName: ws.company_name }))
      .catch(err => {
        if (err?.response?.status === 404) {
          // Saved workspace no longer exists (e.g. a fresh database) --
          // forget it locally and fall back to the chooser, not a hard error.
          localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
          setActiveWorkspaceId(null)
          setBoot({ status: 'loggedOut' })
        } else {
          setBoot({ status: 'error' })
        }
      })
  }, [])

  function enterWorkspace(workspaceId: string, companyName: string) {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId)
    setActiveWorkspaceId(workspaceId)
    setBoot({ status: 'ready', workspaceId, companyName })
  }

  if (boot.status === 'loading') {
    return <div className="flex h-screen items-center justify-center bg-base"><Loader2 className="animate-spin text-ink-faint" size={24} /></div>
  }

  if (boot.status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-base px-6 text-center">
        <p className="font-display text-lg font-semibold text-ink">Can't reach the ChainFlow API</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Make sure the backend is running (see README) and that VITE_API_BASE points to it.
        </p>
      </div>
    )
  }

  if (boot.status === 'loggedOut') {
    return <Onboarding onEnter={enterWorkspace} />
  }

  return (
    <AppProvider
      workspaceId={boot.workspaceId}
      initialCompanyName={boot.companyName}
      onLogout={() => setBoot({ status: 'loggedOut' })}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/records" element={<Records />} />
            <Route path="/exceptions" element={<Exceptions />} />
            <Route path="/quality" element={<DataQuality />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
