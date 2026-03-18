import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, TableHTMLAttributes, HTMLAttributes } from 'react';

/* ── Table root ── */
export function Table({ className = '', children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-blue-100 shadow-lg bg-white/80 backdrop-blur-sm">
      <table className={`w-full ${className}`} {...rest}>
        {children}
      </table>
    </div>
  );
}

/* ── Head ── */
export function THead({ children, className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-gradient-to-r from-blue-50 to-sky-50 border-b border-blue-200 ${className}`}
      {...rest}
    >
      {children}
    </thead>
  );
}

/* ── Header cell ── */
export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

/* ── Body ── */
export function TBody({ children, className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-gray-200 ${className}`} {...rest}>
      {children}
    </tbody>
  );
}

/* ── Row ── */
export function Tr({ children, className = '', ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-blue-50/50 transition-colors ${className}`} {...rest}>
      {children}
    </tr>
  );
}

/* ── Data cell ── */
export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-6 py-4 text-sm text-gray-700 ${className}`} {...rest}>
      {children}
    </td>
  );
}

/* ── Empty state ── */
export function TableEmpty({ colSpan, message = 'No hay datos' }: { colSpan: number; message?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center text-gray-400">
        {message}
      </td>
    </tr>
  );
}
