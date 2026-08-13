import { useMemo, useState } from "react";

function localDateTime() {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
}

export function EvidenceUploader() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [capturedAt, setCapturedAt] = useState(localDateTime);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const preview = useMemo(
    () => (file?.type.startsWith("image/") ? URL.createObjectURL(file) : ""),
    [file],
  );

  async function save() {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("captured_at", new Date(capturedAt).toISOString());
      const response = await fetch("/owner/evidence-upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "保存できませんでした。");
      setFile(null);
      setMessage("保存しました。INSIGHTの証拠データとして保管されています。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="evidence-fab" type="button" onClick={() => setOpen(true)}>
        スクショ保存 ＋
      </button>
      {open ? (
        <div className="evidence-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="evidence-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>INSIGHT EVIDENCE</small>
                <h2>ダッシュボードのスクショ保存</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>
            <p>noteダッシュボードのスクショやPDFを、撮影日時と一緒に非公開保管します。</p>
            <label>
              <span>画像・PDF</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {preview ? <img className="evidence-preview" src={preview} alt="選択したスクリーンショット" /> : null}
            {file && !preview ? <div className="evidence-file-name">{file.name}</div> : null}
            <label>
              <span>スクショ日時</span>
              <input type="datetime-local" value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} />
            </label>
            <button className="evidence-save" type="button" disabled={!file || busy} onClick={() => void save()}>
              {busy ? "保存中…" : "INSIGHTへ保存"}
            </button>
            {message ? <p className="evidence-message">{message}</p> : null}
            <small className="evidence-help">PNG / JPG / WebP / PDF・15MBまで</small>
          </section>
        </div>
      ) : null}
      <style>{`
        .evidence-fab{position:fixed;left:14px;bottom:14px;z-index:82;border:1px solid #39d9ff;border-radius:999px;background:#0c2230;color:#7be8ff;padding:12px 16px;font-weight:950;box-shadow:0 12px 36px rgba(0,0,0,.38)}
        .evidence-backdrop{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:14px}
        .evidence-modal{width:min(560px,100%);max-height:90vh;overflow-y:auto;border:1px solid #294154;border-radius:22px;background:#0b1119;color:#f4f7fb;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
        .evidence-modal header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.evidence-modal header small{color:#54d8ff;font-weight:900}.evidence-modal h2{margin:5px 0}.evidence-modal header button{border:0;border-radius:10px;background:#243044;color:#fff;padding:8px 11px;font-size:18px}
        .evidence-modal>p{color:#93a3b8;line-height:1.65}.evidence-modal label{display:grid;gap:7px;margin-top:15px;font-weight:850}.evidence-modal input[type=datetime-local]{min-height:46px;border-radius:11px;border:1px solid #33445a;background:#070b11;color:#fff;padding:0 12px}
        .evidence-preview{width:100%;max-height:320px;object-fit:contain;border-radius:14px;margin-top:12px;background:#05080c}.evidence-file-name{margin-top:12px;padding:14px;border-radius:12px;background:#111b27}
        .evidence-save{width:100%;margin-top:16px;min-height:48px;border:0;border-radius:12px;background:#54d8ff;color:#071016;font-weight:950}.evidence-save:disabled{opacity:.5}.evidence-message{font-weight:800;color:#c9f6ff}.evidence-help{display:block;margin-top:10px;color:#76869b}
        @media(max-width:520px){.evidence-fab{left:10px;bottom:10px;padding:11px 13px}.evidence-modal{border-radius:18px}}
      `}</style>
    </>
  );
}
