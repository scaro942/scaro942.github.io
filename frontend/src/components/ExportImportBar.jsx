import { useRef } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";

export default function ExportImportBar({ mode, store, onImportResult, onAfterImport, toast }) {
  const fileRef = useRef(null);

  const handleExport = async () => {
    try {
      const data = await store.exportData(mode);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cnxue_${mode}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast?.success(`${data.slots.length}개 슬롯을 내보냈습니다.`);
    } catch (e) {
      toast?.error("내보내기 실패");
    }
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = ""; // allow re-import same file
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.kind && data.kind !== mode) {
        toast?.error(`이 파일은 ${data.kind === "word" ? "단어" : "문장"} 슬롯 파일이에요.`);
        return;
      }
      const slots = data.slots || [];
      const res = await store.importData({ kind: mode, slots, force: false });
      if (res.status === "insufficient_slots") {
        onImportResult?.({ info: res, slots });
      } else {
        toast?.success(`${res.imported}개 슬롯을 불러왔어요.`);
        await onAfterImport?.();
      }
    } catch (err) {
      toast?.error("불러오기 실패: 올바른 JSON 파일이 아닙니다.");
    }
  };

  return (
    <div className="flex gap-2">
      <button
        data-testid="export-slots-btn"
        onClick={handleExport}
        className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
      >
        <DownloadSimple size={14} weight="bold" /> 내보내기
      </button>
      <button
        data-testid="import-slots-btn"
        onClick={() => fileRef.current?.click()}
        className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
      >
        <UploadSimple size={14} weight="bold" /> 불러오기
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
        data-testid="import-file-input"
      />
    </div>
  );
}
