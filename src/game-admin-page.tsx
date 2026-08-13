import { useEffect, useState } from "react";

type Opponent={id:string;name:string;job:string;rarity:string;image_url:string|null;version:number};
type Creator={id:string;note_id:string;display_name:string;images:{position:number;url:string|null}[]};
type GameData={opponents:Opponent[];creators:Creator[]};

export function GameAdminPage(){
  const[data,setData]=useState<GameData>({opponents:[],creators:[]});
  const[busy,setBusy]=useState("");
  const[message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/owner/game-data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"admin"})});
    const p=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(p?.error??"読み込めませんでした。");
    setData({opponents:p.opponents??[],creators:p.creators??[]});
  }
  useEffect(()=>{void load().catch(e=>setMessage(e instanceof Error?e.message:"読み込めませんでした。"));},[]);

  async function upload(kind:"opponent"|"creator",id:string,file:File,position=0){
    const key=`${kind}:${id}:${position}`;setBusy(key);setMessage("");
    try{
      const f=new FormData();f.set("kind",kind);f.set("id",id);f.set("position",String(position));f.set("file",file);
      const r=await fetch("/owner/creator-upload",{method:"POST",body:f});const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(p?.error??"画像を変更できませんでした。");
      await load();setMessage("カード画像を更新しました。");
    }catch(e){setMessage(e instanceof Error?e.message:"画像を変更できませんでした。");}finally{setBusy("");}
  }

  return <div className="game-admin-page">
    <link rel="stylesheet" href={`${import.meta.env.BASE_URL}game-admin.css`}/>
    <main className="game-admin-wrap">
      <nav><a href="#manage">← 管理ページ</a><a href="#battle">ゲーム画面 ↗</a></nav>
      <header><small>CREATOR WORLD / GAME MASTER</small><h1>バトル・ゲーム管理</h1><p>公開ゲームで使うカード画像をここから差し替えます。</p></header>
      {message?<div className="game-admin-message">{message}</div>:null}
      <section><div className="game-admin-heading"><h2>対戦カード</h2><b>{data.opponents.length}枚</b></div><div className="opponent-admin-grid">
        {data.opponents.map(x=>{const key=`opponent:${x.id}:0`;return <article className="opponent-admin-card" key={x.id}>
          <div className="opponent-art">{x.image_url?<img src={x.image_url} alt=""/>:null}<div><small>{x.rarity} / V{x.version}</small><h3>{x.name}</h3><p>{x.job}</p></div></div>
          <label className={busy===key?"is-busy":""}>{busy===key?"変更中…":"対戦カード画像を差し替え"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={e=>{const f=e.target.files?.[0];if(f)void upload("opponent",x.id,f);e.currentTarget.value="";}}/></label>
        </article>})}
      </div></section>
      <section><div className="game-admin-heading"><h2>参加者カード</h2><b>1人3枚</b></div><div className="creator-admin-grid">
        {data.creators.map(c=><article className="creator-admin-card" key={c.id}><small>@{c.note_id}</small><h3>{c.display_name||c.note_id}</h3><div className="creator-image-slots">
          {[0,1,2].map(pos=>{const image=c.images.find(x=>x.position===pos);const key=`creator:${c.id}:${pos}`;return <label className="creator-image-slot" key={pos}>{image?.url?<img src={image.url} alt=""/>:null}<span>{busy===key?"…":image?.url?"変更":`＋${pos+1}`}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={e=>{const f=e.target.files?.[0];if(f)void upload("creator",c.id,f,pos);e.currentTarget.value="";}}/></label>})}
        </div></article>)}
      </div></section>
    </main>
  </div>;
}
