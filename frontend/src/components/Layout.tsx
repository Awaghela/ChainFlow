import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, ListTree, LineChart, Layers3, Plus, Settings, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AddRecordModal } from './AddRecordModal'
import { SettingsModal } from './SettingsModal'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/records', label: 'Records', icon: ListTree, end: false },
  { to: '/exceptions', label: 'Exceptions', icon: AlertTriangle, end: false },
  { to: '/quality', label: 'Data quality', icon: LineChart, end: false },
]

export function Layout() {
  const { companyName, addModalOpen, addModalType, openAddRecord, closeAddRecord, bumpRefresh } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen w-full pb-16 md:pb-0 md:pl-62">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-62 flex-col border-r border-hairline bg-white/85 backdrop-blur md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo to-violet-500 text-white shadow-sm">
            <Layers3 size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-none text-ink">ChainFlow</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-faint">{companyName || 'Set up your workspace'}</p>
          </div>
        </div>

        <button
          onClick={() => openAddRecord()}
          className="mx-4 mt-1 flex items-center justify-center gap-2 rounded-lg bg-indigo py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-dk"
        >
          <Plus size={15} /> Add record
        </button>

        <nav className="mt-4 flex flex-col gap-0.5 px-3">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isActive ? 'bg-indigo-soft text-indigo-dk' : 'text-ink-muted hover:bg-panel-raised hover:text-ink'
                }`
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-hairline-soft">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-2.5 px-5 py-3.5 text-xs text-ink-muted hover:bg-panel-raised hover:text-ink"
          >
            <Settings size={15} /> Workspace settings
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-white/98 shadow-[0_-2px_12px_rgba(16,24,40,0.06)] backdrop-blur md:hidden">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${isActive ? 'text-indigo' : 'text-ink-faint'}`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={() => openAddRecord()}
        className="fixed bottom-[74px] right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-indigo text-white shadow-lg md:hidden"
      >
        <Plus size={22} />
      </button>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-8">
        <Outlet />
      </main>

      <AddRecordModal
        open={addModalOpen}
        initialType={addModalType}
        onClose={closeAddRecord}
        onCreated={() => bumpRefresh()}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
