const API={
  channels:"https://iptv-org.github.io/api/channels.json",
  streams:"https://iptv-org.github.io/api/streams.json",
  logos:"https://iptv-org.github.io/api/logos.json",
  countries:"https://iptv-org.github.io/api/countries.json",
  categories:"https://iptv-org.github.io/api/categories.json",
  languages:"https://iptv-org.github.io/api/languages.json",
  allPlaylist:"https://iptv-org.github.io/iptv/index.m3u"
};

const state={channels:[],filtered:[],page:1,pageSize:60,view:"all",favorites:new Set(JSON.parse(localStorage.getItem("btech-favorites")||"[]")),hls:null,current:null,cache:null};

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2500)}
function saveFav(){localStorage.setItem("btech-favorites",JSON.stringify([...state.favorites]));$("favStat").textContent=state.favorites.size}
function countryName(code){return state.cache?.countriesByCode?.[code]?.name||code||"Unknown"}
function langName(code){return state.cache?.languagesByCode?.[code]?.name||code||"Unknown"}

async function fetchJSON(url){
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function mergeData(channels,streams,logos){
  const logoMap=new Map();
  for(const l of logos||[]) if(l.channel && l.url && !logoMap.has(l.channel)) logoMap.set(l.channel,l.url);
  const streamMap=new Map();
  for(const s of streams||[]){
    if(!s.channel||!s.url) continue;
    if(!streamMap.has(s.channel)) streamMap.set(s.channel,[]);
    streamMap.get(s.channel).push(s);
  }
  return channels.filter(c=>!c.closed).map(c=>{
    const ss=streamMap.get(c.id)||[];
    const s=ss[0]||{};
    return {
      id:c.id,name:c.name,country:c.country||"",categories:c.categories||[],
      logo:logoMap.get(c.id)||"",quality:s.quality||"",stream:s.url||"",
      labels:s.labels||[],feed:s.feed||"",language:(s.lang||c.language||"")
    };
  }).filter(c=>c.stream);
}

function populateFilters(){
  const countries=[...new Set(state.channels.map(c=>c.country).filter(Boolean))].sort();
  const cats=[...new Set(state.channels.flatMap(c=>c.categories||[]).filter(Boolean))].sort();
  const langs=[...new Set(state.channels.map(c=>c.language).filter(Boolean))].sort();
  const add=(id,items,labelFn)=>{const el=$(id);el.innerHTML=`<option value="">All ${labelFn==="country"?"countries":labelFn==="category"?"categories":"languages"}</option>`+items.map(x=>`<option value="${esc(x)}">${esc(labelFn==="country"?countryName(x):labelFn==="language"?langName(x):x)}</option>`).join("")};
  add("countryFilter",countries,"country");add("categoryFilter",cats,"category");add("languageFilter",langs,"language");
  $("countryList").innerHTML=countries.slice(0,35).map(x=>`<button data-country="${esc(x)}">${esc(countryName(x))}<span>${state.channels.filter(c=>c.country===x).length}</span></button>`).join("");
  $("categoryList").innerHTML=cats.slice(0,20).map(x=>`<button data-category="${esc(x)}">${esc(x)}<span>${state.channels.filter(c=>(c.categories||[]).includes(x)).length}</span></button>`).join("");
}

function qualityOK(q,target){
  if(!target)return true; const n=parseInt(q)||0;
  if(target==="4K")return /4k/i.test(q)||n>=2160;
  return n>=parseInt(target);
}
function applyFilters(){
  const q=$("search").value.trim().toLowerCase(),country=$("countryFilter").value,cat=$("categoryFilter").value,lang=$("languageFilter").value,quality=$("qualityFilter").value;
  let a=state.channels.filter(c=>
    (!q||`${c.name} ${c.id} ${countryName(c.country)} ${(c.categories||[]).join(" ")} ${langName(c.language)}`.toLowerCase().includes(q))&&
    (!country||c.country===country)&&(!cat||(c.categories||[]).includes(cat))&&(!lang||c.language===lang)&&qualityOK(c.quality,quality)
  );
  if(state.view==="favorites")a=a.filter(c=>state.favorites.has(c.id));
  state.filtered=a;state.page=1;render();
}
function render(){
  const end=state.page*state.pageSize,items=state.filtered.slice(0,end);
  $("grid").innerHTML=items.map(card).join("");
  $("visibleStat").textContent=state.filtered.length.toLocaleString();$("resultText").textContent=`${state.filtered.length.toLocaleString()} channels`;
  $("empty").hidden=items.length!==0;$("loadMore").hidden=end>=state.filtered.length||items.length===0;
}
function card(c){
  const fav=state.favorites.has(c.id),logo=c.logo?`<img loading="lazy" src="${esc(c.logo)}" alt="" onerror="this.style.display='none'">`:"";
  const meta=[countryName(c.country),c.categories?.[0]||"General",c.quality||"Live"].filter(Boolean).join(" • ");
  return `<article class="channel" data-id="${esc(c.id)}">
    <div class="thumb">${logo}<span class="quality">${esc(c.quality||"LIVE")}</span><button class="star ${fav?"on":""}" data-fav="${esc(c.id)}" title="Favorite">${fav?"★":"☆"}</button></div>
    <div class="card-body"><div class="name" title="${esc(c.name)}">${esc(c.name)}</div><div class="meta">${esc(meta)}</div><span class="badge">${c.labels?.length?esc(c.labels[0]):"PUBLIC STREAM"}</span></div>
  </article>`;
}

async function loadCatalog(){
  $("statusText").textContent="Loading public catalog...";
  try{
    const [channels,streams,logos,countries,languages]=await Promise.all([fetchJSON(API.channels),fetchJSON(API.streams),fetchJSON(API.logos),fetchJSON(API.countries),fetchJSON(API.languages)]);
    state.cache={countriesByCode:Object.fromEntries(countries.map(x=>[x.code,x])),languagesByCode:Object.fromEntries(languages.map(x=>[x.code,x]))};
    state.channels=mergeData(channels,streams,logos);
    $("totalStat").textContent=state.channels.length.toLocaleString();$("countryStat").textContent=new Set(state.channels.map(c=>c.country)).size.toLocaleString();
    populateFilters();applyFilters();$("statusText").textContent=`${state.channels.length.toLocaleString()} streams indexed`;
  }catch(e){
    $("statusText").textContent="Catalog failed to load";toast("Could not load the IPTV catalog. Use a local web server and try again.");
    console.error(e);
  }
}

function play(c){
  if(!c.stream)return toast("This channel has no stream URL.");
  state.current=c;$("nowTitle").textContent=c.name;$("nowMeta").textContent=`${countryName(c.country)} • ${c.categories?.join(", ")||"General"} • ${c.quality||"Live"}`;
  $("copyStream").disabled=false;$("playerEmpty").style.display="none";
  const video=$("video");if(state.hls){state.hls.destroy();state.hls=null}
  video.pause();video.removeAttribute("src");video.load();
  if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=c.stream;video.play().catch(()=>{})}
  else if(window.Hls&&Hls.isSupported()){state.hls=new Hls({enableWorker:true,maxBufferLength:30});state.hls.loadSource(c.stream);state.hls.attachMedia(video);state.hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}))}
  else toast("This browser does not support HLS playback.");
  window.scrollTo({top:0,behavior:"smooth"});
}
function clearPlayer(){if(state.hls){state.hls.destroy();state.hls=null}$("video").pause();$("video").removeAttribute("src");$("video").load();$("playerEmpty").style.display="grid";$("nowTitle").textContent="Select a channel";$("nowMeta").textContent="No channel selected";$("copyStream").disabled=true;state.current=null}

function downloadText(name,text){
  const blob=new Blob([text],{type:"application/x-mpegURL"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
async function downloadAll(){
  try{
    const r=await fetch(API.allPlaylist);if(!r.ok)throw new Error();
    downloadText("btech-tv-all-public-channels.m3u",await r.text());toast("All public IPTV playlist downloaded.");
  }catch(e){window.open(API.allPlaylist,"_blank");toast("Opened the official all-channel playlist instead.")}
}

document.addEventListener("click",e=>{
  const fav=e.target.closest("[data-fav]");if(fav){e.stopPropagation();const id=fav.dataset.fav;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFav();render();return}
  const cardEl=e.target.closest(".channel");if(cardEl){const c=state.channels.find(x=>x.id===cardEl.dataset.id);if(c)play(c)}
  const country=e.target.closest("[data-country]");if(country){$("countryFilter").value=country.dataset.country;applyFilters()}
  const cat=e.target.closest("[data-category]");if(cat){$("categoryFilter").value=cat.dataset.category;applyFilters()}
  const nav=e.target.closest(".nav");if(nav){document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));nav.classList.add("active");state.view=nav.dataset.view;applyFilters()}
});
["search","countryFilter","categoryFilter","languageFilter","qualityFilter"].forEach(id=>$(id).addEventListener(id==="search"?"input":"change",applyFilters));
$("loadMore").onclick=()=>{state.page++;render()};
$("reloadBtn").onclick=loadCatalog;
$("closePlayer").onclick=clearPlayer;
$("downloadBtn").onclick=downloadAll;
$("fullscreenBtn").onclick=()=>document.documentElement.requestFullscreen?.();
$("copyStream").onclick=async()=>{if(state.current){await navigator.clipboard.writeText(state.current.stream);toast("Stream URL copied.")}};
saveFav();loadCatalog();
