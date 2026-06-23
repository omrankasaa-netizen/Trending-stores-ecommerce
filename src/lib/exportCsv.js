import { base44 } from "@/api/base44Client";

// Trigger a browser download of CSV text.
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Call a backend export function (returns { filename, csv }) and download it.
export async function exportViaFunction(fnName, body = {}) {
  const res = await base44.functions[fnName](body);
  if (res?.csv) downloadCsv(res.filename, res.csv);
  return res;
}
