export {};

function activeNoteId(){
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.miu a[href*="note.com/"]')];
  for(const a of links){
    const text=String(a.textContent||'');
    const m=text.match(/@([A-Za-z0-9_-]+)/);
    if(m?.[1])return m[1].toLowerCase();
    try{const id=new URL(a.href).pathname.split('/').filter(Boolean)[0];if(id)return id.toLowerCase()}catch{}
  }
  return'';
}
function updateUrl(){
  const u=new URL('./notification-update.html',location.href),id=activeNoteId();
  u.searchParams.set('from','top');
  if(id)u.searchParams.set('account',id);
  u.searchParams.set('return',location.href);
  return u.href;
}

document.addEventListener('click',e=>{
  const t=e.target as Element|null;
  const a=t?.closest?.('.miv5-source-card.notice a.mumei-canonical-install') as HTMLAnchorElement|null;
  if(!a)return;
  e.preventDefault();e.stopPropagation();
  location.assign(updateUrl());
},true);
