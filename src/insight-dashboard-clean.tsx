import { AnalyticsApp } from "./analytics-app";

export function InsightDashboardClean(){
 return <>
  <div className="insight-toolbar"><style>{`.insight-toolbar{background:#080d13;border-bottom:1px solid #243044;padding:9px 12px}.insight-toolbar>div{width:min(1280px,100%);margin:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.insight-toolbar strong{margin-right:auto;color:#dce7f4}.insight-toolbar a{border:1px solid #33465d;border-radius:999px;padding:8px 12px;color:#dce7f4;text-decoration:none;font-weight:850}.insight-toolbar a:first-of-type{color:#cfff64;border-color:#718b2f}.insight-toolbar a:last-of-type{color:#75e6ff;border-color:#2b7890}`}</style><div><strong>INSIGHTツール</strong><a href={`${import.meta.env.BASE_URL}notification-setup.html`}>本人通知を設定</a><a href="#evidence">ダッシュボード資料庫</a></div></div>
  <AnalyticsApp/>
 </>;
}
