export function exportToCSV(data: Record<string, any>[], fields: { name: string; label: string }[], filename: string) {
  if (data.length === 0) return;

  const headers = fields.map((f) => f.label);
  const rows = data.map((item) =>
    fields.map((f) => {
      const val = item[f.name];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape quotes and wrap in quotes if needed
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
  );

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
