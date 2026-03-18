import apiClient from './apiClient';

/**
 * Generic export service — triggers file download via the ExportMixin endpoints.
 *
 * Usage:
 *   exportService.csv('/facturacion/facturas/export-csv/', 'facturas.csv');
 *   exportService.excel('/facturacion/facturas/export-excel/', 'facturas.xlsx');
 *
 * Accepts optional query string to forward current list filters:
 *   exportService.csv('/facturacion/facturas/export-csv/?estado=AUTORIZADA', 'facturas.csv');
 */

async function download(url: string, filename: string) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export const exportService = {
  csv: (url: string, filename?: string) =>
    download(url, filename ?? 'export.csv'),

  excel: (url: string, filename?: string) =>
    download(url, filename ?? 'export.xlsx'),
};
