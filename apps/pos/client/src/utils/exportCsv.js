/**
 * Reusable utility to export tabular data as a CSV file from the browser.
 *
 * @param {string} filenamePrefix - Base name of the file (timestamp will be appended).
 * @param {string[]} headers - Array of column labels.
 * @param {any[][]} rows - 2D array of data matching the headers structure.
 */
export function exportToCsv(filenamePrefix, headers, rows) {
  const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];
  
  // Headers row
  csvRows.push(headers.map(escapeCsvValue).join(','));

  // Data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCsvValue).join(','));
  }

  // Combine rows with CRLF and inject UTF-8 BOM (\uFEFF) for proper Excel parsing
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
