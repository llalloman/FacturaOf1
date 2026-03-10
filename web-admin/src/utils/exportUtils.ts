/**
 * Utility functions for exporting data to Excel (.xlsx) and triggering browser print for PDF.
 * Uses the `xlsx` (SheetJS) library for Excel generation.
 */
import * as XLSX from 'xlsx';

/** Export a list of objects to an .xlsx file with one sheet */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  sheetName: string,
  fileName: string,
  columnOrder?: (keyof T)[],
): void {
  const ordered = columnOrder
    ? data.map((row) => {
        const result: Record<string, unknown> = {};
        columnOrder.forEach((k) => { result[k as string] = row[k]; });
        return result;
      })
    : data;

  const ws = XLSX.utils.json_to_sheet(ordered);
  // Auto-width columns
  const colWidths = Object.keys(ordered[0] ?? {}).map((k) => ({
    wch: Math.max(k.length, ...ordered.map((r) => String(r[k] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Export multiple sheets to a single .xlsx file */
export function exportToExcelMultiSheet(
  sheets: Array<{ name: string; data: Record<string, unknown>[] }>,
  fileName: string,
): void {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    if (!data.length) {
      const ws = XLSX.utils.aoa_to_sheet([['Sin datos']]);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0]).map((k) => ({
      wch: Math.max(k.length, ...data.map((r) => String(r[k] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Trigger browser print dialog for the element with the given id */
export function printElement(elementId: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  // Grab all stylesheets
  const styles = Array.from(document.styleSheets)
    .map((ss) => {
      try {
        return Array.from(ss.cssRules).map((r) => r.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte</title>
        <style>${styles}</style>
        <style>
          body { font-family: sans-serif; padding: 24px; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>${el.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}
