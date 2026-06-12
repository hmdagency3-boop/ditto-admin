import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning'

export type ToastItem = {
  id: string
  type: ToastType
  message: string
}

type Props = {
  toasts: ToastItem[]
  remove: (id: string) => void
}

export function ToastContainer({ toasts, remove }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => <ToastEl key={t.id} toast={t} remove={remove} />)}
    </div>
  )
}

function ToastEl({ toast, remove }: { toast: ToastItem; remove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, remove])

  const icons = {
    success: <CheckCircle size={18} color="#10b981" />,
    error: <XCircle size={18} color="#ef4444" />,
    warning: <AlertCircle size={18} color="#f59e0b" />,
  }
  const colors = {
    success: '#d1fae5',
    error: '#fee2e2',
    warning: '#fef3c7',
  }
  const borders = {
    success: '#6ee7b7',
    error: '#fca5a5',
    warning: '#fde68a',
  }

  return (
    <div style={{
      background: colors[toast.type],
      border: `1px solid ${borders[toast.type]}`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 260,
      maxWidth: 360,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'slideInLeft 0.2s ease',
    }}>
      {icons[toast.type]}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{toast.message}</span>
      <button onClick={() => remove(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b' }}>
        <X size={14} />
      </button>
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
  }

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return { toasts, add, remove, success: (m: string) => add(m, 'success'), error: (m: string) => add(m, 'error'), warning: (m: string) => add(m, 'warning') }
}
