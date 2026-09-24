import fs from 'node:fs/promises';

const TAG = 'イケメングランプリ宵空カップ';
const LIKE_SOURCES = ['n3184e99d27bf','nc5786f97f59b'];
const FINAL = { urlname:'fuku444', key:'nb4f6934381e9' };
// Latest explicit manual additions from the September 23-24 batch work.
// These are additions to the live like-derived set, not a substitute for it.
const MANUAL_PROFILES = [
  'noah_woaks',
  'star246',
  'ann43tsukinomiya',
  'ai_hana_yocchi',
  'shirono_aru',
  'unique_drake3258',
  'agari_nara00',
  'lovely_coyote546'
];

const OUT_URLS = process.argv[2] || 'data/note-live-batch-urls.txt';
const OUT_META = process.argv[3] || 'data/note-live-batch-live.json';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const now = new Date();
const jstNow = new Date(now.getTime() + 9*3600_000);
const dayKey = d => new Date(d.getTime()+9*3600_000).toISOString().slice(0,10);
const TODAY = dayKey(now);
const YESTERDAY = dayKey(new Date(now.getTime()-86400_000));

async function get(path){
  const url='https://note.com'+path;
  let last;
  for(let attempt=1;attempt<=6;attempt++){
    try{
      const response=await fetch(url,{headers:{
        'user-agent':'Mozilla/5.0 (compatible; MumeiLiveBatch/1.0)',
        'accept':'application/json,text/plain,*/*'
      },redirect:'follow'});
      if(!response.ok){
        const error=new Error('HTTP '+response.status);
        error.permanent=response.status>=400&&response.status<500&&![408,429].includes(response.status);
        throw error;
      }
      const json=await response.json();
      return json?.data ?? json;
    }catch(error){
      last=error;
      if(error?.permanent) break;
      if(attempt<6) await sleep(attempt*1200);
    }
  }
  throw new Error('取得失敗 '+url+': '+(last?.message||last));
}
const noteRows = d => Array.isArray(d?.contents) ? d.contents : Array.isArray(d?.notes) ? d.notes : [];
const unwrap = value => value?.note || value;
const username = u => String(u?.urlname || u?.url_name || '').trim().toLowerCase();
function publishDay(note){
  const value=note?.publishAt||note?.publish_at||'';
  const d=new Date(value);
  return Number.isNaN(+d) ? '' : dayKey(d);
}
async function detail(key){
  const n=await get('/api/v3/notes/'+key);
  const u=n?.user||n?.author||{};
  const who=username(u);
  const creator=String(u?.nickname||u?.name||'').trim();
  if(!/^n[a-f0-9]{12}$/i.test(String(n?.key||'')) || n.key!==key || !who || !creator) {
    throw new Error('記事・投稿者照合失敗 '+key);
  }
  return {
    key,
    urlname:who,
    creator,
    title:String(n?.name||n?.title||'').trim(),
    publishAt:n?.publishAt||n?.publish_at||'',
    actorImageUrl:u?.user_profile_image_url||u?.user_profile_image_path||u?.profileImageUrl||'',
    thumbUrl:n?.eyecatch_url||n?.eyecatch||''
  };
}
async function chooseNonTag(who){
  const recent=noteRows(await get('/api/v2/creators/'+encodeURIComponent(who)+'/contents?kind=note&page=1&disabled_pinned=true&with_notes=false')).map(unwrap);
  if(!recent.length) return null;
  const recentHit=recent
    .filter(n=>[TODAY,YESTERDAY].includes(publishDay(n)))
    .sort((a,b)=>new Date(b?.publishAt||b?.publish_at||0)-new Date(a?.publishAt||a?.publish_at||0))[0];
  let chosen=recentHit, source='todayYesterday';
  if(!chosen){
    const withPinned=noteRows(await get('/api/v2/creators/'+encodeURIComponent(who)+'/contents?kind=note&page=1&disabled_pinned=false&with_notes=false')).map(unwrap);
    const fixed=withPinned.find(n=>n?.isPinned===true||n?.is_pinned===true);
    chosen=fixed||recent[0];
    source=fixed?'fixedFallback':'latestFallback';
  }
  if(!chosen?.key) return null;
  const verified=await detail(chosen.key);
  if(verified.urlname!==who) throw new Error('投稿者不一致 '+who+'/'+chosen.key);
  return {...verified,source};
}

// 1) All current hashtag articles, not one per author.
const hashtag=[];
const hashtagAuthors=new Set();
const seenTagKeys=new Set();
for(let page=1;page<=200;page++){
  const d=await get('/api/v3/hashtags/'+encodeURIComponent(TAG)+'/notes?order=new&page='+page+'&paid_only=false');
  const rows=noteRows(d).map(unwrap);
  if(!rows.length) break;
  for(const n of rows){
    const key=String(n?.key||'');
    const who=username(n?.user||n?.author||{});
    if(!/^n[a-f0-9]{12}$/i.test(key)||!who||who==='ss_yr'||seenTagKeys.has(key)) continue;
    seenTagKeys.add(key);
    hashtagAuthors.add(who);
    hashtag.push({key,urlname:who,source:'hashtag'});
  }
  if(d?.is_last_page||d?.isLastPage) break;
}
if(!hashtag.length) throw new Error('ハッシュタグ記事が0件です');

// 2) Current likes from both explicit source articles. Hashtag authors win.
const people=new Map();
const likeCounts={};
for(const source of LIKE_SOURCES){
  let count=0;
  for(let page=1;page<=200;page++){
    const d=await get('/api/v3/notes/'+source+'/likes?page='+page+'&per=50');
    const likes=Array.isArray(d?.likes)?d.likes:[];
    for(const item of likes){
      const who=username(item?.user||item);
      count++;
      if(!who||who==='ss_yr'||hashtagAuthors.has(who)) continue;
      if(!people.has(who)) people.set(who,{who,sources:[]});
      const rec=people.get(who);
      if(!rec.sources.includes(source)) rec.sources.push(source);
    }
    if(likes.length<50) break;
  }
  likeCounts[source]=count;
}

// 3) Keep only the latest explicitly-added profiles that are not already covered.
for(const who of MANUAL_PROFILES){
  if(who==='ss_yr'||hashtagAuthors.has(who)) continue;
  if(!people.has(who)) people.set(who,{who,sources:['manual']});
  else if(!people.get(who).sources.includes('manual')) people.get(who).sources.push('manual');
}

// Resolve current article for every non-hashtag person.
const nonTag=[];
let done=0;
for(const rec of people.values()){
  const chosen=await chooseNonTag(rec.who);
  if(chosen) nonTag.push({...chosen,sources:rec.sources});
  done++;
  if(done%20===0) console.log('resolved',done,'/',people.size);
  await sleep(100);
}
// Stable latest rule groups: today/yesterday -> fixed -> latest fallback.
const rank={todayYesterday:0,fixedFallback:1,latestFallback:2};
nonTag.sort((a,b)=>(rank[a.source]??9)-(rank[b.source]??9));

// Verify hashtag article ownership without collapsing duplicate authors.
const rows=[];
for(let i=0;i<hashtag.length;i++){
  const verified=await detail(hashtag[i].key);
  if(verified.urlname!==hashtag[i].urlname) throw new Error('タグ投稿者不一致 '+hashtag[i].key);
  rows.push({...verified,source:'hashtag'});
  if((i+1)%20===0) console.log('hashtag verified',i+1,'/',hashtag.length);
  await sleep(80);
}

const usedNonTag=new Set();
for(const row of nonTag){
  if(hashtagAuthors.has(row.urlname)||usedNonTag.has(row.urlname)) continue;
  usedNonTag.add(row.urlname);
  rows.push(row);
}

const final=await detail(FINAL.key);
if(final.urlname!==FINAL.urlname) throw new Error('実績の算数の投稿者不一致');
rows.push({...final,source:'final',finalMarker:true});

const urls=rows.map(r=>'https://note.com/'+r.urlname+'/n/'+r.key);
if(new Set(urls).size!==urls.length) throw new Error('記事URL重複あり');
if(urls.at(-1)!=='https://note.com/fuku444/n/nb4f6934381e9') throw new Error('末尾確認記事不一致');

await fs.writeFile(OUT_URLS,urls.join('\n')+'\n');
const meta={
  format:'mumei-live-batch-v2',
  generatedAt:new Date().toISOString(),
  jstDate:TODAY,
  rules:{
    hashtag:'all-current-articles-first',
    likes:'two-source-articles-current',
    dedupe:'non-hashtag-person-dedupe-and-hashtag-author-wins',
    articleChoice:'today/yesterday newest -> pinned -> latest',
    manualProfiles:'append-to-current-set-before-final',
    final:'https://note.com/fuku444/n/nb4f6934381e9'
  },
  tag:TAG,
  tagArticles:hashtag.length,
  likeSources:LIKE_SOURCES.map(key=>'https://note.com/ss_yr/n/'+key),
  likeCounts,
  manualProfiles:MANUAL_PROFILES,
  count:rows.length,
  rows:rows.map((r,i)=>({
    index:i+1,
    urlname:r.urlname,
    key:r.key,
    creator:r.creator,
    title:r.title,
    source:r.source,
    publishAt:r.publishAt||'',
    actorImageUrl:r.actorImageUrl||'',
    thumbUrl:r.thumbUrl||'',
    sources:r.sources||[],
    url:urls[i],
    finalMarker:!!r.finalMarker
  }))
};
await fs.writeFile(OUT_META,JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({count:rows.length,tagArticles:hashtag.length,likeCounts,manualProfiles:MANUAL_PROFILES.length,last:urls.at(-1)}));
