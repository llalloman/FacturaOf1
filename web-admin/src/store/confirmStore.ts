import { create } from 'zustand';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  message?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  inputConfig?: { label: string; defaultValue?: string };
}

interface ConfirmResult {
  confirmed: boolean;
  inputValue: string;
}

interface ConfirmStore {
  open: boolean;
  title: string;
  options: ConfirmOptions;
  inputValue: string;
  _resolve: ((r: ConfirmResult) => void) | null;
  show: (title: string, options?: ConfirmOptions) => Promise<ConfirmResult>;
  accept: () => void;
  cancel: () => void;
  setInputValue: (v: string) => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  open: false,
  title: '',
  options: {},
  inputValue: '',
  _resolve: null,

  show: (title, options = {}) =>
    new Promise<ConfirmResult>((resolve) => {
      set({
        open: true,
        title,
        options,
        inputValue: options.inputConfig?.defaultValue ?? '',
        _resolve: resolve,
      });
    }),

  accept: () => {
    const { _resolve, inputValue } = get();
    _resolve?.({ confirmed: true, inputValue });
    set({ open: false, _resolve: null });
  },

  cancel: () => {
    const { _resolve } = get();
    _resolve?.({ confirmed: false, inputValue: '' });
    set({ open: false, _resolve: null });
  },

  setInputValue: (v) => set({ inputValue: v }),
}));

/** Simple boolean confirm — resolves true on Accept, false on Cancel */
export const confirmDialog = (
  title: string,
  message?: string,
  variant: ConfirmVariant = 'info',
) =>
  useConfirmStore.getState().show(title, { message, variant }).then((r) => r.confirmed);

/** Prompt with optional input field — resolves string on Accept, null on Cancel */
export const promptDialog = (
  title: string,
  message?: string,
  inputLabel?: string,
  defaultValue?: string,
) =>
  useConfirmStore
    .getState()
    .show(title, { message, variant: 'warning', inputConfig: { label: inputLabel ?? '', defaultValue } })
    .then((r) => (r.confirmed ? r.inputValue : null));
