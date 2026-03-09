import { useToastStore } from '../store/toastStore';
import type { ToastItem } from '../store/toastStore';

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const colors: Record<string, { bar: string; icon: string; bg: string }> = {
  success: { bar: 'bg-green-500',  icon: 'text-green-500',  bg: 'bg-white' },
  error:   { bar: 'bg-red-500',    icon: 'text-red-500',    bg: 'bg-white' },
  warning: { bar: 'bg-yellow-400', icon: 'text-yellow-500', bg: 'bg-white' },
  info:    { bar: 'bg-blue-500',   icon: 'text-blue-500',   bg: 'bg-white' },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const c = colors[toast.type];

  return (
    <div
      className="animate-slideIn flex items-start w-80 rounded-lg shadow-lg overflow-hidden"
      style={{ background: '#fff' }}
    >
      <div className={`w-1.5 self-stretch flex-shrink-0 ${c.bar}`} />
      <div className="flex items-start gap-3 p-3 flex-1 min-w-0">
        <span className={`mt-0.5 text-base font-bold flex-shrink-0 ${c.icon}`}>
          {icons[toast.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-sm leading-none mt-0.5"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  );
}
