import { useEffect, useRef } from 'react';
import { useConfirmStore } from '../store/confirmStore';
import type { ConfirmVariant } from '../store/confirmStore';

const variantCfg: Record<ConfirmVariant, { icon: string; iconClass: string; btnClass: string }> = {
  danger:  { icon: '⚠', iconClass: 'text-red-500',    btnClass: 'bg-red-600 hover:bg-red-700 text-white' },
  warning: { icon: '⚠', iconClass: 'text-yellow-500', btnClass: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  info:    { icon: 'ℹ', iconClass: 'text-blue-500',   btnClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
};

export default function ConfirmModal() {
  const { open, title, options, inputValue, accept, cancel, setInputValue } = useConfirmStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (options.inputConfig) {
      inputRef.current?.focus();
    } else {
      acceptBtnRef.current?.focus();
    }
  }, [open, options.inputConfig]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
      if (e.key === 'Enter' && !options.inputConfig) accept();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, accept, cancel, options.inputConfig]);

  if (!open) return null;

  const variant = options.variant ?? 'info';
  const cfg = variantCfg[variant];

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slideIn" aria-live="assertive">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className={`text-2xl flex-shrink-0 mt-0.5 ${cfg.iconClass}`}>{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 id="confirm-title" className="text-base font-semibold text-gray-900 leading-snug">{title}</h3>
              {options.message && (
                <p className="mt-1.5 text-sm text-gray-500 whitespace-pre-line leading-relaxed">
                  {options.message}
                </p>
              )}
              {options.inputConfig && (
                <div className="mt-3">
                  {options.inputConfig.label && (
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {options.inputConfig.label}
                    </label>
                  )}
                  <input
                    ref={inputRef}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') accept(); }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={cancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            ref={acceptBtnRef}
            onClick={accept}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${cfg.btnClass}`}
          >
            {options.confirmLabel ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
