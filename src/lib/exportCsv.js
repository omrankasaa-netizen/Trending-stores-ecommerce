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

const STORE_NAME = "Trending Store";

// Open a clean, RTL, print-friendly window: store header + date + table.
// `headers` is an array of column labels (Arabic), `rows` an array of arrays.
// Trending products carry a single stock_quantity (no size/variant model), so
// the printed sheet lists stock per product.
export function printTable(title, headers, rows) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif;padding:24px;color:#1a1a1a}
      h1{font-size:20px;margin:0 0 4px;color:#127a8a;font-weight:800;letter-spacing:1px}
      .meta{font-size:12px;color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
      th{background:#e6f2f3;color:#0d5a66;border-bottom:2px solid #127a8a}
      tr:nth-child(even) td{background:#fafafa}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${esc(STORE_NAME)}</h1>
    <div class="meta">${esc(title)} · ${new Date().toLocaleString()} · ${rows.length} صف</div>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;cursor:pointer">طباعة</button>
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </body></html>`);
  w.document.close();
}
