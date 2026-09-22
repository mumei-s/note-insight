import { useId, useState } from "react";
export function InsightDonut({items,label}:{items:{label:string;value:number}[];label:string}){
 const uid=useId().replace(/:/g,""),[selected,setSelected]=useState<number|null>(null);
 const colors=["#70e4ff","#b6ef6b","#b3a1ff","#ffcb76","#ff8fba","#68ddc5","#93aeff","#ded787","#e4a875","#9ab4c9"];
 const values=items.map(x=>Number.isFinite(x.value)?Math.max(0,x.value):0),total=values.reduce((s,v)=>s+v,0),perimeter=2*Math.PI*65;let offset=0;
 const slices=items.map((x,i)=>{const start=offset,share=total?values[i]/total:0;offset+=share;return{...x,value:values[i],share,start,color:colors[i%colors.length]}}),active=selected==null?null:slices[selected];
 return <figure className="insight-donut">
  <svg viewBox="0 0 200 208" role="img" aria-label={`${label} 合計${total.toLocaleString()}件`}>
   <defs>{colors.map((color,i)=><linearGradient key={color} id={`${uid}-face-${i}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f4ffff"/><stop offset=".15" stopColor={color}/><stop offset=".6" stopColor={color}/><stop offset="1" stopColor={color} stopOpacity=".72"/></linearGradient>)}<radialGradient id={uid+"well"} cx=".36" cy=".25" r=".8"><stop stopColor="#254457"/><stop offset=".7" stopColor="#091b28"/><stop offset="1" stopColor="#030b12"/></radialGradient></defs>
   <ellipse cx="100" cy="178" rx="70" ry="12" fill="#000" opacity=".3"/>
   <circle cx="100" cy="108" r="65" fill="none" stroke="#102432" strokeWidth="30"/>
   {slices.filter(x=>x.value>0).map(x=><circle key={x.label} cx="100" cy="108" r="65" fill="none" stroke={x.color} strokeWidth="30" strokeDasharray={`${x.share*perimeter} ${perimeter-x.share*perimeter}`} strokeDashoffset={-x.start*perimeter} transform="rotate(-90 100 108)" opacity=".38"/>)}
   <circle cx="100" cy="96" r="65" fill="none" stroke="#21394a" strokeWidth="30"/>
   {slices.map((x,i)=>x.value>0?<g key={x.label} className={selected===i?"donut-slice selected":"donut-slice"} style={{opacity:selected==null||selected===i?1:.45}}><circle cx="100" cy="96" r="65" fill="none" stroke={`url(#${uid}-face-${i%colors.length})`} strokeWidth="30" strokeDasharray={`${x.share*perimeter} ${perimeter-x.share*perimeter}`} strokeDashoffset={-x.start*perimeter} transform="rotate(-90 100 96)" onClick={()=>setSelected(selected===i?null:i)}><title>{`${x.label}：${x.value.toLocaleString()}件（${(x.share*100).toFixed(1)}%）`}</title></circle></g>:null)}
   <circle cx="100" cy="96" r="80" fill="none" stroke="#e5f9ff" strokeOpacity=".2"/>
   <circle cx="100" cy="96" r="48" fill={`url(#${uid}well)`} stroke="#020a10" strokeWidth="3"/>
   <text x="100" y="91" textAnchor="middle" fill="#eefaff" fontSize={String(active?.value??total).length>6?19:24} fontWeight="800">{(active?.value??total).toLocaleString()}</text>
   <text x="100" y="114" textAnchor="middle" fill="#a3cddd" fontSize="12">{active?`${(active.share*100).toFixed(1)}%`:"合計・件"}</text>
  </svg>
  <figcaption><strong>{label}</strong><small>項目をタップして内訳を確認</small>{slices.map((x,i)=><button type="button" className="insight-donut-legend" key={x.label} aria-pressed={selected===i} onClick={()=>setSelected(selected===i?null:i)}><i style={{background:x.color}}/><span>{x.label}</span><b>{x.value.toLocaleString()}件<em>{(x.share*100).toFixed(1)}%</em></b></button>)}</figcaption>
 </figure>
}
