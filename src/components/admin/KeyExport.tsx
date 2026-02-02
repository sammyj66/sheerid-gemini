"use client";

type KeyExportProps = {
  status: string;
  query: string;
};

async function downloadExport(url: string, filename: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("导出失败");
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function KeyExport({ status, query }: KeyExportProps) {
  const base = `/api/admin/export?status=${encodeURIComponent(
    status || "ALL"
  )}&q=${encodeURIComponent(query || "")}`;

  const handleExport = async (format: "csv" | "json") => {
    const filename = format === "csv" ? "cardkeys.csv" : "cardkeys.json";
    await downloadExport(`${base}&format=${format}`, filename);
  };

  return (
    <div className="toolbar">
      <button
        type="button"
        className="ghost-button"
        onClick={() => handleExport("csv")}
      >
        导出 CSV
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={() => handleExport("json")}
      >
        导出 JSON
      </button>
    </div>
  );
}
