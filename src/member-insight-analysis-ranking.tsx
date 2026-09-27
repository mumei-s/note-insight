import { useState } from 'react';
type Row=Record<string,any>;
const labels:Record<string,string>={score:'INSIGHT指数',pageViews:'ページビュー',likes:'スキ',comments:'コメント',salesYen:'売上'};
const n=(v:number)=>new Intl.NumberFormat('ja-JP').format(v||0);
export function ArticleRanking({articles}:{articles:Row[]}){
 const[order,setOrder]=useState('score'),[limit,setLimit]=useState(12);
 const ranked=[...articles].sort((a,b)=>(Number(b[order])||0)-(Number(a[order])||0)||String(a.article_key||a.title).localeCompare(String(b.article_key||b.title)));
 return <section className="mipro-ranking" aria-label="記事ランキング">
  <label className="mipro-ranking-sort">並べ替え<select value={order} onChange={e=>{setOrder(e.target.value);setLimit(12)}}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}が多い順</option>)}</select></label>
  <p className="mipro-note">{ranked.length}記事中 {Math.min(limit,ranked.length)}記事を表示。スキ・コメントは実数です。</p>
  <ol>{ranked.slice(0,limit).map((r,i)=><li key={r.article_key||r.url||r.title}>
   <header><span className="mipro-rank-number">{String(i+1).padStart(2,'0')}</span><div>{r.url?<a href={r.url} target="_blank" rel="noreferrer">{r.title||'無題'} ↗</a>:<b>{r.title||'無題'}</b>}{r.status==='draft'?<small>下書き</small>:null}</div><span className="mipro-rank-score"><small>指数</small><b>{r.score}</b></span></header>
   <dl><div><dt>ページビュー</dt><dd>{n(r.pageViews)}<small> 回</small></dd></div><div><dt>スキ</dt><dd>{n(r.likes)}<small> 件</small></dd></div><div><dt>コメント</dt><dd>{n(r.comments)}<small> 件</small></dd></div><div><dt>売上</dt><dd>¥{n(r.salesYen)}</dd></div></dl>
   <details><summary>読まれ方・反応を詳しく</summary><p>表示回数に対して読まれた割合：{r.conversion==null?'算出対象外':r.conversion.toFixed(1)+'%'}</p><p>1,000回読まれたときの反応数：{r.reactionsPer1k==null?'PVがないため算出できません':n(Math.round(r.reactionsPer1k))+'件'}<small>（スキ数＋コメント数）÷ ページビュー × 1,000。割合・人数ではありません。</small></p></details>
  </li>)}</ol>
  {limit<ranked.length?<button className="mipro-ranking-more" onClick={()=>setLimit(v=>v+12)}>次の12記事を表示（残り{ranked.length-limit}記事）</button>:null}
 </section>
}
