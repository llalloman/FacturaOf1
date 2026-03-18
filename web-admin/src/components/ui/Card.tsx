import type { ReactNode, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Glass-morphism style (backdrop-blur) – matches Productos/Clientes */
  glass?: boolean;
  /** Hover lift animation */
  hover?: boolean;
  /** Left border accent color (Tailwind border color class, e.g. 'border-blue-500') */
  accent?: string;
  noPadding?: boolean;
}

export default function Card({
  children,
  glass,
  hover,
  accent,
  noPadding,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl shadow-lg border
        ${glass ? 'bg-white/80 backdrop-blur-sm border-blue-100' : 'bg-white border-gray-100'}
        ${hover ? 'hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5' : ''}
        ${accent ? `border-l-4 ${accent}` : ''}
        ${noPadding ? '' : 'p-6'}
        ${className}
      `.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
