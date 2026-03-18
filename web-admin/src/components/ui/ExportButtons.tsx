import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportService } from '../../services/exportService';

interface ExportButtonsProps {
  /** Base API path, e.g. '/facturacion/facturas' (no trailing slash) */
  basePath: string;
  /** Filename without extension */
  filename?: string;
  /** Extra query string to append (forwards current filters) */
  queryString?: string;
}

export default function ExportButtons({
  basePath,
  filename = 'export',
  queryString = '',
}: ExportButtonsProps) {
  const [loading, setLoading] = useState<'csv' | 'excel' | null>(null);

  const qs = queryString ? `?${queryString}` : '';

  const handleExport = async (format: 'csv' | 'excel') => {
    setLoading(format);
    try {
      if (format === 'csv') {
        await exportService.csv(
          `${basePath}/export-csv/${qs}`,
          `${filename}.csv`,
        );
      } else {
        await exportService.excel(
          `${basePath}/export-excel/${qs}`,
          `${filename}.xlsx`,
        );
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleExport('csv')}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Exportar CSV"
      >
        {loading === 'csv' ? (
          <Download className="h-4 w-4 animate-bounce" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        CSV
      </button>
      <button
        type="button"
        onClick={() => handleExport('excel')}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Exportar Excel"
      >
        {loading === 'excel' ? (
          <Download className="h-4 w-4 animate-bounce" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        Excel
      </button>
    </div>
  );
}
