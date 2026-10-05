import { useEffect, useRef, useState } from "react";
import "./home-screen-install.css";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const browsers = ["Chrome", "Edge", "Firefox", "Safari", "Yahoo", "Samsung Internet", "その他"];
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Yahoo|YJApp/i.test(ua)) return "Yahoo";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Edg/i.test(ua)) return "Edge";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/Chrome|CriOS/i.test(ua)) return "Chrome";
  return /Safari/i.test(ua) ? "Safari" : "その他";
}
function detectDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iOS" : /Android/.test(navigator.userAgent) ? "Android" : "PC";
}
export function HomeScreenInstall() {
  const [browser, setBrowser] = useState(detectBrowser);
  const [device, setDevice] = useState(detectDevice);
  const [promptEvent, setPromptEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const copyField = useRef<HTMLInputElement>(null);
  const url = new URL(import.meta.env.BASE_URL, location.origin).href;
  useEffect(() => {
    const media = matchMedia("(display-mode: standalone)");
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallEvent); };
    const done = () => { setInstalled(true); setPromptEvent(null); setNotice("追加されました。ホーム画面のINSIGHTアイコンから開けます。"); };
    const changed = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", changed);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); media.removeEventListener("change", changed); };
  }, []);
  async function install() {
    if (!promptEvent || busy) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setNotice(choice.outcome === "accepted" ? "追加を受け付けました。ホーム画面をご確認ください。" : "追加はキャンセルされました。下の手順からも追加できます。");
    } catch { setNotice("下のブラウザメニューの手順から追加してください。"); }
    finally { setPromptEvent(null); setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice("URLをコピーしました。対応ブラウザのアドレス欄に貼り付けて開いてください。"); }
    catch { copyField.current?.focus(); copyField.current?.select(); setNotice("URLを長押ししてコピーしてください。"); }
  }
  let steps: string[];
  if (device === "iOS") {
    steps = browser === "Safari" ? ["Safariの共有ボタンをタップ", "「ホーム画面に追加」を選ぶ（見つからなければ一覧を下へスクロール）", "「Webアプリとして開く」が表示された場合はONにして「追加」"] : [`${browser}の共有メニューで「ホーム画面に追加」があれば選ぶ`, "見つからない場合は下のURLをコピーしてSafariで開く", "Safariの共有 →「ホーム画面に追加」→「追加」（「Webアプリとして開く」があればON）"];
  } else if (device === "Android") {
    steps = browser === "Yahoo" || browser === "その他" || browser === "Safari" ? ["ブラウザのメニューに「ホーム画面に追加」があれば選ぶ", "項目がない場合は下のURLをコピーしてChromeまたはEdgeで開く", "メニュー →「アプリをインストール」または「ホーム画面に追加」→ 確認して追加"] : browser === "Samsung Internet" ? ["メニューを開く", "「ページを追加」→「ホーム画面」（またはインストールのアイコン）", "確認画面で追加"] : [ `${browser}のメニュー（⋮ または …）を開く`, browser === "Firefox" ? "「インストール」または「ホーム画面に追加」を選ぶ" : "「アプリをインストール」または「ホーム画面に追加」を選ぶ", "確認画面で追加して、ホーム画面のアイコンを確認"];
  } else {
    steps = browser === "Safari" ? ["MacのSafariでINSIGHTを開く", "ファイル →「Dockに追加」（対応macOS）", "名前を確認して追加"] : browser === "Chrome" || browser === "Edge" ? [ `${browser}でINSIGHTを開く`, "アドレス欄のインストールアイコン、またはメニューのアプリ追加項目を選ぶ", "確認画面でインストール"] : ["アプリ追加項目がある場合はブラウザの案内に従う", "項目がない場合はChromeまたはEdgeで下のURLを開く", "インストールアイコンから追加"];
  }
  return <div className="insight-home-install">
    <button type="button" className="insight-home-install-open" onClick={() => dialog.current?.showModal()}>▣ {installed ? "アプリの追加について" : "ホーム画面にINSIGHTを追加"}</button>
    <dialog ref={dialog} className="insight-home-install-dialog" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="48" height="48" /><h2>INSIGHTをアプリに</h2><button type="button" aria-label="案内を閉じる" onClick={() => dialog.current?.close()}>×</button></header>
      <p>ホーム画面のアイコンから、INSIGHTをすぐ開けます。</p>
      {installed && <p role="status">現在はアプリとして開いています。</p>}
      <div className="insight-home-install-selects"><label>端末<select value={device} onChange={e => setDevice(e.target.value)}><option value="Android">Android</option><option value="iOS">iPhone / iPad</option><option value="PC">PC / Mac</option></select></label><label>ブラウザ<select value={browser} onChange={e => setBrowser(e.target.value)}>{browsers.map(b => <option key={b}>{b}</option>)}</select></label></div>
      {promptEvent && !installed && <button type="button" disabled={busy} onClick={() => void install()}>{busy ? "確認画面を開いています…" : "このブラウザでインストール"}</button>}
      <ol>{steps.map(s => <li key={s}>{s}</li>)}</ol>
      <p className="insight-home-install-hint">メニュー名はバージョンで異なります。追加項目が出ない場合は、AndroidはChrome・Edge、iPhone・iPadはSafariで開いてください。</p>
      <label>INSIGHTのURL<input ref={copyField} readOnly value={url} onFocus={e => e.target.select()} /></label><button type="button" onClick={() => void copy()}>URLをコピー</button>
      <p role="status" aria-live="polite">{notice}</p>
      <p className="insight-home-install-hint">別のブラウザや新しいWebアプリで開くと、初回ログインが必要な場合があります。本人通知・DMの取得ツールの導入は、既存の設定画面から行えます。</p>
    </dialog>
  </div>;
}
