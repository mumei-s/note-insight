(()=>{'use strict';
if(window.__NOTE_BOOST_TRANSPORT_V610__)return;window.__NOTE_BOOST_TRANSPORT_V610__=true;
const APP_ORIGIN=location.origin,nativeOpen=window.open.bind(window);let fake=null,lastToken='';
function emitAsNote(data){try{window.dispatchEvent(new MessageEvent('message',{data,origin:'https://note.com'}))}catch{}}
window.addEventListener('message',e=>{if(e.origin!==APP_ORIGIN)return;const m=e.data||{};if(m.type==='NOTE_BOOST_APP_READY'){lastToken=m.token||lastToken;emitAsNote({type:'NOTE_BOOST_READY',token:m.token||lastToken,version:m.version||'6.1.0'});return}if(m.type==='NOTE_BOOST_APP_RESPONSE'){emitAsNote({type:'NOTE_BOOST_RESPONSE',token:m.token||lastToken,id:m.id,ok:m.ok,data:m.data,error:m.error,status:m.status,code:m.code,limit:m.limit});}},false);
window.open=function(url,name,features){
  const s=String(url||'');
  if(/^https:\/\/note\.com\/\?/.test(s)&&s.includes('boost_app=1')){
    let token='';try{token=new URL(s).searchParams.get('boost_token')||''}catch{}lastToken=token;
    fake={closed:false,close(){this.closed=true},focus(){},postMessage(msg){const m=msg||{};window.postMessage({type:m.type==='NOTE_BOOST_REQUEST'?'NOTE_BOOST_APP_REQUEST':m.type,token:m.token||lastToken,id:m.id,action:m.action,args:m.args},APP_ORIGIN)}};
    setTimeout(()=>window.postMessage({type:'NOTE_BOOST_APP_INIT',token:lastToken},APP_ORIGIN),0);
    return fake;
  }
  return nativeOpen(url,name,features);
};
})();