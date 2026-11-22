/** Builds a readable, entirely synthetic PDF table in memory. */
export function syntheticPdf() {
  const positions = [40, 150, 320, 390, 450];
  const rows = [
    ['Date', 'Description', 'Amount', 'Currency', 'Balance'],
    ['2026-10-01', 'Synthetic PDF income', '100', 'USD', '200'],
    ['2026-10-02', 'Synthetic PDF coffee', '-5', 'USD', '195'],
  ];
  const stream = rows
    .flatMap((row, r) =>
      row.map((cell, c) => `BT /F1 10 Tf ${positions[c]} ${740 - r * 22} Td (${cell}) Tj ET`),
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(content);
}
