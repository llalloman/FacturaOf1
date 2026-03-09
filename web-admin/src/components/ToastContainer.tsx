import { useToastStore, type ToastItem, type ToastType } from '../store/toastStore';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const STYLES: Record<ToastType, { bar: string; icon: string; bg: string; border: string; title: string }> = {
  success: {
    bar: 'bg-green-500',
    icon: 'text-green-500',
    bg: 'bg-white',
    border: 'border-green-200',
    title: 'text-green-800',
  },
  error: {
    bar: 'bg-red-500',
    icon: 'text-red-500',
    bg: 'bg-white',
    border: 'border-red-200',
    title: 'text-red-800',
  },
  warning: {
    bar: 'bg-yellow-500',
    icon: 'text-yellow-500',
    bg: 'bg-white',
    border: 'border-yellow-200',
    title: 'text-yellow-800',
  },
  info: {
    bar: 'bg-blue-500',
    icon: 'text-blue-500',
    bg: 'bg-white',
    border: 'border-blue-200',
    title: 'text-blue-800',
  },
};

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const s = STYLES[item.type];
  const Icon = ICONS[item.type];

  return (
    <div
      className={`relative flex items-start gap-3 w-80 ${s.bg} border ${s.border} rounded-xl shadow-lg p-4 overflow-hidden animate-slideIn`}
    >
      {/* color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-xl`} />
      <Icon size={20} className={`${s.icon} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm leading-tight ${s.title}`}>{item.title}</p>
        {item.message && (
          <p className="text-gray-500 text-xs mt-1 leading-snug whitespace-pre-line">{item.message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(item.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Cerrar"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem item={t} />
        </div>
      ))}
    </div>
  );
}
