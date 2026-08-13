import { EvidenceUploader } from "./evidence-uploader";

export function EvidencePage(){
 return <div style={{minHeight:"100vh",background:"#070a0f",color:"#f5f8fc",padding:"22px 14px 80px",fontFamily:"system-ui,sans-serif"}}>
  <main style={{width:"min(860px,100%)",margin:"0 auto"}}>
   <a href="#dashboard" style={{color:"#54d8ff",fontWeight:900,textDecoration:"none"}}>← INSIGHTへ戻る</a>
   <header style={{padding:"48px 0 22px"}}><small style={{color:"#54d8ff",fontWeight:900,letterSpacing:".14em"}}>INSIGHT EVIDENCE</small><h1 style={{fontSize:"clamp(38px,7vw,64px)",margin:"8px 0"}}>ダッシュボード保存</h1><p style={{color:"#9ca9bb",lineHeight:1.8}}>noteダッシュボードのスクリーンショット・PDFを撮影日時付きで保管します。右下ではなく、この画面の「スクショ保存＋」から画像を選択してください。</p></header>
   <section style={{border:"1px solid #28394d",borderRadius:20,background:"#0e151f",padding:22}}><h2>保存できるもの</h2><p style={{color:"#aab6c8",lineHeight:1.7}}>PNG / JPG / WebP / PDF、15MBまで。INSIGHTの非公開証拠保管領域に保存します。</p></section>
  </main>
  <EvidenceUploader/>
 </div>;
}
