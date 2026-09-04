/* PlayHub application shell: catalog, navigation, player, offline library and graceful cloud hand-off. */
let category = "All";
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let recent = JSON.parse(localStorage.getItem("recent") || "[]");
let current = null;
const $ = id => document.getElementById(id);
let gameLoadTimer = null;

const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const escapeJS = s => String(s ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");

function combinedGames(){ return [...GAMES, ...(window.localGames || localGames)]; }

function cardHTML(g){
  const safeName = escapeHTML(g.name);
  const safeId = escapeJS(g.id);
  const action = g.available
    ? `onclick='openGameById(${JSON.stringify(g.id)})' tabindex="0" role="button"`
    : `aria-disabled="true"`;
  const admin = window.playHubIsOwner && window.playHubCloudMode && !g.local;
  const adminButtons = admin ? `<div class="admin-card-actions" onclick="event.stopPropagation()"><button type="button" onclick="openAdminEditor('${safeId}')" title="Edit game">✎</button><button type="button" onclick="adminDeleteGame('${safeId}')" title="Delete game">🗑</button></div>` : "";
  return `<article class="game ${g.available ? "" : "disabled"}" ${action} onkeydown="if(event.key==='Enter'&&${!!g.available})openGameById('${safeId}')">
    <div class="thumb" style="--c1:${g.c1 || "#6c45ff"};--c2:${g.c2 || "#36c2a1"}">${g.icon ? `<img src="${escapeHTML(g.icon)}" alt="" loading="lazy" decoding="async">` : `<span>${escapeHTML(g.emoji || "🎮")}</span>`}<div class="thumb-overlay"></div>${g.badge ? `<span class="badge">${escapeHTML(g.badge)}</span>` : ""}<button class="heart" onclick="event.stopPropagation();toggleFavorite('${escapeJS(g.name)}')" aria-label="Favorite ${safeName}">${favorites.includes(g.name) ? "♥" : "♡"}</button>${adminButtons}</div>
    <div class="info"><div><b>${safeName}</b><small>${escapeHTML(g.category)} · ${g.available ? ((g.popular ?? 50) + "% popular") : "Coming soon"}</small></div><span class="play-pill">${g.available ? "Play" : "Soon"}</span></div>
  </article>`;
}

function renderGames(){
  const all = combinedGames();
  const q = $("search").value.toLowerCase().trim();
  const sort = $("sort").value;
  let list = all.filter(g => {
    const categoryMatch = category === "All" || category === "Favorites" || g.category === category;
    const favoriteMatch = category !== "Favorites" || favorites.includes(g.name);
    const textMatch = `${g.name} ${g.category} ${g.description || ""} ${g.tags || ""}`.toLowerCase().includes(q);
    return categoryMatch && favoriteMatch && textMatch;
  });
  if(sort === "popular") list.sort((a,b)=>(b.popular ?? 50)-(a.popular ?? 50));
  if(sort === "new") list = [...list].reverse();
  if(sort === "az") list.sort((a,b)=>a.name.localeCompare(b.name));
  $("resultText").textContent = `${list.length} game${list.length === 1 ? "" : "s"} ${category === "Favorites" ? "in your favorites" : "to play"}`;
  $("gameCount").textContent = all.filter(g=>g.available).length;
  $("favCount").textContent = favorites.length ? `(${favorites.length})` : "";
  $("sectionTitle").textContent = category === "Favorites" ? "Your favorites" : category === "All" ? "Popular games" : `${category} games`;
  $("games").innerHTML = list.map(cardHTML).join("");
  $("emptyState").classList.toggle("hidden", list.length !== 0);
}

function openGameById(id){ const g = combinedGames().find(x=>x.id === id); if(g?.available) openGame(g); }
function openFeatured(){ openGameById("pixel-sandbox"); }

function openGame(g){
  current = g;
  recent = [g.name, ...recent.filter(x=>x !== g.name)].slice(0, 10);
  localStorage.setItem("recent", JSON.stringify(recent));
  try{ if(window.playHubCloudMode && window.currentUser && window.PlayHubCloud) window.PlayHubCloud.logEvent("play", g.id, g.name, {category:g.category}).catch(()=>{}); }catch{}
  $("home").classList.add("hidden");
  $("player").classList.remove("hidden");
  $("playerTitle").textContent = g.name;
  $("playerMeta").textContent = `${g.category} · ${g.description || g.badge || "Instant play"}`;
  $("frameLoading").classList.remove("hidden");
  $("demoNotice").classList.add("hidden");
  const src = g.local ? (localGameUrls.get(g.id) || "") : g.url;
  $("gameFrame").src = src || "about:blank";
  armGameLoadWatch();
  updatePlayerFav();
  window.scrollTo({top:0, behavior:"smooth"});
}

function armGameLoadWatch(){
  clearTimeout(gameLoadTimer);
  gameLoadTimer = setTimeout(() => {
    if(!current || $("frameLoading").classList.contains("hidden")) return;
    $("frameLoading").classList.add("hidden");
    $("demoNotice").textContent = "The game did not finish loading. Check your connection or tap Reload to try again.";
    $("demoNotice").classList.remove("hidden");
  }, 12000);
}
$("gameFrame").addEventListener("load", () => {
  clearTimeout(gameLoadTimer);
  $("frameLoading").classList.add("hidden");
  $("demoNotice").classList.add("hidden");
});

function reloadGame(){
  if(!current) return;
  clearTimeout(gameLoadTimer);
  $("frameLoading").classList.remove("hidden");
  $("demoNotice").classList.add("hidden");
  $("gameFrame").src = "about:blank";
  setTimeout(() => {
    if(!current) return;
    const src = current.local ? (localGameUrls.get(current.id) || "") : current.url;
    $("gameFrame").src = src || "about:blank";
    armGameLoadWatch();
  }, 40);
}

async function fullscreenGame(){
  const target = $("gameFrame");
  const doc = document;
  try{
    if(doc.fullscreenElement || doc.webkitFullscreenElement){
      await (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      return;
    }
    if(target.requestFullscreen) await target.requestFullscreen();
    else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    try{ await screen.orientation?.lock?.("landscape"); }catch{}
  }catch{ showToast("Fullscreen is not available in this browser."); }
}

function setCategory(c, el){
  category = c;
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  if(el) el.classList.add("active");
  renderGames();
  if(innerWidth < 701) toggleMenu();
  scrollToGames();
}
function toggleFavorite(name){
  favorites = favorites.includes(name) ? favorites.filter(x=>x !== name) : [...favorites, name];
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderGames();
  updatePlayerFav();
}
function updatePlayerFav(){ if(current) $("playerFav").textContent = favorites.includes(current.name) ? "♥" : "♡"; }
function toggleCurrentFavorite(){ if(current) toggleFavorite(current.name); }
function showHome(){
  clearTimeout(gameLoadTimer);
  $("player").classList.add("hidden");
  $("home").classList.remove("hidden");
  $("gameFrame").src = "about:blank";
  $("demoNotice").classList.add("hidden");
  current = null;
  window.scrollTo({top:0, behavior:"smooth"});
}
function scrollToGames(){ $("gamesSection").scrollIntoView({behavior:"smooth", block:"start"}); }
function clearFilters(){
  $("search").value = "";
  category = "All";
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active", x.dataset.cat === "All"));
  renderGames();
}
function toggleTheme(){
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("dark", dark);
  const b = document.querySelector(".icon-btn");
  if(b) b.setAttribute("aria-pressed", String(dark));
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function toggleMenu(){ document.querySelector("nav").classList.toggle("open"); }

if(localStorage.getItem("dark") === "true") document.body.classList.add("dark");

// Local community game library: uploaded HTML is stored on this device only.
const LOCAL_DB_NAME = "PlayHubLocalLibrary";
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE = "games";
let localGames = [];
window.localGames = localGames;
let localGameUrls = new Map();
let currentUser = window.currentUser || JSON.parse(localStorage.getItem("playhubUser") || "null");
window.currentUser = currentUser;
let authMode = "signin";

function activeUser(){ return window.currentUser || currentUser || null; }
function cloudReady(){ try{ return !!window.playHubCloudAvailable?.() && !!window.PlayHubCloud?.configured?.(); }catch{ return false; } }

function openLocalDB(){
  return new Promise((resolve,reject)=>{
    const r = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    r.onupgradeneeded = () => { if(!r.result.objectStoreNames.contains(LOCAL_STORE)) r.result.createObjectStore(LOCAL_STORE,{keyPath:"id"}); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function getLocalGames(){
  try{
    const db = await openLocalDB();
    return await new Promise((resolve,reject)=>{
      const q = db.transaction(LOCAL_STORE,"readonly").objectStore(LOCAL_STORE).getAll();
      q.onsuccess = () => resolve(q.result || []); q.onerror = () => reject(q.error);
    });
  }catch(e){ console.warn("Local library unavailable",e); return []; }
}
async function saveLocalGame(g){
  const db=await openLocalDB();
  return new Promise((resolve,reject)=>{const q=db.transaction(LOCAL_STORE,"readwrite").objectStore(LOCAL_STORE).put(g);q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error);});
}
async function deleteLocalGame(id){
  const db=await openLocalDB();
  return new Promise((resolve,reject)=>{const q=db.transaction(LOCAL_STORE,"readwrite").objectStore(LOCAL_STORE).delete(id);q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error);});
}
async function refreshLocalGames(){
  localGames = await getLocalGames();
  window.localGames = localGames;
  for(const g of localGames){
    if(g.html && !localGameUrls.has(g.id)) localGameUrls.set(g.id, URL.createObjectURL(new Blob([g.html],{type:"text/html"})));
  }
  renderGames();
}

function closeModal(id){ $(id).classList.add("hidden"); }
function openSignIn(){ $("signModal").classList.remove("hidden"); setAuthMode(authMode); setTimeout(()=>$("authEmail").focus(),50); }
function openUpload(){
  if(cloudReady()){
    if(!activeUser()){ openSignIn(); showToast("Sign in to upload games to your cloud library."); return; }
  }else if(!activeUser()){
    openSignIn(); showToast("Create a local profile first to use local uploads."); return;
  }
  $("uploadModal").classList.remove("hidden");
  setTimeout(()=>$("gameName").focus(),50);
}
function setAuthMode(mode){
  authMode = mode;
  $("signInTab").classList.toggle("active", mode === "signin");
  $("signUpTab").classList.toggle("active", mode === "signup");
  $("authSubmit").textContent = mode === "signin" ? "Sign in" : "Create profile";
  $("authNote").textContent = cloudReady() ? "Cloud account: email verification and password recovery are handled by Supabase." : "Offline profile: your account credentials stay in this browser.";
}
function updateProfileUI(){
  const b=$("profileButton"), h=$("heroSignIn"), u=activeUser();
  if(u){ b.textContent=`👤 ${u.name || u.email || "Player"}`; h.textContent="Upload a game"; h.onclick=openUpload; }
  else { b.textContent=cloudReady()?"Sign in":"Offline mode"; h.textContent=cloudReady()?"Sign in":"Create local profile"; h.onclick=openSignIn; }
}

async function hashSecret(secret,salt){
  const data = new TextEncoder().encode(`${salt}:${secret}`);
  const buf = await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function submitAuth(e){
  e.preventDefault();
  const name=$("authName").value.trim(), email=$("authEmail").value.trim().toLowerCase(), password=$("authPassword").value;
  if(!email || password.length < 8){ showToast("Use a valid email and an 8+ character password."); return; }
  if(cloudReady()){
    try{
      const result = authMode === "signup" ? await window.PlayHubCloud.signUp(email,password,name) : await window.PlayHubCloud.signIn(email,password);
      if(authMode === "signup" && !result?.access_token){ showToast("Account created. Check your email to verify it, then sign in."); return; }
      window.currentUser = await window.PlayHubCloud.user();
      currentUser = window.currentUser;
      updateProfileUI(); closeModal("signModal");
      try{ await window.PlayHubCloud.logEvent("sign_in",null,null,{method:"password"}); }catch{}
      showToast("Signed in securely to your cloud account.");
    }catch(err){ showToast(err.message || "Authentication failed."); }
    return;
  }
  const existing = JSON.parse(localStorage.getItem("playhubProfiles") || "{}");
  if(authMode === "signin"){
    const rec=existing[email]; let ok=false;
    if(rec?.passwordHash) ok=(await hashSecret(password,rec.salt))===rec.passwordHash;
    else if(rec?.password){
      ok=rec.password===password;
      if(ok){ rec.salt=crypto.randomUUID(); rec.passwordHash=await hashSecret(password,rec.salt); delete rec.password; existing[email]=rec; localStorage.setItem("playhubProfiles",JSON.stringify(existing)); }
    }
    if(!ok){ showToast("Profile not found or password is incorrect."); return; }
    currentUser={name:rec.name || email,email};
  }else{
    if(existing[email]){ showToast("That email already has a local profile."); return; }
    const salt=crypto.randomUUID();
    existing[email]={name,email,salt,passwordHash:await hashSecret(password,salt)};
    localStorage.setItem("playhubProfiles",JSON.stringify(existing));
    currentUser={name,email};
  }
  window.currentUser=currentUser;
  localStorage.setItem("playhubUser",JSON.stringify(currentUser));
  updateProfileUI(); closeModal("signModal"); showToast(authMode === "signin" ? "Signed in offline" : "Offline profile created");
}

async function signOut(){
  if(cloudReady() && window.currentUser?.id){ try{ await window.PlayHubCloud.signOut(); }catch{} }
  currentUser=null; window.currentUser=null; window.playHubIsOwner=false;
  localStorage.removeItem("playhubUser"); updateProfileUI(); showToast("Signed out");
}

window.renamePlayHubGame = async function(id){
  if(!window.playHubIsOwner || !window.playHubCloudAvailable?.()){ showToast("Permission denied."); return; }
  const g=combinedGames().find(x=>x.id===id); if(!g) return;
  const name=prompt("Game name",g.name); if(name===null) return;
  const next=name.trim().slice(0,80); if(!next){ showToast("Game name cannot be empty."); return; }
  try{ await window.PlayHubCloud.setNameOverride(id,next); await window.refreshGameNameOverrides?.(); showToast("Game renamed."); }
  catch(e){ showToast(e.message || "Could not rename game."); }
};

window.openAdminEditor = async function(id){
  if(!window.playHubIsOwner || !window.playHubCloudMode){ showToast("Owner access required."); return; }
  const g=combinedGames().find(x=>x.id===id); if(!g) return;
  const name=prompt("Game name",g.name); if(name===null)return;
  const desc=prompt("Description",g.description||""); if(desc===null)return;
  const category=prompt("Category",g.category||"Arcade"); if(category===null)return;
  const tags=prompt("Tags",g.tags||""); if(tags===null)return;
  try{
    if(g.cloud){
      await window.PlayHubCloud.updateGame(id,{name:name.trim().slice(0,80),description:desc.trim().slice(0,500),category:category.trim().slice(0,40),tags:tags.trim().slice(0,100)});
    }else{
      await window.PlayHubCloud.upsertCatalogControl({game_id:id,deleted:false,name:name.trim().slice(0,80),description:desc.trim().slice(0,500),category:category.trim().slice(0,40),tags:tags.trim().slice(0,100),updated_by:window.currentUser.id});
    }
    await window.applyCatalogControls?.(); await window.loadCloudGames?.(); renderGames(); showToast("Game updated.");
  }catch(e){showToast(e.message||"Could not update game.");}
};

window.adminDeleteGame = async function(id){
  if(!window.playHubIsOwner || !window.playHubCloudMode){ showToast("Owner access required."); return; }
  const g=combinedGames().find(x=>x.id===id); if(!g) return;
  if(!confirm(`Delete “${g.name}”?`))return;
  try{
    if(g.cloud){
      await window.PlayHubCloud.deleteGame(id);
      if(g.storage_path) await window.PlayHubCloud.removeHtml(g.storage_path);
    }else{
      await window.PlayHubCloud.upsertCatalogControl({game_id:id,deleted:true,updated_by:window.currentUser.id});
    }
    await window.applyCatalogControls?.(); await window.loadCloudGames?.(); renderGames(); showToast("Game deleted.");
  }catch(e){showToast(e.message||"Could not delete game.");}
};

function showToast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),2600);
}
function selectGameFile(file){
  if(!file) return;
  if(!/\.html?$/i.test(file.name)){ showToast("Please choose a single .html or .htm file."); return; }
  if(file.size > 8*1024*1024){ showToast("For offline reliability, keep the HTML file under 8 MB."); return; }
  $("fileName").textContent=`${file.name} · ${(file.size/1024).toFixed(0)} KB`;
  window.__selectedGameFile=file;
}
$("gameFile")?.addEventListener("change",e=>selectGameFile(e.target.files[0]));
$("dropzone")?.addEventListener("dragover",e=>{e.preventDefault();$("dropzone").classList.add("drag")});
$("dropzone")?.addEventListener("dragleave",()=>$("dropzone").classList.remove("drag"));
$("dropzone")?.addEventListener("drop",e=>{e.preventDefault();$("dropzone").classList.remove("drag");selectGameFile(e.dataTransfer.files[0]);});

async function submitUpload(e){
  e.preventDefault();
  const f=window.__selectedGameFile;
  const u=activeUser();
  if(!f || !u){ showToast("Choose a file and sign in first."); return; }
  if(f.size > 8*1024*1024){ showToast("Maximum upload size is 8 MB."); return; }
  const name=$("gameName").value.trim(), desc=$("gameDescription").value.trim(), cat=$("gameCategory").value, emoji=$("gameEmoji").value.trim() || "🎮", tags=$("gameTags").value.trim();
  if(!name || !desc){ showToast("Please complete the game details."); return; }

  if(cloudReady()){
    try{
      const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=`${u.id}/${crypto.randomUUID()}-${safe}`;
      await window.PlayHubCloud.uploadHtml(path,f);
      try{ await window.PlayHubCloud.insertGame(u.id,{owner_id:u.id,name,description:desc,category:cat,emoji,tags,storage_path:path,file_size:f.size}); }
      catch(err){ try{ await window.PlayHubCloud.removeHtml(path); }catch{} throw err; }
      try{ await window.PlayHubCloud.logEvent("upload",null,name,{category:cat,file_size:f.size}); }catch{}
      closeModal("uploadModal"); e.target.reset(); window.__selectedGameFile=null; $("fileName").textContent="No file selected";
      await window.loadCloudGames?.(); showToast("Game uploaded securely to your cloud library.");
    }catch(err){ showToast(err.message || "Cloud upload failed."); }
    return;
  }

  const html=await f.text();
  if(!/<html|<canvas|<body/i.test(html)){ showToast("That does not look like a playable HTML file."); return; }
  const id=`user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const g={id,name,description:desc,category:cat,emoji,c1:"#6c45ff",c2:"#36c2a1",popular:60,available:true,badge:"Your game",url:"",local:true,owner:u.email||"local",tags,html,created:Date.now()};
  try{
    await saveLocalGame(g);
    localGameUrls.set(id,URL.createObjectURL(new Blob([html],{type:"text/html"})));
    await refreshLocalGames();
    closeModal("uploadModal"); e.target.reset(); window.__selectedGameFile=null; $("fileName").textContent="No file selected";
    showToast("Game added to your offline library!");
  }catch(err){ showToast(err.message || "Could not save the game locally."); }
}

async function removeUploadedGame(id){
  const g=(window.localGames||[]).find(x=>x.id===id && x.local); if(!g) return;
  if(!confirm(`Remove “${g.name}” from this device?`)) return;
  if(localGameUrls.has(id)){ URL.revokeObjectURL(localGameUrls.get(id)); localGameUrls.delete(id); }
  await deleteLocalGame(id); await refreshLocalGames(); showToast("Game removed from this device");
}

// Keep keyboard behavior safe and predictable.
window.addEventListener("keydown",e=>{
  if(e.key === "Escape"){
    if(current) showHome();
    closeModal("uploadModal"); closeModal("signModal");
  }
  if(e.key === "/" && !document.activeElement?.closest?.("input,textarea,select")){ e.preventDefault(); $("search").focus(); }
});

// Resilience + PWA support. Heavy game assets are runtime-cached only when actually requested.
(function(){
  const n=$("networkStatus");
  function status(){
    if(!n) return;
    const off=!navigator.onLine;
    n.textContent=off ? "Offline mode — local games still work" : "Online";
    n.classList.toggle("offline",off); n.classList.add("show");
    clearTimeout(window.__phNetTimer); window.__phNetTimer=setTimeout(()=>n.classList.remove("show"),1800);
  }
  window.addEventListener("online",status); window.addEventListener("offline",status);
  if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
  status();
})();

updateProfileUI();
refreshLocalGames();
renderGames();
