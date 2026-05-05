import { useApp } from '../../contexts/AppContext'

export function ToastContainer() {
  const { state, dismissToast } = useApp()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {state.toasts.map(t => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl
            text-sm font-medium animate-fade-in border backdrop-blur-sm
            ${
              t.variant === 'error'
                ? 'bg-[#1a0a0a] border-danger/30 text-danger'
                : t.variant === 'success'
                  ? 'bg-[#0a1a12] border-online/30 text-online'
                  : 'bg-bg-tertiary border-border text-text-primary'
            }
          `}
        >
          <span className="text-base">
            {t.variant === 'error' ? '⚠' : t.variant === 'success' ? '✓' : 'ℹ'}
          </span>
          <span>{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="ml-2 text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
