import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'export';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-blue-700 text-white hover:bg-blue-800',
  secondary:
    'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50',
  outline:
    'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100',
  danger:
    'bg-red-600 text-white hover:bg-red-700',
  success:
    'bg-blue-700 text-white hover:bg-blue-800',
  export:
    'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100',
};

const sizeStyles: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1',
  sm: 'px-3 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 rounded-xl gap-2',
  lg: 'px-6 py-3 rounded-xl gap-2 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `.trim()}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
export default Button;
