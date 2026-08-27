import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

type ToastKind = 'success' | 'warning' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; title: string; detail?: string }

interface ToastContextValue {
  push: (kind: ToastKind, title: string, detail?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-teal" />,
  warning: <AlertTriangle size={18} className="text-amber" />,
  error: <XCircle size={18} className="text-rose" />,
  info: <Info size={18} className="text-indigo" />,
}

const BORDER: Record<ToastKind, string> = {
  success: 'border-l-teal',
  warning: 'border-l-amber',
  error: 'border-l-rose',
  info: 'border-l-indigo',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, kind, title, detail }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2.5rem))]">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-hairline border-l-2 ${BORDER[t.kind]} bg-panel-raised/95 backdrop-blur px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)]`}
            >
              <div className="mt-0.5 shrink-0">{ICON[t.kind]}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink leading-snug">{t.title}</p>
                {t.detail && <p className="text-xs text-ink-muted mt-0.5 leading-snug">{t.detail}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
