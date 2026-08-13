import { AnalyticsApp } from "./analytics-app";

export function InsightDashboardPage(){
 return <>
  <div style={{background:"#080d13",borderBottom:"1px solid #243044",padding:"9px 12px"}}>
   <div style={{width:"min(1280px,100%)",margin:"0 auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
    <strong style={{marginRight:"auto",color:"#dce7f4"}}>INSIGHTツール</strong>
    <a href="#notification-setup" style={{border:"1px solid #718b2f",borderRadius:999,padding:"8px 12px",color:"#cfff64",textDecoration:"none",fontWeight:850}}>本人通知の設定</a>
    <a href="#evidence" style={{border:"1px solid #2b7890",borderRadius:999,padding:"8px 12px",color:"#75e6ff",textDecoration:"none",fontWeight:850}}>ダッシュボード資料庫</a>
   </div>
  </div>
  <AnalyticsApp/>
 </>;
}
