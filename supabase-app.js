/* PlayHub cloud bridge with explicit online/offline mode.
 * IMPORTANT: offline mode disables CLOUD AUTH and CLOUD UPLOADS, not browser/security protections.
 * Local games can still be played and local-only uploads can continue through app.js.
 */
(function(){
  const cloud=window.PlayHubCloud;
  if(!cloud) return;

  window.playHubOnline = navigator.onLine;
  window.playHubCloudReady = cloud.configured();
  window.currentUser = null;
  window.playHubCloudMode = false;

  function offline(){ return !navigator.onLine; }
  function cloudAvailable(){ return !offline() && cloud.configured(); }
  function setStatus(){
    const on=cloudAvailable();
    window.playHubCloudMode=on;
    document.documentElement.classList.toggle('offline-mode',!on);
    const b=document.getElementById('profileButton');
    const a=document.getElementById('adminButton');
    if(a)a.classList.toggle('hidden',!window.playHubIsOwner || !on);
    const h=document.getElementById('heroSignIn');
    if(b && !window.currentUser) b.textContent=on?'Sign in':'Offline mode';
    if(h && !window.currentUser) h.textContent=on?'Sign in':'Offline mode';
    const n=document.getElementById('cloudStatus');
    if(n){n.textContent=on?'☁ Cloud connected':'⌁ Offline — cloud account paused';n.className=on?'cloud-online':'cloud-offline';}
  }
  window.playHubCloudAvailable=cloudAvailable;

  function requireOnline(action){
    if(!navigator.onLine){showToast('You are offline. Cloud sign-in and cloud uploads are paused until internet returns.');return false;}
    if(!cloud.configured()){showToast('Cloud account is not configured yet.');return false;}
    return true;
  }

  window.openSignIn=function(){
    if(!requireOnline('sign in')) return;
    if(window.setAuthMode) window.setAuthMode('signin');
    document.getElementById('signModal').classList.remove('hidden');
  };
  window.openUpload=function(){
    if(window.currentUser && cloudAvailable()){
      document.getElementById('uploadModal').classList.remove('hidden');
      return;
    }
    if(!navigator.onLine){showToast('Offline mode: cloud upload is paused. You can still play local games.');return;}
    window.openSignIn();showToast('Sign in to upload games to your cloud library.');
  };

  window.submitAuth=async function(e){
    e.preventDefault();
    if(!requireOnline('sign in')) return;
    const name=document.getElementById('authName').value.trim();
    const email=document.getElementById('authEmail').value.trim();
    const password=document.getElementById('authPassword').value;
    if(!email||password.length<8){showToast('Use a valid email and an 8+ character password.');return;}
    try{
      const mode=window.authMode||'signin';
      const result=mode==='signup'?await cloud.signUp(email,password,name):await cloud.signIn(email,password);
      if(mode==='signup' && !result?.access_token){showToast('Account created. Check your email to verify it, then sign in.');return;}
      await refreshCloudUser(); try{await cloud.logEvent('sign_in',null,null,{method:'password'});}catch(err){console.warn('activity log failed',err)} closeModal('signModal');showToast('Signed in securely to your cloud account.');
    }catch(err){showToast(err.message||'Authentication failed.');}
  };

  window.signOut=async function(){
    try{await cloud.signOut();}catch(e){console.warn(e)}
    window.currentUser=null;window.playHubIsOwner=false;window.playHubCloudMode=false;
    if(window.updateProfileUI)window.updateProfileUI();
    setStatus();showToast('Signed out securely.');
  };

  async function refreshCloudUser(){
    if(!cloudAvailable()){window.currentUser=null;window.playHubIsOwner=false;setStatus();return;}
    try{window.currentUser=await cloud.user();window.playHubIsOwner=await cloud.isOwner();}catch(e){window.currentUser=null;console.warn(e)}
    if(window.updateProfileUI)window.updateProfileUI();setStatus();
  }

  window.showAdminNotice=function(){
    if(!window.playHubIsOwner){showToast('Owner access required.');return;}
    document.getElementById('home')?.classList.add('hidden');
    document.getElementById('player')?.classList.add('hidden');
    document.getElementById('activityPanel')?.classList.add('hidden');
    document.getElementById('adminPanel')?.classList.remove('hidden');
    const n=document.getElementById('adminStatus');
    if(n)n.innerHTML='<div class=\"form-note\"><b>Owner mode is active.</b><br>Use the ✎ and 🗑 controls on games. Supabase RLS is the final authority, so changing the browser code cannot grant another account permission.</div>';
  };

  window.resetPlayHubPassword=async function(){
    if(!requireOnline('password reset'))return;
    const email=document.getElementById('authEmail').value.trim();
    if(!email){showToast('Enter your email first.');return;}
    try{
      const r=await fetch(window.PLAYHUB_SUPABASE.url.replace(/\/$/,'')+'/auth/v1/recover',{method:'POST',headers:{apikey:window.PLAYHUB_SUPABASE.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,redirect_to:location.origin+location.pathname})});
      if(!r.ok)throw new Error(await r.text());showToast('Password reset email sent.');
    }catch(e){showToast(e.message||'Could not send reset email.');}
  };

  async function refreshGameNameOverrides(){
    if(!cloudAvailable()) return;
    try{
      const rows=await cloud.listNameOverrides();
      const map=Object.fromEntries((rows||[]).map(x=>[x.game_id,x.name]));
      window.playHubNameOverrides=map;
      GAMES.forEach(g=>{if(map[g.id])g.name=map[g.id];});
      (window.localGames||[]).forEach(g=>{if(map[g.id])g.name=map[g.id];});
      if(window.renderGames)window.renderGames();
    }catch(e){console.warn('Game names unavailable',e)}
  }
  window.refreshGameNameOverrides=refreshGameNameOverrides;

  async function applyCatalogControls(){
    if(!cloudAvailable()) return;
    try{
      const rows=await cloud.listCatalogControls();
      const map=Object.fromEntries((rows||[]).map(r=>[r.game_id,r]));
      window.playHubCatalogControls=map;
      for(const g of GAMES){
        const c=map[g.id];
        if(!c) continue;
        g.available=!c.deleted;
        if(c.name)g.name=c.name;
        if(c.description)g.description=c.description;
        if(c.category)g.category=c.category;
        if(c.emoji)g.emoji=c.emoji;
        if(c.tags!=null)g.tags=c.tags;
      }
      if(window.renderGames)window.renderGames();
    }catch(e){console.warn('Game catalog controls unavailable',e)}
  }
  window.applyCatalogControls=applyCatalogControls;

  async function loadCloudGames(){
    if(!cloudAvailable()||!window.currentUser)return;
    try{
      const data=await cloud.listGames();
      const cloudGames=(data||[]).map(g=>({...g,available:true,popular:60,badge:'Community',url:cloud.publicUrl(g.storage_path),cloud:true,owner:g.owner_id}));
      window.localGames=(window.localGames||[]).filter(g=>!g.cloud);
      window.localGames.push(...cloudGames);
      if(window.renderGames)window.renderGames();
    }catch(e){console.warn('Cloud games unavailable',e)}
  }

  window.loadCloudGames=loadCloudGames;

  window.submitUpload=async function(e){
    e.preventDefault();
    if(!requireOnline('upload'))return;
    const f=window.__selectedGameFile;
    if(!f||!window.currentUser){showToast('Choose a file and sign in first.');return;}
    if(f.size>8*1024*1024){showToast('Maximum upload size is 8 MB.');return;}
    const name=document.getElementById('gameName').value.trim(),desc=document.getElementById('gameDescription').value.trim(),category=document.getElementById('gameCategory').value,emoji=document.getElementById('gameEmoji').value.trim()||'🎮',tags=document.getElementById('gameTags').value.trim();
    if(!name||!desc){showToast('Please complete the game details.');return;}
    try{
      const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=window.currentUser.id+'/'+crypto.randomUUID()+'-'+safe;
      await cloud.uploadHtml(path,f);
      try{
        await cloud.insertGame(window.currentUser.id,{owner_id:window.currentUser.id,name,description:desc,category,emoji,tags,storage_path:path,file_size:f.size});
      }catch(err){await cloud.removeHtml(path);throw err;}
      try{await cloud.logEvent('upload',null,name,{category,file_size:f.size});}catch(err){console.warn('activity log failed',err)} closeModal('uploadModal');e.target.reset();window.__selectedGameFile=null;document.getElementById('fileName').textContent='No file selected';await loadCloudGames();showToast('Game uploaded securely to your cloud library.');
    }catch(err){showToast(err.message||'Cloud upload failed.');}
  };


  window.editCloudGame=async function(id){
    if(!window.playHubIsOwner||!cloudAvailable()){showToast('Permission denied.');return;}
    const g=(window.localGames||[]).find(x=>x.id===id&&x.cloud); if(!g)return;
    const name=prompt('Game name',g.name); if(name===null)return;
    const desc=prompt('Description',g.description||''); if(desc===null)return;
    try{await cloud.updateGame(id,{name:name.trim().slice(0,80),description:desc.trim().slice(0,500)});await loadCloudGames();showToast('Game updated.');}
    catch(e){showToast(e.message||'Could not update game.');}
  };
  window.removeCloudGame=async function(id){
    if(!window.playHubIsOwner||!cloudAvailable()){showToast('Permission denied.');return;}
    const g=(window.localGames||[]).find(x=>x.id===id&&x.cloud); if(!g)return;
    if(!confirm('Remove this game?'))return;
    try{await cloud.deleteGame(id);await cloud.removeHtml(g.storage_path);await loadCloudGames();showToast('Game removed.');}
    catch(e){showToast(e.message||'Could not remove game.');}
  };
  function handleConnectivity(){
    window.playHubOnline=navigator.onLine;setStatus();
    if(navigator.onLine){showToast('Internet restored — cloud sign-in and security are enabled.');refreshCloudUser().then(async()=>{await refreshGameNameOverrides();await applyCatalogControls();await loadCloudGames();});}
    else{window.currentUser=null;window.playHubIsOwner=false;window.playHubCloudMode=false;if(window.updateProfileUI)window.updateProfileUI();showToast('Offline mode enabled — cloud account features are paused.');}
  }
  window.addEventListener('online',handleConnectivity);
  window.addEventListener('offline',handleConnectivity);
  window.addEventListener('pageshow',()=>{window.playHubOnline=navigator.onLine;setStatus();});
  setStatus();
  if(navigator.onLine)refreshCloudUser().then(async()=>{await refreshGameNameOverrides();await applyCatalogControls();await loadCloudGames();});
})();
