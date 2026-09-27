import {useState} from 'react';
/** Common-baseline composition bars with exact proportions and explicit counts. */
export function InsightDonut({items,label,unit='件'}:{items:{label:string;value:number}[];label:string;unit?:string}){
 const[selected,setSelected]=useState<number|null>(null),colors=['#009aa6','#f09663','#7472cb','#3984ba','#cb6785','#83a954'],total=items.reduce((s,r)=>s+Math.max(0,Number(r.value)||0),0);
 const slices=items.map((r,i)=>({...r,value:Math.max(0,Number(r.value)||0),share:total?Math.max(0,Number(r.value)||0)/total:0,color:colors[i%colors.length]}));
 return <figure className="mipro-composition"><figcaption><b>{label}</b><small>合計 {total.toLocaleString()} {unit}</small></figcaption>{total?<div className="mipro-composition-strip" aria-hidden="true">{slices.map(r=><i key={r.label} style={{width:`${r.share*100}%`,background:r.color}}/>)}</div>:<p className="mipro-note">構成比を計算できる値がありません。</p>}<div className="mipro-composition-legend">{slices.map((r,i)=><button type="button" key={r.label} aria-pressed={selected===i} onClick={()=>setSelected(selected===i?null:i)}><i style={{background:r.color}}/><span>{r.label}<small>{r.value.toLocaleString()} {unit}</small></span><b>{total?(r.share*100).toFixed(1)+'%':'—'}</b></button>)}</div></figure>
}
