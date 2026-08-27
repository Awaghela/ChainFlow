import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { Records } from './pages/Records'
import { Exceptions } from './pages/Exceptions'
import { DataQuality } from './pages/DataQuality'
import { Onboarding } from './pages/Onboarding'
import { AppProvider } from './context/AppContext'
import { ChainFlowAPI } from './api/client'

type BootState = { status: 'loading' } | { status: 'onboarding' } | { status: 'ready'; companyName: string } | { status: 'error' }

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' })

  useEffect(() => {
    ChainFlowAPI.getSettings()
      .then(s => {
        if (s.company_name) setBoot({ status: 'ready', companyName: s.company_name })
        else setBoot({ status: 'onboarding' })
      })
      .catch(() => setBoot({ status: 'error' }))
  }, [])

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

  if (boot.status === 'onboarding') {
    return <Onboarding onComplete={companyName => setBoot({ status: 'ready', companyName })} />
  }

  return (
    <AppProvider initialCompanyName={boot.companyName}>
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
