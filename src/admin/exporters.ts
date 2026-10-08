export type ExportRow = (string | number)[]

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function sanitize(value: string | number): string {
  const s = String(value ?? '')
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

export function exportCsv(filename: string, header: string[], rows: ExportRow[]) {
  const esc = (v: string) => (/([";,\n])/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [header.map(esc).join(';')]
  for (const r of rows) lines.push(r.map((c) => esc(sanitize(c))).join(';'))
  downloadBlob('\uFEFF' + lines.join('\r\n'), filename, 'text/csv;charset=utf-8')
}

export async function exportXlsx(filename: string, sheetName: string, header: string[], rows: ExportRow[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, Math.min(28, String(h).length + 6)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

export async function exportPdf(
  filename: string,
  title: string,
  subtitle: string,
  header: string[],
  rows: ExportRow[],
  footer?: string,
) {
  const [{ jsPDF }, autotable] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autotable.default
  const doc = new jsPDF({ orientation: rows.length > 25 || header.length > 7 ? 'landscape' : 'portrait' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20, 16, 12)
  doc.text(title, 14, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(130, 120, 108)
  doc.text(subtitle, 14, 22)
  doc.setDrawColor(201, 162, 39)
  doc.setLineWidth(0.4)
  doc.line(14, 25, doc.internal.pageSize.getWidth() - 14, 25)

  autoTable(doc, {
    startY: 30,
    head: [header],
    body: rows.map((r) => r.map((c) => sanitize(c))),
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [40, 36, 32], lineColor: [222, 216, 205], lineWidth: 0.1 },
    headStyles: { fillColor: [20, 16, 12], textColor: [212, 175, 55], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [246, 243, 238] },
    margin: { left: 14, right: 14 },
  })
  const pages = doc.getNumberOfPages()
  if (footer) {
    doc.setFontSize(8)
    doc.setTextColor(130, 120, 108)
    doc.text(footer, 14, doc.internal.pageSize.getHeight() - 8)
  }
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 150, 138)
    doc.text(`${title} · ${subtitle}`, 14, doc.internal.pageSize.getHeight() - 6)
    doc.text(`Página ${i} / ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  doc.save(filename)
}