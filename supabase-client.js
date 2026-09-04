/* Lightweight Supabase REST client for a static PlayHub site.
 * Uses only browser fetch; no external JS library is required.
 */
(function(){
  const cfg=window.PLAYHUB_SUPABASE||{};
  const base=(cfg.url||'').replace(/\/$/,'');
  const anon=cfg.anonKey||'';
  const tokenKey='playhub_supabase_session';
  function configured(){return /^https:\/\/[^ ]+\.supabase\.co$/.test(base)&&/^(sb_publishable_|eyJ)/.test(anon)&& !/YOUR_PROJECT_REF|YOUR_SUPABASE/.test(base+anon)}
  function session(){try{return JSON.parse(localStorage.getItem(tokenKey)||'null')}catch{return null}}
  function save(s){if(s)localStorage.setItem(tokenKey,JSON.stringify(s));else localStorage.removeItem(tokenKey)}
  async function req(path,opts={}){
    if(!configured()) throw new Error('Supabase is not configured. Edit supabase-config.js.');
    const s=session(); const headers={'apikey':anon,'Content-Type':'application/json',...(opts.headers||{})};
    if(s?.access_token)headers.Authorization='Bearer '+s.access_token;
    const r=await fetch(base+path,{...opts,headers});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){const msg=data?.msg||data?.message||data?.error_description||data?.error||text||('HTTP '+r.status); throw new Error(msg)}
    return data;
  }
  async function signUp(email,password,name){
    const data=await req('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{display_name:name}})});
    if(data?.access_token)save(data); return data;
  }
  async function signIn(email,password){const data=await req('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});save(data);return data}
  async function signOut(){try{await req('/auth/v1/logout',{method:'POST'})}catch{}save(null)}
  async function user(){const s=session();if(!s?.access_token)return null;try{return await req('/auth/v1/user')}catch{save(null);return null}}
  async function listGames(){return await req('/rest/v1/games?select=*&order=created_at.desc')}
  async function createGame(g){return await req('/rest/v1/games',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(g)})}
  async function deleteGame(id){return await req('/rest/v1/games?id=eq.'+encodeURIComponent(id),{method:'DELETE'})}
  async function updateGame(id,g){return await req('/rest/v1/games?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(g)})}
  async function isOwner(){
    try{
      const rows=await req('/rest/v1/rpc/is_playhub_owner',{method:'POST',body:'{}'});
      return rows===true || rows?.[0]===true;
    }catch{return false}
  }
  async function listCatalogControls(){return await req('/rest/v1/game_catalog_controls?select=*')}
  async function upsertCatalogControl(data){return await req('/rest/v1/game_catalog_controls',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(data)})}
  async function deleteCatalogControl(game_id){return await req('/rest/v1/game_catalog_controls?game_id=eq.'+encodeURIComponent(game_id),{method:'DELETE'})}
  async function listNameOverrides(){return await req('/rest/v1/game_name_overrides?select=game_id,name')}
  async function setNameOverride(game_id,name){return await req('/rest/v1/game_name_overrides',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({game_id,name})})}
  async function deleteNameOverride(game_id){return await req('/rest/v1/game_name_overrides?game_id=eq.'+encodeURIComponent(game_id),{method:'DELETE'})}
  async function uploadHtml(path,file){
    const s=session(); if(!s?.access_token)throw new Error('You must be signed in.');
    const r=await fetch(base+'/storage/v1/object/game-files/'+path,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+s.access_token,'Content-Type':'text/html','x-upsert':'false'},body:file});
    if(!r.ok)throw new Error(await r.text()); return r.json();
  }
  async function removeHtml(path){return await req('/storage/v1/object/game-files/'+path,{method:'DELETE'})}
  async function logEvent(event_type, game_id=null, game_name=null, metadata={}){return await req('/rest/v1/activity_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({event_type,game_id,game_name,metadata})})}
  function realtime(onEvent){
    if(!configured()) return {close(){}};
    const wsBase=base.replace(/^https:/,'wss:').replace(/^http:/,'ws:');
    const ws=new WebSocket(wsBase+'/realtime/v1/websocket?apikey='+encodeURIComponent(anon)+'&vsn=1.0.0');
    let ref=0,closed=false;
    const channel='realtime:public:activity_logs';
    const send=(payload)=>{if(ws.readyState===1)ws.send(JSON.stringify(payload))};
    ws.onopen=()=>{send({topic:'realtime:system',event:'phx_join',payload:{config:{}},ref:String(++ref)});send({topic:channel,event:'phx_join',payload:{config:{postgres_changes:[{event:'*',schema:'public',table:'activity_logs'}]},broadcast:{self:false},presence:{key:''}},ref:String(++ref)});};
    ws.onmessage=(ev)=>{try{const m=JSON.parse(ev.data);if(m.topic===channel&&m.event==='postgres_changes'&&m.payload?.data)onEvent(m.payload.data);}catch{}};
    const timer=setInterval(()=>send({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}),25000);
    return {close(){closed=true;clearInterval(timer);try{ws.close()}catch{}}};
  }
  function publicUrl(path){return base+'/storage/v1/object/public/game-files/'+path}
  window.PlayHubCloud={configured,session,signUp,signIn,signOut,user,listGames,createGame,insertGame:createGame,deleteGame,updateGame,listNameOverrides,setNameOverride,deleteNameOverride,uploadHtml,removeHtml,publicUrl,logEvent,realtime,isOwner,listCatalogControls,upsertCatalogControl,deleteCatalogControl};
})();
