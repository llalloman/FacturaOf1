import type { ReactNode } from 'react';

type Variant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';

const variantStyles: Record<Variant, string> = {
  success: 'bg-green-100 text-green-800',
  danger:  'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info:    'bg-blue-50 text-blue-700',
  neutral: 'bg-gray-100 text-gray-800',
  purple:  'bg-purple-50 text-purple-700',
};

export interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  /** Optional dot indicator before text */
  dot?: boolean;
}

export default function Badge({ variant = 'neutral', children, className = '', dot }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === 'success' ? 'bg-green-500'
            : variant === 'danger' ? 'bg-red-500'
            : variant === 'warning' ? 'bg-yellow-500'
            : variant === 'info' ? 'bg-blue-500'
            : variant === 'purple' ? 'bg-purple-500'
            : 'bg-gray-500'
          }`}
        />
      )}
      {children}
    </span>
  );
}
