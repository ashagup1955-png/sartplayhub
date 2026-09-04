/* Lightweight Supabase REST/Auth client. No third-party SDK/CDN required. */
(function(){
  const cfg=window.PLAYHUB_SUPABASE||{};
  const ready=()=>cfg.url && cfg.anonKey && !cfg.url.includes("YOUR-PROJECT") && !cfg.anonKey.includes("YOUR-PUBLISHABLE");
  const base=()=>String(cfg.url||"").replace(/\/$/,"");
  const headers=(token)=>({"apikey":cfg.anonKey,"Authorization":"Bearer "+(token||cfg.anonKey),"Content-Type":"application/json"});
  async function request(path,opts={}){
    if(!ready()) throw new Error("Supabase is not configured. Fill supabase-config.js first.");
    const r=await fetch(base()+path,{...opts,headers:{...headers(opts.token),...(opts.headers||{})}});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){const msg=data?.msg||data?.message||data?.error_description||data?.error||text||`HTTP ${r.status}`; throw new Error(msg)}
    return data;
  }
  async function auth(path,body){return request("/auth/v1"+path,{method:"POST",body:JSON.stringify(body)})}
  async function signUp(email,password,name){return auth("/signup",{email,password,data:{display_name:name}})}
  async function signIn(email,password){return auth("/token?grant_type=password",{email,password})}
  async function signOut(token){if(!token)return; await request("/auth/v1/logout",{method:"POST",token})}
  async function user(token){return request("/auth/v1/user",{method:"GET",token})}
  async function refresh(refreshToken){return auth("/token?grant_type=refresh_token",{refresh_token:refreshToken})}
  async function insertGame(token,row){return request("/rest/v1/games",{method:"POST",token,headers:{Prefer:"return=representation"},body:JSON.stringify(row)})}
  async function deleteGame(token,id){return request("/rest/v1/games?id=eq."+encodeURIComponent(id),{method:"DELETE",token})}
  async function listGames(token){return request("/rest/v1/games?select=id,name,description,category,emoji,tags,storage_path,public_url,created_at,owner_id&order=created_at.desc",{method:"GET",token})}
  async function uploadHtml(token,path,file){
    if(!ready()) throw new Error("Supabase is not configured.");
    const r=await fetch(base()+"/storage/v1/object/game-files/"+path,{method:"POST",headers:{"apikey":cfg.anonKey,"Authorization":"Bearer "+token,"Content-Type":"text/html; charset=utf-8","x-upsert":"false"},body:file});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok) throw new Error(data?.message||data?.error||text||`Storage upload failed (${r.status})`);
    return data;
  }
  function publicUrl(path){return base()+"/storage/v1/object/public/game-files/"+path}
  window.PlayHubSupabase={ready,signUp,signIn,signOut,user,refresh,insertGame,deleteGame,listGames,uploadHtml,publicUrl};
})();
