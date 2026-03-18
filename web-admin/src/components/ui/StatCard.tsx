import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Tailwind border-color class for left accent */
  accent?: string;
  trend?: { value: string; positive?: boolean };
}

export default function StatCard({ label, value, icon, accent = 'border-blue-500', trend }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg p-6 border-l-4 ${accent} hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && <div className="text-blue-500 opacity-60">{icon}</div>}
      </div>
    </div>
  );
}
