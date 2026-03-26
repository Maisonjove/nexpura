/**
 * Data export utilities for CSV and Excel
 */

export function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) return '';
  
  const headers = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'number') return String(value);
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

export async function downloadExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
  sheetName = 'Data'
) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add headers
  worksheet.columns = columns.map((col, i) => {
    const headerWidth = col.label.length;
    const dataWidth = Math.max(...data.map(row => {
      const val = row[col.key];
      return val ? String(val).length : 0;
    }));
    return {
      header: col.label,
      key: String(col.key),
      width: Math.min(Math.max(headerWidth, dataWidth) + 2, 50),
    };
  });
  
  // Add rows
  for (const row of data) {
    const rowData: Record<string, unknown> = {};
    for (const col of columns) {
      rowData[String(col.key)] = row[col.key];
    }
    worksheet.addRow(rowData);
  }
  
  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatCurrencyForExport(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}
