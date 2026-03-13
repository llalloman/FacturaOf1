import { useCallback } from 'react';
import { toast, type ToastType } from '../store/toastStore';

export function useToast() {
  const showToast = useCallback((title: string, type: ToastType = 'info') => {
    toast[type](title);
  }, []);
  return { showToast };
}
