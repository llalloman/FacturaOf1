import type { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

type Variant = 'info' | 'success' | 'warning' | 'danger';

const cfg: Record<Variant, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-400',   icon: Info,         iconColor: 'text-blue-500' },
  success: { bg: 'bg-green-50',  border: 'border-green-400',  icon: CheckCircle2, iconColor: 'text-green-500' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-400', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  danger:  { bg: 'bg-red-50',    border: 'border-red-400',    icon: XCircle,      iconColor: 'text-red-500' },
};

export interface AlertProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export default function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  const { bg, border, icon: Icon, iconColor } = cfg[variant];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 border-l-4 ${border} ${bg} rounded-xl px-5 py-4 ${className}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}
