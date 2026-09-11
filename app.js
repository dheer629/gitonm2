
(()=>{"use strict";
const D=window.ENCYCLOPEDIA;
const H=window.COMMAND_HELP_DATA||{commands:{},coverage:{},trees:{},riskLabels:{},flagGlossary:{generic:{},tools:{}},placeholderGlossary:{}};
const PM=window.PLATFORM_MATRIX||{platforms:[],tasks:[]};
const store={
 get(k,f=null){try{const v=window.localStorage.getItem(k);return v===null?f:v}catch{return f}},
 set(k,v){try{window.localStorage.setItem(k,v)}catch{}}
};
function storedJSON(k,fallback){try{return JSON.parse(store.get(k,""))??fallback}catch{return fallback}}
const S={current:0,domain:"All",mode:"library",theme:store.get("oe-light-theme","arctic")||"arctic"};
const $=s=>document.querySelector(s);
const nav=$("#nav"),panel=$("#panel"),toc=$("#toc"),q=$("#q"),summary=$("#summary"),toast=$("#toast");
let favs=new Set(storedJSON("oe-favs",[]));
let hist=storedJSON("oe-history",[]);
let commandUsage=storedJSON("oe-command-usage",{});
function recordCommandUsage(id,action){if(!id)return;const u=commandUsage[id]||{copies:0,help:0,build:0,last:null};if(action==="copy")u.copies++;else if(action==="help")u.help++;else if(action==="build")u.build++;u.last=new Date().toISOString();commandUsage[id]=u;store.set("oe-command-usage",JSON.stringify(commandUsage))}
function commandUsageScore(id){const u=commandUsage[id]||{};return (u.copies||0)*4+(u.help||0)*2+(u.build||0)}
function commandUsageLabel(id){const u=commandUsage[id]||{};const total=(u.copies||0)+(u.help||0)+(u.build||0);return total?`${total} local action${total===1?"":"s"}`:"Not used locally yet"}
document.documentElement.dataset.theme=S.theme;
document.documentElement.dataset.density=store.get("oe-density","comfortable")||"comfortable";


/* Engineering Workspace state */
const WORKSPACE_UI_VERSION=6;
const W_DEFAULT={left:330,right:420,leftCollapsed:false,rightCollapsed:true,contextMode:"overview",contextPinned:false,preset:"command",treeMode:"commands",wrap:"auto",codeFont:15,moduleEdit:false,uiVersion:WORKSPACE_UI_VERSION};
const savedWorkspace=storedJSON("oe-workspace",{});
const W=Object.assign({},W_DEFAULT,savedWorkspace);
if(savedWorkspace.uiVersion!==WORKSPACE_UI_VERSION)Object.assign(W,W_DEFAULT);
W.uiVersion=WORKSPACE_UI_VERSION;
let treeExpanded=new Set(storedJSON("oe-tree-expanded",[]));
let treeFilterText="";
let activeContextBuilderId=null;
const DASH_MODULE_IDS=["tools","runbooks","risk","sentinel","libraries","help","tips","platform-matrix"];
const savedDashboard=storedJSON("oe-dashboard-layout",{});
let dashboardPrefs=savedWorkspace.uiVersion===WORKSPACE_UI_VERSION?Object.assign({order:DASH_MODULE_IDS.slice(),hidden:[],sizes:{}},savedDashboard):{order:DASH_MODULE_IDS.slice(),hidden:[],sizes:{}};
function saveWorkspace(){store.set("oe-workspace",JSON.stringify(W))}
function saveTreeExpansion(){store.set("oe-tree-expanded",JSON.stringify([...treeExpanded]))}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function macroDomain(cat){
 const c=String(cat||"");
 if(/^(AI|Python)/.test(c))return "AI, ML & Python";
 if(/^(Data|Databases|Messaging)/.test(c))return "Data, Databases & Messaging";
 if(/^(Cybersecurity|Security|Runtime Security|Supply Chain Security|Secrets)/.test(c)||/Security/.test(c))return "Security & Compliance";
 if(/^(Linux|Legacy Enterprise Unix|Enterprise Unix)/.test(c))return "Linux & Unix";
 if(/^(Containers|Container Runtime|Container Registries)/.test(c))return "Containers & Images";
 if(/^(Kubernetes|Local Kubernetes|OpenShift|Cloud Native \/ Cluster Lifecycle|Cluster Lifecycle)/.test(c))return "Kubernetes & Cluster Platforms";
 if(/^(GitOps|CI\/CD|Progressive Delivery|Source Control)/.test(c))return "GitOps, Delivery & Source Control";
 if(/^(Cloud|Infrastructure as Code|Platform Engineering|Serverless)/.test(c))return "Cloud & Platform Engineering";
 if(/^(Networking|Service Mesh|Cloud Native \/ Networking)/.test(c))return "Networking & Service Mesh";
 if(/^(Observability|Linux \/ Logging)/.test(c))return "Observability & Diagnostics";
 if(/^(Storage|Backup|Legacy Enterprise Storage|Legacy Virtualization|Virtualization)/.test(c))return "Storage, Backup & Infrastructure";
 if(/^(Automation|Build Tools|Developer Utilities|Package Management|Runtime \/ JVM)/.test(c))return "Automation, Build & Runtime";
 if(/^DEVOPS SENTINEL/.test(c))return "DevOps Sentinel";
 if(/^Operational Guidance/.test(c))return "Operational Guidance";
 return "Other Engineering References";
}
const MACROS=[...new Set(D.categories.map(macroDomain))].sort();
/* Hot-path indexes: avoid thousands of repeated Array.find() calls. */
const LIB_MAP=new Map((D.libraries||[]).map(l=>[l.id,l]));
const COMMAND_LIST=Object.values(H.commands||{});
const normalizeCommandText=t=>String(t||"").trim().replace(/\\\n/g," ").replace(/\s+/g," ").toLowerCase();
const COMMAND_TEXT_MAP=new Map();
COMMAND_LIST.forEach(m=>{const k=normalizeCommandText(m.text);if(k&&!COMMAND_TEXT_MAP.has(k))COMMAND_TEXT_MAP.set(k,m)});
const LIB_USAGE_MAP=new Map((D.libraries||[]).map(l=>[l.id,[]]));
COMMAND_LIST.forEach(m=>(m.libraries||[]).forEach(id=>{if(LIB_USAGE_MAP.has(id))LIB_USAGE_MAP.get(id).push(m)}));
const HIERARCHY_SEARCH_MAP=new Map((D.libraries||[]).map(l=>[l.id,`${l.name} ${l.domain} ${JSON.stringify(H.trees?.[l.id]?.tree||{})}`.toLowerCase()]));
const SECTION_BY_NUMBER=new Map(D.sections.map((s,i)=>[s.number,{s,i}]));
const SECTION_LIBRARY_CACHE=new Map();
function cachedSectionLibraryIds(s){
 if(!s)return [];
 if(SECTION_LIBRARY_CACHE.has(s.number))return SECTION_LIBRARY_CACHE.get(s.number);
 const counts=new Map();
 (H.sectionCommands?.[s.number]||[]).forEach(id=>{
   const m=H.commands?.[id];
   (m?.libraries||[]).forEach(l=>counts.set(l,(counts.get(l)||0)+1))
 });
 const ids=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 SECTION_LIBRARY_CACHE.set(s.number,ids);
 return ids
}
const SECTION_NAV_META=D.sections.map((s,i)=>{
 const ids=cachedSectionLibraryIds(s),lib=ids.length?LIB_MAP.get(ids[0]):null;
 return {s,i,macro:macroDomain(s.category),libraryId:lib?.id||"general",libraryName:lib?.name||"General / Reference",
   search:[macroDomain(s.category),s.category,s.title,lib?.name,(s.keywords||[]).join(" ")].filter(Boolean).join(" ").toLowerCase()}
});
function sectionInScope(s){return W.scope==="All"||!W.scope||macroDomain(s.category)===W.scope}
function sectionLibraryIds(s){return cachedSectionLibraryIds(s)}
function sectionPrimaryLibrary(s){const id=cachedSectionLibraryIds(s)[0];return id?LIB_MAP.get(id)||null:null}
function setHomeChrome(on){document.querySelectorAll(".home-only").forEach(x=>x.hidden=!on);document.body.classList.toggle("home-view",!!on)}
function setBreadcrumb(parts){const el=$("#workspaceBreadcrumb");if(!el)return;el.innerHTML=parts.map((x,i)=>i===parts.length-1?`<b>${esc(x)}</b>`:esc(x)).join(" <span>›</span> ")}
function updateBreadcrumbFromPanel(){const over=panel.querySelector(".section-head .over")?.textContent?.trim(),title=panel.querySelector(".section-head h2")?.textContent?.trim();if(title)setBreadcrumb(["Engineering Reference",over||"Workspace",title])}
function applyCommandDisplay(){document.documentElement.dataset.commandWrap=W.wrap||"auto";document.documentElement.style.setProperty("--code-font-size",`${clamp(+W.codeFont||13,10,19)}px`);const b=$("#wrapToggle");if(b)b.textContent=`Wrap: ${(W.wrap||"auto").replace(/^./,c=>c.toUpperCase())}`}
function applyWorkspaceLayout(persist=true){
 W.left=clamp(+W.left||330,220,600);W.right=clamp(+W.right||420,320,760);
 document.documentElement.style.setProperty("--workspace-left",`${W.left}px`);
 document.documentElement.style.setProperty("--workspace-right",`${W.right}px`);
 document.body.classList.toggle("left-collapsed",!!W.leftCollapsed);
 document.body.classList.toggle("right-collapsed",!!W.rightCollapsed);
 applyCommandDisplay();
 if(persist)saveWorkspace()
}
function applyDashboardLayout(){
 const root=$("#dashboardCards");if(!root)return;const cards=[...root.querySelectorAll("[data-dashboard-module]")],byId=new Map(cards.map(c=>[c.dataset.dashboardModule,c]));
 (dashboardPrefs.order||[]).forEach(id=>{const c=byId.get(id);if(c)root.appendChild(c)});cards.forEach(c=>{const id=c.dataset.dashboardModule,size=dashboardPrefs.sizes?.[id]||"standard";c.hidden=(dashboardPrefs.hidden||[]).includes(id);c.classList.remove("module-small","module-standard","module-wide","module-full");c.classList.add(`module-${size}`);c.draggable=!!W.moduleEdit;c.setAttribute("aria-grabbed","false");if(!c.querySelector(".module-edit-controls")){c.insertAdjacentHTML("beforeend",`<div class="module-edit-controls" aria-label="Module layout controls"><span class="module-drag-handle" title="Drag module to reorder">↕ Drag</span><button data-module-size="small" title="Small">S</button><button data-module-size="standard" title="Standard">M</button><button data-module-size="wide" title="Wide">L</button><button data-module-move="-1" title="Move earlier">←</button><button data-module-move="1" title="Move later">→</button><button data-module-hide="1" title="Hide module">×</button></div>`)} });
 store.set("oe-dashboard-layout",JSON.stringify(dashboardPrefs));
}
function setModuleEdit(on){W.moduleEdit=!!on;document.body.classList.toggle("module-editing",W.moduleEdit);applyDashboardLayout();["editModulesBtn","editModulesTopBtn"].forEach(id=>{const b=document.getElementById(id);if(b){b.setAttribute("aria-pressed",String(W.moduleEdit));if(id==="editModulesBtn")b.textContent=W.moduleEdit?"Done arranging":"Arrange modules"}});saveWorkspace();say(W.moduleEdit?"Module edit mode: drag cards or use arrows":"Module edit mode closed")}
applyWorkspaceLayout();


/* In-application view history */
const VIEW_HISTORY={back:[],forward:[],current:"home",replaying:false};
function updateHistoryButtons(){const b=$("#viewBack"),f=$("#viewForward");if(b)b.disabled=!VIEW_HISTORY.back.length;if(f)f.disabled=!VIEW_HISTORY.forward.length}
function recordView(route){if(VIEW_HISTORY.replaying||!route||route===VIEW_HISTORY.current)return;if(VIEW_HISTORY.current)VIEW_HISTORY.back.push(VIEW_HISTORY.current);VIEW_HISTORY.back=VIEW_HISTORY.back.slice(-80);VIEW_HISTORY.current=route;VIEW_HISTORY.forward=[];updateHistoryButtons()}
function navigateWorkspaceRoute(route){if(!route)return;VIEW_HISTORY.replaying=true;try{if(route==="home")encyclopediaHome();else if(route==="libraries")libraryIndex();else if(route==="help-index")helpIndex();else if(route==="help-diagnostics")helpDiagnostics();else if(route==="hierarchy")hierarchyIndex();else if(route==="guidance")tipsIndex();else if(route==="tools")toolIndex();else if(route==="quick-reference")quickReferenceView();else if(route==="most-used")mostUsedView();else if(route==="platform-matrix")platformMatrixView();else if(route==="workspace-diagnostics")workspaceDiagnostics();else if(route.startsWith("section:")){const n=route.slice(8),i=D.sections.findIndex(s=>s.number===n);if(i>=0)navigateSection(i)}else if(route.startsWith("library:"))showLibrary(route.slice(8));else if(route.startsWith("help:"))showLibraryHelp(route.slice(5));else if(route.startsWith("hierarchy:"))showCommandHierarchy(route.slice(10));else if(route.startsWith("mode:"))mode(route.slice(5))}finally{VIEW_HISTORY.current=route;VIEW_HISTORY.replaying=false;updateHistoryButtons()}}
function workspaceBack(){if(!VIEW_HISTORY.back.length)return;const target=VIEW_HISTORY.back.pop();if(VIEW_HISTORY.current)VIEW_HISTORY.forward.push(VIEW_HISTORY.current);navigateWorkspaceRoute(target)}
function workspaceForward(){if(!VIEW_HISTORY.forward.length)return;const target=VIEW_HISTORY.forward.pop();if(VIEW_HISTORY.current)VIEW_HISTORY.back.push(VIEW_HISTORY.current);navigateWorkspaceRoute(target)}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function say(t){toast.textContent=t;toast.classList.add("show");clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove("show"),1300)}
async function copy(t,msg="Copied",meta=null){try{await navigator.clipboard.writeText(t)}catch{let a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}if(meta){hist.unshift({...meta,text:t,at:new Date().toISOString()});hist=hist.slice(0,60);store.set("oe-history",JSON.stringify(hist))}say(msg)}
function saveFav(){store.set("oe-favs",JSON.stringify([...favs]));$("#favCount").textContent=favs.size}
saveFav();

$("#secCount").textContent=D.sections.length;
$("#lineCount").textContent=D.totalCommands;
$("#blockCount").textContent=D.totalBlocks;
$("#heroSections").textContent=D.sections.length;
$("#heroLines").textContent=D.totalCommands;
$("#heroSources").textContent=D.sources.length;
$("#heroRunbooks").textContent=(D.runbooks||[]).length;
$("#sentinelMetric").textContent=D.sentinel?.functional_command_lines||0;
$("#libraryMetric").textContent=(D.libraries||[]).length;
$("#helpMetric").textContent=(D.libraries||[]).filter(l=>l.helpReference).length;
$("#tipsMetric").textContent=(D.libraries||[]).reduce((n,l)=>n+(l.tips||[]).length+(l.expertTechniques||[]).length,0);
$("#platformMatrixMetric").textContent=(PM.tasks||[]).length;

const riskCount=COMMAND_LIST.filter(x=>x.risk&&!["read-only","local-write"].includes(x.risk)).length;
$("#riskMetric").textContent=riskCount;
$("#runbookMetric").textContent=(D.runbooks||[]).length;
$("#toolMetric").textContent=new Set(D.sections.flatMap(s=>s.keywords||[])).size;

const domain=$("#domain");
W.scope=MACROS.includes(W.scope)?W.scope:"All";
domain.innerHTML="<option>All</option>"+MACROS.map(c=>`<option>${esc(c)}</option>`).join("");
domain.value=W.scope;
domain.onchange=()=>{W.scope=domain.value;saveWorkspace();buildNav()};

function treeMatches(text){return !treeFilterText||String(text).toLowerCase().includes(treeFilterText.toLowerCase())}
function treeDetails(key,label,count,children,open=false,extra=""){
 const should=open||treeExpanded.has(key)||!!treeFilterText;
 return `<details class="tree-node" data-tree-key="${esc(key)}" ${should?"open":""}><summary>${extra}<span class="tree-label">${esc(label)}</span><span class="tree-count">${count}</span></summary><div class="tree-children">${children}</div></details>`
}
function buildCommandsTree(){
 const macros={};
 const filter=treeFilterText.toLowerCase();
 SECTION_NAV_META.forEach(meta=>{
   const {s,i,macro,libraryId,libraryName,search}=meta;
   if(!sectionInScope(s))return;
   if(filter&&!search.includes(filter))return;
   macros[macro]??={};macros[macro][s.category]??={};
   macros[macro][s.category][libraryId]??={name:libraryName,sections:[]};
   macros[macro][s.category][libraryId].sections.push({s,i})
 });
 const active=D.sections[S.current],activeMacro=active?macroDomain(active.category):"";
 let h='<div class="workspace-tree">';
 Object.entries(macros).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([macro,cats])=>{
   let macroCount=0,catHtml="";
   Object.entries(cats).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([cat,libGroups])=>{
     let catCount=0,libHtml="";
     Object.values(libGroups).sort((a,b)=>a.name.localeCompare(b.name)).forEach(g=>{
       const leaves=g.sections.sort((a,b)=>a.s.number.localeCompare(b.s.number)).map(({s,i})=>{
         catCount+=s.command_count;macroCount+=s.command_count;
         return `<button class="tree-leaf ${i===S.current?"active":""}" data-tree-section="${i}" title="${esc(s.title)}"><span>${esc(s.number)} · ${esc(s.title)}</span><span class="tree-meta">${s.command_count}</span></button>`
       }).join("");
       libHtml+=treeDetails(`cmd/lib/${macro}/${cat}/${g.name}`,g.name,g.sections.length,leaves,g.sections.some(x=>x.i===S.current))
     });
     catHtml+=treeDetails(`cmd/cat/${macro}/${cat}`,cat,Object.keys(libGroups).length,libHtml,cat===active?.category)
   });
   h+=treeDetails(`cmd/macro/${macro}`,macro,macroCount,catHtml,macro===activeMacro)
 });
 return h+'</div>';
}
function buildLibraryTree(helpMode=false){
 const groups={};(D.libraries||[]).forEach(l=>{const search=[l.name,l.domain,l.description].join(" ");if(!treeMatches(search))return;const macro=macroDomain(l.domain);if(W.scope!=="All"&&W.scope!==macro)return;groups[macro]??={};groups[macro][l.domain]??=[];groups[macro][l.domain].push(l)});
 let h='<div class="workspace-tree">';Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([macro,domains])=>{let total=0,dh="";Object.entries(domains).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([d,ls])=>{total+=ls.length;const leaves=ls.sort((a,b)=>a.name.localeCompare(b.name)).map(l=>`<button class="tree-leaf" data-tree-${helpMode?"help":"library"}="${esc(l.id)}"><span>${helpMode?'<span class="tree-help-icon">?</span>':'<span class="tree-library-icon">L</span>'}${esc(l.name)}</span><span class="tree-meta">${H.trees?.[l.id]?.count||0}</span></button>`).join("");dh+=treeDetails(`${helpMode?"help":"lib"}/${macro}/${d}`,d,ls.length,leaves)});h+=treeDetails(`${helpMode?"help":"lib"}/macro/${macro}`,macro,total,dh)});return h+'</div>';
}
function buildRunbookTree(){const rs=(D.runbooks||[]).map((r,i)=>({r,i})).filter(x=>treeMatches(`${x.r.title||x.r.name||"Runbook"} ${x.r.symptom||""} ${JSON.stringify(x.r)}`));return `<div class="workspace-tree">${treeDetails("runbooks/all","Incident Runbooks",rs.length,rs.map(({r,i})=>`<button class="tree-leaf" data-tree-runbook="${i}"><span>${esc(r.title||r.name||`Runbook ${i+1}`)}</span><span class="tree-meta">R${i+1}</span></button>`).join(""),true)}</div>`}

function hierarchyNavNodes(nodes,lib,prefix=[],depth=0){if(!nodes||depth>2)return "";return Object.entries(nodes).sort((a,b)=>(b[1].count||0)-(a[1].count||0)||a[0].localeCompare(b[0])).map(([name,obj])=>{const path=[...prefix,name],children=obj.children&&Object.keys(obj.children).length&&depth<2?hierarchyNavNodes(obj.children,lib,path,depth+1):"",key=`hier/${lib.id}/${path.join("/")}`,btn=`<button class="tree-leaf" data-tree-hierarchy-query="${esc(path.join(" "))}" data-tree-hierarchy-lib="${esc(lib.id)}"><span>${esc(name)}</span><span class="tree-meta">${obj.count||0}</span></button>`;return children?treeDetails(key,name,obj.count||0,children):btn}).join("")}
function buildHierarchyNav(){const groups={};(D.libraries||[]).forEach(l=>{const tr=H.trees?.[l.id],search=HIERARCHY_SEARCH_MAP.get(l.id)||"";if(!tr?.count||!treeMatches(search))return;const macro=macroDomain(l.domain);if(W.scope!=="All"&&W.scope!==macro)return;groups[macro]??=[];groups[macro].push(l)});let h='<div class="workspace-tree">';Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([macro,ls])=>{const libHtml=ls.sort((a,b)=>a.name.localeCompare(b.name)).map(l=>treeDetails(`hier/lib/${l.id}`,l.name,H.trees[l.id].count,hierarchyNavNodes(H.trees[l.id].tree,l))).join("");h+=treeDetails(`hier/macro/${macro}`,macro,ls.length,libHtml)});return h+'</div>'}

function buildFavoritesTree(){const ids=[];favs.forEach(id=>{if(H.commands?.[id])ids.push(id);else if(H.blockCommands?.[id])ids.push(...H.blockCommands[id])});const ms=[...new Set(ids)].map(cmdMeta).filter(Boolean).filter(m=>treeMatches(`${m.text} ${m.primaryTool} ${m.summary}`));return `<div class="workspace-tree">${treeDetails("favorites/all","Favorite Commands",ms.length,ms.map(m=>`<button class="tree-leaf" data-tree-command="${esc(m.id)}"><span>${esc(m.text)}</span><span class="tree-meta">${esc(riskLabel(m.risk))}</span></button>`).join(""),true)}</div>`}
function syncNavActive(){
 nav.querySelectorAll(".tree-leaf.active").forEach(x=>x.classList.remove("active"));
 const active=nav.querySelector(`[data-tree-section="${S.current}"]`);
 if(active)active.classList.add("active")
}
function buildNav(){
 document.querySelectorAll("[data-tree-mode]").forEach(b=>b.classList.toggle("active",b.dataset.treeMode===W.treeMode));
 const h=W.treeMode==="commands"?buildCommandsTree():W.treeMode==="hierarchy"?buildHierarchyNav():W.treeMode==="libraries"?buildLibraryTree(false):W.treeMode==="help"?buildLibraryTree(true):W.treeMode==="runbooks"?buildRunbookTree():buildFavoritesTree();
 nav.innerHTML=h||'<div class="tree-empty">No navigation items match the current scope and filter.</div>';
 syncNavActive()
}
/* Navigation event delegation: one listener regardless of tree size. */
nav.addEventListener("click",e=>{
 const section=e.target.closest("[data-tree-section]");if(section){navigateSection(+section.dataset.treeSection);return}
 const lib=e.target.closest("[data-tree-library]");if(lib){setHomeChrome(false);showLibrary(lib.dataset.treeLibrary);closeMobileNav();return}
 const help=e.target.closest("[data-tree-help]");if(help){setHomeChrome(false);showLibraryHelp(help.dataset.treeHelp);closeMobileNav();return}
 const cmd=e.target.closest("[data-tree-command]");if(cmd){const m=cmdMeta(cmd.dataset.treeCommand);if(m)navigateSection(m.sectionIndex,m.id);return}
 const run=e.target.closest("[data-tree-runbook]");if(run){showRunbook(+run.dataset.treeRunbook);return}
 const hier=e.target.closest("[data-tree-hierarchy-query]");if(hier){const ids=searchCommandIds(`library:${hier.dataset.treeHierarchyLib} help:"${hier.dataset.treeHierarchyQuery}"`);setHomeChrome(false);commandResultView(ids,`commands under ${esc(hier.dataset.treeHierarchyQuery)}`);closeMobileNav()}
});
nav.addEventListener("toggle",e=>{
 const d=e.target;if(!d.matches?.("details[data-tree-key]"))return;
 d.open?treeExpanded.add(d.dataset.treeKey):treeExpanded.delete(d.dataset.treeKey);
 saveTreeExpansion()
},true);

function navigateSection(i,commandId=null){if(!Number.isInteger(i)||i<0||i>=D.sections.length)return;S.current=i;S.mode="library";q.value="";summary.hidden=true;render();closeMobileNav();if(commandId)setTimeout(()=>document.querySelector(`[data-command-id="${CSS.escape(commandId)}"]`)?.focus(),30);scrollTo({top:0,behavior:"auto"})}
function expandCurrentTree(){W.treeMode="commands";buildNav();const active=nav.querySelector(`[data-tree-section="${S.current}"]`);if(active){let p=active.parentElement;while(p&&p!==nav){if(p.matches?.("details")){p.open=true;treeExpanded.add(p.dataset.treeKey)}p=p.parentElement}active.scrollIntoView({block:"nearest",behavior:"auto"});saveTreeExpansion()}}
function secText(s){let a=[];s.items.forEach(x=>{a.push(x.type==="note"?`# ${x.text}`:x.lines.join("\n"));a.push("")});return a.join("\n").trim()+"\n"}
function commonDefaults(){return {context:$("#phContext").value.trim(),"kube-context":$("#phContext").value.trim(),ctx:$("#phContext").value.trim(),ns:$("#phNs").value.trim(),namespace:$("#phNs").value.trim(),pod:$("#phName").value.trim(),name:$("#phName").value.trim()}}
function replacePlaceholders(text,values={}){return String(text).replace(/<([A-Za-z][A-Za-z0-9_.:/-]{0,80})>/g,(m,key)=>{const v=Object.prototype.hasOwnProperty.call(values,key)?values[key]:"";return v!==undefined&&String(v).length?String(v):m})}
function substitute(t){return replacePlaceholders(t,commonDefaults())}
function fmt(line){return esc(substitute(line)).replace(/(&lt;[^&]+?&gt;)/g,'<span class="placeholder">$1</span>')}


const RISK_ORDER={"read-only":0,"local-write":1,"remote-write":2,"controlled-change":3,"security-sensitive":4,"disruptive":5,"destructive":6};
function cmdMeta(id){return H.commands?.[id]||null}
const HELP_DETAIL_PROMISES=new Map();
function mergeHelpDetail(id){const m=cmdMeta(id);if(!m)return m;const chunk=window.COMMAND_HELP_DETAIL_CHUNKS?.[m.detailChunk];const d=chunk?.[id];if(d&&!m.__detailLoaded){Object.assign(m,d,{__detailLoaded:true})}return m}
function ensureHelpDetail(id){const m=cmdMeta(id);if(!m)return Promise.resolve(null);if(m.__detailLoaded)return Promise.resolve(m);const local=window.COMMAND_HELP_DETAIL_CHUNKS?.[m.detailChunk];if(local?.[id])return Promise.resolve(mergeHelpDetail(id));const key=m.detailChunk||"general";if(HELP_DETAIL_PROMISES.has(key))return HELP_DETAIL_PROMISES.get(key).then(()=>mergeHelpDetail(id));const p=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=`help/${encodeURIComponent(key)}.js`;s.async=true;s.onload=()=>resolve(mergeHelpDetail(id));s.onerror=()=>reject(new Error(`Unable to load Help detail chunk: ${key}`));document.head.appendChild(s)});HELP_DETAIL_PROMISES.set(key,p);return p.catch(err=>{console.error(err);return m})}

function riskLabel(r){return H.riskLabels?.[r]||String(r||"REFERENCE").toUpperCase().replace(/-/g," ")}
function libraryById(id){return LIB_MAP.get(id)||null}
function commandPathText(m){return m?.components?.[m?.primaryComponentIndex||0]?.pathText||m?.primaryTool||"reference"}
function flagHelp(m,flag){return H.flagGlossary?.tools?.[m?.primaryTool]?.[flag]||H.flagGlossary?.generic?.[flag]||`Option ${flag}. Open command-specific help for the installed tool version.`}
function placeholderHelp(key){return H.placeholderGlossary?.[key]||`Replacement value for <${key}>. Confirm the expected syntax and scope before execution.`}
function commandRowHtml(m,lineNo){
 if(!m)return "";
 const libs=(m.libraries||[]).map(libraryById).filter(Boolean);
 const path=commandPathText(m),fav=favs.has(m.id);
 return `<div class="command-row risk-${esc(m.risk)}" data-command-id="${esc(m.id)}" tabindex="0" role="group" aria-label="${esc(path)} command">
   <div class="command-row-main">
     <span class="command-line-no">${String(lineNo).padStart(2,"0")}</span>
     <code class="command-code">${fmt(m.text)}</code>
   </div>
   <div class="command-row-footer">
     <div class="command-row-tags"><span class="command-risk risk-pill-${esc(m.risk)}">${esc(riskLabel(m.risk))}</span>${path?`<span class="command-path">${esc(path)}</span>`:""}${m.compound?`<span class="command-component-count">${m.components.length} tools</span>`:""}</div>
     <div class="command-row-actions" aria-label="Command actions">
       <button data-cmd-action="help" title="Contextual command help">Help</button>
       <button data-cmd-action="build" title="Build command placeholders">${(m.placeholders||[]).length?"Build":"Review"}</button>
       <button data-cmd-action="copy" title="Copy this command">Copy</button>
       <button data-cmd-action="library" ${libs.length?"":"disabled"} title="Open linked technical library">Library${libs.length>1?` ${libs.length}`:""}</button>
       <button data-cmd-action="favorite" class="command-fav ${fav?"active":""}" title="Favorite this command" aria-pressed="${fav?"true":"false"}">★</button>
     </div>
   </div>
 </div>`
}
function blockRiskSummary(ids){
 const counts={};(ids||[]).filter(Boolean).forEach(id=>{const r=cmdMeta(id)?.risk||"read-only";counts[r]=(counts[r]||0)+1});
 const sorted=Object.entries(counts).sort((a,b)=>(RISK_ORDER[b[0]]||0)-(RISK_ORDER[a[0]]||0));
 return sorted.map(([r,n])=>`${n} ${riskLabel(r).toLowerCase()}`).join(" • ");
}
function sectionForCommand(m){return D.sections[m?.sectionIndex]||D.sections.find(s=>s.number===m?.section)}
function blockForCommand(m){const s=sectionForCommand(m);return s?.items?.find(x=>x.type==="command"&&x.id===m?.blockId)}
function openBuilderForCommand(id){
 const m=cmdMeta(id);if(!m)return;const s=sectionForCommand(m),it=blockForCommand(m);
 openCommandBuilder({section:s,item:it,text:m.text,id:m.id,commandMeta:m});
}
function toggleCommandFavorite(id,button=null){
 favs.has(id)?favs.delete(id):favs.add(id);saveFav();
 if(button){button.classList.toggle("active",favs.has(id));button.setAttribute("aria-pressed",String(favs.has(id)))}
 say(favs.has(id)?"Added to favorites":"Removed from favorites");
}
function commandCopy(id){
 const m=cmdMeta(id);if(!m)return;const s=sectionForCommand(m);recordCommandUsage(id,"copy");
 copy(substitute(m.text),"Command copied",{section:s?.number||m.section,title:s?.title||m.primaryTool,id:m.id});
}

function render(){setHomeChrome(false);recordView(`section:${D.sections[S.current]?.number||""}`);
 const s=D.sections[S.current];let ti=0,ta=[];
 const body=s.items.map((x,itemIndex)=>{
   if(x.type==="note"){
     const id=`t-${++ti}-${slug(x.text).slice(0,42)}`;ta.push({id,text:x.text});
     return `<section id="${id}" class="note ${x.danger?"danger":""}"><h3>${esc(x.text)}</h3></section>`
   }
   const ids=x.commandIds||H.blockCommands?.[x.id]||[];
   let rowNo=0;
   const rows=x.lines.map((line,li)=>{
     if(!line?.trim())return `<div class="command-spacer" aria-hidden="true"></div>`;
     const id=ids[li],m=cmdMeta(id);rowNo++;
     return commandRowHtml(m,rowNo)
   }).join("");
   const riskSummary=blockRiskSummary(ids);
   return `<section class="cmd command-block" data-id="${esc(x.id)}">
     <div class="cmdbar block-bar">
       <span class="risk">${x.lines.filter(Boolean).length} COMMAND / REFERENCE LINES${riskSummary?` • ${esc(riskSummary)}`:""}</span>
       <button data-block-action="favorite" class="fav ${favs.has(x.id)?"active":""}" title="Favorite this block">★ Block</button>
       <button data-block-action="copy" title="Copy complete block">Copy block</button>
     </div>
     <div class="command-list">${rows}</div>
   </section>`
 }).join("");
 panel.innerHTML=`<header class="section-head"><div class="over">SECTION ${s.number} • ${esc(s.category)}</div><h2>${esc(s.title)}</h2>
 <div class="meta"><span>${s.command_count} lines</span><span>${s.block_count} blocks</span><span>${esc(s.source_type||"Curated")}</span></div>
 ${s.source?`<span class="source-chip">${esc(s.source)}</span>`:""}</header>${body}`;
 toc.innerHTML=ta.map(x=>`<a href="#${x.id}">${esc(x.text)}</a>`).join("");
 document.title=`${s.title} — Cloud Native Operator Encyclopedia`;
 setBreadcrumb(["Commands",macroDomain(s.category),s.category,s.title]);renderContextForCurrent();
 history.replaceState(null,"",`#section-${s.number}`);syncNavActive();
}
function commandResultView(ids,label){setHomeChrome(false);
 const uniq=[...new Set(ids)].map(cmdMeta).filter(Boolean).slice(0,250);
 summary.hidden=false;summary.innerHTML=`<strong>${uniq.length}</strong> ${label}${ids.length>250?` • first 250 shown for responsiveness`:""}`;setBreadcrumb(["Search",label]);renderContextForCurrent();
 panel.innerHTML=uniq.map(m=>{const s=sectionForCommand(m);return `<article class="command-result"><div class="result-top"><span class="result-sec">SECTION ${esc(s?.number||m.section)}</span><span class="result-title">${esc(s?.title||m.primaryTool)}</span><button data-open-section="${m.sectionIndex}">Open section</button></div>${commandRowHtml(m,1)}</article>`}).join("")||`<div class="result"><b>No matching commands.</b><p>Try a broader term or use operators such as <code>tool:kubectl</code>, <code>risk:destructive</code>, <code>flag:--namespace</code> or <code>help:reconcile</code>.</p></div>`;
 toc.innerHTML="";
}
function mode(m){
 if(m!=="library")recordView(`mode:${m}`);S.mode=m;document.querySelectorAll(".mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===m));
 if(m==="library"){summary.hidden=true;render();return}
 let ids=[];
 if(m==="recent"){
   hist.forEach(h=>{if(H.commands?.[h.id])ids.push(h.id);else if(h.section)ids.push(...(H.sectionCommands?.[h.section]||[]).slice(0,1))})
 } else if(m==="favorites"){
   favs.forEach(id=>{if(H.commands?.[id])ids.push(id);else if(H.blockCommands?.[id])ids.push(...H.blockCommands[id])})
 } else if(m==="danger"){
   ids=Object.values(H.commands||{}).filter(x=>!["read-only","local-write"].includes(x.risk)).sort((a,b)=>(RISK_ORDER[b.risk]||0)-(RISK_ORDER[a.risk]||0)).map(x=>x.id)
 }
 commandResultView(ids,m==="favorites"?"favorite commands":m==="danger"?"impacting / sensitive commands":"recent copied commands");
}
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>mode(b.dataset.mode));

const COMMAND_SEARCH_ROWS=COMMAND_LIST.map(m=>{
 const s=D.sections[m.sectionIndex]||SECTION_BY_NUMBER.get(m.section)?.s;
 const libs=(m.libraries||[]).map(id=>LIB_MAP.get(id)).filter(Boolean);
 const libNames=libs.map(l=>`${l.id} ${l.name} ${l.domain}`).join(" ").toLowerCase();
 const componentText=(m.components||[]).map(c=>`${c.tool} ${c.pathText}`).join(" ").toLowerCase();
 const helpText=[m.summary,m.synopsis,(m.helpDiscovery||[]).join(" "),componentText].join(" ").toLowerCase();
 const freeText=[m.text,s?.title,s?.category,libNames,componentText,m.risk].join(" ").toLowerCase();
 return {m,libNames,componentText,helpText,freeText,riskText:`${m.risk} ${riskLabel(m.risk)}`.toLowerCase(),flags:(m.flags||[]).map(f=>f.toLowerCase())}
});

const SEARCH_ALIASES={"k8s":"kubernetes kubectl","cert":"certificate tls pki","disk usage":"df du filesystem storage","listening ports":"ss lsof netstat","pod crash":"crashloopbackoff logs previous describe events","image scan":"trivy grype syft","cost":"finops opencost infracost","gpu":"nvidia cuda dcgm","dns":"dig resolvectl bind","service fail":"systemctl journalctl","memory leak":"rss pmap smaps","network latency":"mtr ping iperf3 tcpdump","datadisk":"platform matrix unix comparison enterprise unix cross-platform","ontap":"netapp cluster mode storage array snapmirror lif","aix lvm":"lsvg lspv lslv jfs2 volume group","solaris zones":"zoneadm zonecfg zlogin zonestat","hpux":"hp-ux ioscan vgdisplay swlist","esxi":"vmware esxcli vim-cmd","san":"fibre channel fc multipath lsscsi","iscsi":"iscsiadm open-iscsi multipath"};
function expandSearchAliases(text){let t=String(text||"").toLowerCase();for(const [k,v] of Object.entries(SEARCH_ALIASES))if(t.includes(k))t+=` ${v}`;return t}
function editDistanceAtMost2(a,b){if(Math.abs(a.length-b.length)>2)return 3;const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);for(let i=1;i<=a.length;i++){cur[0]=i;let rowMin=cur[0];for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));rowMin=Math.min(rowMin,cur[j])}if(rowMin>2)return 3;for(let j=0;j<=b.length;j++)prev[j]=cur[j]}return prev[b.length]}
function parseSearchQuery(raw){
 const filters={tool:[],library:[],risk:[],flag:[],help:[]};
 let rest=String(raw||"");
 const re=/(tool|library|risk|flag|help):(?:"([^"]+)"|([^\s]+))/gi;
 rest=rest.replace(re,(all,k,qv,sv)=>{filters[k.toLowerCase()].push((qv||sv||"").toLowerCase());return " "});
 const terms=rest.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return {filters,terms};
}
function searchCommandIds(raw){
 const expanded=expandSearchAliases(raw),{filters,terms}=parseSearchQuery(expanded),out=[];
 for(const row of COMMAND_SEARCH_ROWS){
   const {m,libNames,componentText,helpText,freeText,riskText,flags}=row;
   if(filters.tool.length&&!filters.tool.every(v=>componentText.includes(v)))continue;
   if(filters.library.length&&!filters.library.every(v=>libNames.includes(v)))continue;
   if(filters.risk.length&&!filters.risk.every(v=>riskText.includes(v)))continue;
   if(filters.flag.length&&!filters.flag.every(v=>flags.some(f=>f===v||f.includes(v))))continue;
   if(filters.help.length&&!filters.help.every(v=>helpText.includes(v)))continue;
   if(terms.length&&!terms.every(v=>freeText.includes(v)||helpText.includes(v)))continue;
   out.push(m.id)
 }
 if(!out.length&&terms.length===1&&terms[0].length>=4){const q=terms[0];for(const row of COMMAND_SEARCH_ROWS){const tool=(row.m.primaryTool||"").toLowerCase();if(tool&&editDistanceAtMost2(q,tool)<=2)out.push(row.m.id);if(out.length>=80)break}}
 return out
}
let timer;
q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{
 const raw=q.value.trim();
 if(!raw){summary.hidden=true;render();return}
 const ids=searchCommandIds(raw);
 commandResultView(ids,`command matches for “${esc(raw)}”`)
},180)};

function openModal(t,b){$("#modalTitle").textContent=t;$("#modalBody").innerHTML=b;$("#modal").hidden=false}
$("#modalClose").onclick=()=>$("#modal").hidden=true;
$("#modal").onclick=e=>{if(e.target.id==="modal")e.currentTarget.hidden=true};

const commandHelpDrawer=$("#commandHelpDrawer"),commandHelpBackdrop=$("#commandHelpBackdrop"),commandHelpBody=$("#commandHelpBody"),quickHelp=$("#quickHelp");
let activeCommandHelpId=null,activeCommandHelpComponent=0,helpReturnFocus=null,quickTimer=null;

/* Command-row event delegation: one listener set for all 3,548 command rows */
panel.addEventListener("click",e=>{
 const quick=e.target.closest("[data-quick-action]");if(quick){const card=quick.closest("[data-command-id]"),id=card?.dataset.commandId,m=cmdMeta(id);if(!m)return;const kind=quick.dataset.quickAction;if(kind==="help")openCommandHelp(id);else if(kind==="build")openBuilderContextOrModal(id);else if(kind==="copy")commandCopy(id);else if(kind==="library"){const lib=libraryById(m.primaryLibrary);if(lib)showLibrary(lib.id)}return}
 const action=e.target.closest("[data-cmd-action]");
 if(action){
   const row=action.closest(".command-row"),id=row?.dataset.commandId;if(!id)return;
   const kind=action.dataset.cmdAction;
   if(kind==="help")openCommandHelp(id);
   else if(kind==="build")openBuilderContextOrModal(id);
   else if(kind==="copy")commandCopy(id);
   else if(kind==="library"){const m=cmdMeta(id),libs=(m?.libraries||[]).map(libraryById).filter(Boolean);if(libs.length===1)showLibrary(libs[0].id);else if(libs.length)showLibraryChooser(libs)}
   else if(kind==="favorite")toggleCommandFavorite(id,action);
   return
 }
 const blockAction=e.target.closest("[data-block-action]");
 if(blockAction){
   const block=blockAction.closest(".command-block"),bid=block?.dataset.id,s=D.sections[S.current],it=s?.items?.find(x=>x.type==="command"&&x.id===bid);if(!it)return;
   if(blockAction.dataset.blockAction==="copy")copy(substitute(it.lines.join("\n")),"Command block copied",{section:s.number,title:s.title,id:bid});
   else{favs.has(bid)?favs.delete(bid):favs.add(bid);saveFav();blockAction.classList.toggle("active",favs.has(bid));say(favs.has(bid)?"Block added to favorites":"Block removed from favorites")}
   return
 }
 const open=e.target.closest("[data-open-section]");
 if(open){navigateSection(+open.dataset.openSection)}
});
panel.addEventListener("keydown",e=>{
 const row=e.target.closest?.(".command-row");if(!row||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(e.target.tagName))return;
 const id=row.dataset.commandId,k=e.key.toLowerCase();
 if(k==="h"){e.preventDefault();openCommandHelp(id)}
 else if(k==="b"){e.preventDefault();openBuilderContextOrModal(id)}
 else if(k==="c"){e.preventDefault();commandCopy(id)}
 else if(k==="l"){e.preventDefault();const m=cmdMeta(id),libs=(m?.libraries||[]).map(libraryById).filter(Boolean);if(libs.length===1)showLibrary(libs[0].id);else if(libs.length)showLibraryChooser(libs)}
 else if(k==="f"){e.preventDefault();toggleCommandFavorite(id,row.querySelector('[data-cmd-action="favorite"]'))}
 else if(e.key==="Enter"){e.preventDefault();openCommandHelp(id)}
});
panel.addEventListener("mouseover",e=>{
 const row=e.target.closest?.(".command-row");if(!row||row.contains(e.relatedTarget))return;clearTimeout(quickTimer);const m=cmdMeta(row.dataset.commandId);quickTimer=setTimeout(()=>showQuickHelpForRow(row,m),260)
});
panel.addEventListener("mouseout",e=>{
 const row=e.target.closest?.(".command-row");if(!row||row.contains(e.relatedTarget))return;hideQuickHelp()
});
panel.addEventListener("scroll",hideQuickHelp,{passive:true});
window.addEventListener("scroll",hideQuickHelp,{passive:true,capture:true});
commandHelpBackdrop.onclick=closeCommandHelp;
$("#commandHelpClose").onclick=closeCommandHelp;
commandHelpBody.addEventListener("click",e=>{
 const b=e.target.closest("[data-help-action]");if(!b||!activeCommandHelpId)return;const m=cmdMeta(activeCommandHelpId),kind=b.dataset.helpAction;
 if(kind==="copy")commandCopy(m.id);
 else if(kind==="build"){const id=m.id;if(!isDockedContext())closeCommandHelp();openBuilderContextOrModal(id)}
 else if(kind==="library"){const libs=(m.libraries||[]).map(libraryById).filter(Boolean);closeCommandHelp();if(libs.length===1)showLibrary(libs[0].id);else if(libs.length)showLibraryChooser(libs)}
 else if(kind==="section"){closeCommandHelp();S.current=m.sectionIndex;render();setTimeout(()=>document.querySelector(`[data-command-id="${CSS.escape(m.id)}"]`)?.focus(),30)}
});

commandHelpDrawer.addEventListener("keydown",e=>{
 if(e.key!=="Tab"||!commandHelpDrawer.classList.contains("open"))return;
 const focusable=[...commandHelpDrawer.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hidden&&x.offsetParent!==null);
 if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});



/* Resizable contextual workspace */
const contextPane=$("#contextPane"),contextBody=$("#contextBody"),contextTitle=$("#contextTitle"),contextStatus=$("#contextStatus");
function isDockedContext(){return matchMedia("(min-width:1181px)").matches}
function ensureContextVisible(){W.rightCollapsed=false;document.body.classList.remove("right-collapsed");if(!isDockedContext())contextPane.classList.add("mobile-open");applyWorkspaceLayout()}
function setContextMode(mode,force=false){if(W.contextPinned&&!force&&mode!==W.contextMode)return;W.contextMode=mode;saveWorkspace();document.querySelectorAll("[data-context-mode]").forEach(b=>b.classList.toggle("active",b.dataset.contextMode===mode));renderContextForCurrent()}
function renderContextOverview(){const s=D.sections[S.current],viewTitle=panel.querySelector(".section-head h2")?.textContent?.trim()||s?.title||"Engineering Reference",viewOver=panel.querySelector(".section-head .over")?.textContent?.trim()||s?.category||"Workspace",isSection=viewTitle===s?.title;contextTitle.textContent="Current View";contextBody.innerHTML=`<div class="context-card"><h4>${isSection?"CURRENT SECTION":"CURRENT WORKSPACE VIEW"}</h4><h3>${esc(viewTitle)}</h3><p>${esc(viewOver)}</p><dl class="context-kv">${isSection?`<dt>Section</dt><dd>${esc(s?.number||"—")}</dd><dt>Commands</dt><dd>${s?.command_count||0}</dd><dt>Blocks</dt><dd>${s?.block_count||0}</dd>`:`<dt>Underlying section</dt><dd>${esc(s?.number||"—")}</dd><dt>View type</dt><dd>${esc(viewOver.split("•")[0].trim())}</dd>`}<dt>Scope</dt><dd>${esc(W.scope||"All")}</dd></dl><div class="context-actions"><button data-context-action="tree-current">Reveal current section</button><button data-context-action="copy-section">Copy section</button></div></div><div class="context-card"><h4>OPERATOR GUARDRAILS</h4><p>Verify context, namespace, target and impact before changes. Use command-level risk classification and contextual Help before executing sensitive operations.</p></div><div class="context-card"><h4>WORKSPACE</h4><dl class="context-kv"><dt>Layout</dt><dd>${esc(W.preset)}</dd><dt>Navigation</dt><dd>${W.leftCollapsed?"Collapsed":`${W.left}px`}</dd><dt>Context</dt><dd>${W.rightCollapsed?"Collapsed":`${W.right}px`}</dd><dt>Command wrap</dt><dd>${esc(W.wrap)}</dd></dl></div>`;contextStatus.textContent=isSection?`Section ${s?.number||"—"} • ${s?.command_count||0} commands`:viewTitle}
function renderContextTOC(){contextTitle.textContent="Contents";const links=[...toc.querySelectorAll("a")];contextBody.innerHTML=`<div class="context-card"><h4>ON THIS PAGE</h4><nav class="context-toc">${links.length?links.map(a=>`<a href="${esc(a.getAttribute("href"))}">${esc(a.textContent)}</a>`).join(""):"<p>No subsection headings in the current view.</p>"}</nav></div><div class="context-card"><h4>SECTION ACTIONS</h4><div class="context-actions"><button data-context-action="copy-section">Copy section</button><button data-context-action="source">Source reference</button></div></div>`}
function renderContextDiagnostics(){const c=H.coverage||{};contextTitle.textContent="Diagnostics";contextBody.innerHTML=`<div class="context-card"><h4>COMMAND HELP COVERAGE</h4><dl class="context-kv"><dt>Commands</dt><dd>${c.totalCommands||0}</dd><dt>Libraries</dt><dd>${c.libraries||D.libraries.length}</dd><dt>Library coverage</dt><dd>${c.libraryCoveragePercent||0}%</dd><dt>Dead Help</dt><dd>${c.deadHelpButtons||0}</dd><dt>Compound</dt><dd>${c.compoundCommands||0}</dd></dl></div><div class="context-card"><h4>WORKSPACE STATE</h4><dl class="context-kv"><dt>Tree mode</dt><dd>${esc(W.treeMode)}</dd><dt>Expanded nodes</dt><dd>${treeExpanded.size}</dd><dt>Left pane</dt><dd>${W.leftCollapsed?"collapsed":W.left+"px"}</dd><dt>Right pane</dt><dd>${W.rightCollapsed?"collapsed":W.right+"px"}</dd><dt>Theme</dt><dd>${esc(S.theme)}</dd></dl><div class="context-actions"><button data-context-action="settings">Workspace settings</button><button data-context-action="help-diagnostics">Help diagnostics</button></div></div>`}
function renderContextBuilder(id=activeContextBuilderId){
 const m=id?cmdMeta(id):null;contextTitle.textContent="Smart Builder";if(!m){const s=D.sections[S.current],first=(H.sectionCommands?.[s?.number]||[]).map(cmdMeta).find(x=>(x?.placeholders||[]).length);if(first){activeContextBuilderId=first.id;return renderContextBuilder(first.id)}contextBody.innerHTML='<div class="context-card"><h4>SMART BUILDER</h4><p>Select <b>Build</b> on a command row to load a context-aware command here.</p><div class="context-actions"><button data-context-action="open-full-builder">Open full builder</button></div></div>';return}
 activeContextBuilderId=m.id;const phs=m.placeholders||[];contextBody.innerHTML=`<div class="context-card"><h4>${esc(riskLabel(m.risk))}</h4><code class="context-command-preview">${esc(m.text)}</code></div><div class="context-card"><h4>COMMAND FIELDS</h4><div class="context-builder-fields">${phs.length?phs.map(k=>{const bm=builderMeta(k);return `<div class="context-builder-field"><label><span>${esc(bm.label)}</span><button type="button" data-context-field-help="${esc(k)}">?</button></label><input data-context-builder-key="${esc(k)}" data-context-builder-type="${esc(bm.type)}" value="${esc(seedValue(k))}" placeholder="${esc(k)}"><p data-context-field-note="${esc(k)}" hidden>${esc(placeholderHelp(k))}</p></div>`}).join(""):'<p>No variable placeholders were detected. The command can be reviewed and copied as-is.</p>'}</div></div><div class="context-card"><h4>PREVIEW</h4><code id="contextBuilderPreview" class="context-command-preview">${esc(replacePlaceholders(m.text,Object.fromEntries(phs.map(k=>[k,seedValue(k)]))))}</code><div class="context-actions"><button data-context-action="context-builder-copy">Validate & Copy</button><button data-context-action="open-full-builder">Open full builder</button><button data-context-action="command-help">Help</button></div><p id="contextBuilderValidation"></p></div>`;refreshContextBuilderPreview()
}
function refreshContextBuilderPreview(){const m=activeContextBuilderId?cmdMeta(activeContextBuilderId):null,pre=$("#contextBuilderPreview"),msg=$("#contextBuilderValidation");if(!m||!pre)return;const vals={},errs=[];contextBody.querySelectorAll("[data-context-builder-key]").forEach(inp=>{vals[inp.dataset.contextBuilderKey]=inp.value.trim();const r=validateBuilderValue(inp.dataset.contextBuilderKey,inp.value,inp.dataset.contextBuilderType);if(r.errors.length)errs.push(...r.errors.map(x=>`<${inp.dataset.contextBuilderKey}>: ${x}`));inp.classList.toggle("invalid",r.errors.length>0)});const built=replacePlaceholders(m.text,vals);pre.textContent=built;extractPlaceholders(built).forEach(k=>errs.push(`<${k}> unresolved`));if(msg){msg.textContent=errs.length?errs.join(" • "):"Ready for operator review.";msg.className=errs.length?"validation-bad":"validation-good"}pre.dataset.built=built;pre.dataset.valid=String(!errs.length)}
function syncCommandHelpContext(){contextTitle.textContent=$("#commandHelpTitle")?.textContent||"Command Help";contextBody.innerHTML=commandHelpBody.innerHTML;contextStatus.textContent="Contextual command help"}
function renderContextForCurrent(){if(!contextBody)return;document.querySelectorAll("[data-context-mode]").forEach(b=>b.classList.toggle("active",b.dataset.contextMode===W.contextMode));if(W.contextMode==="help"&&activeCommandHelpId){renderCommandHelp();syncCommandHelpContext()}else if(W.contextMode==="builder")renderContextBuilder();else if(W.contextMode==="toc")renderContextTOC();else if(W.contextMode==="diagnostics")renderContextDiagnostics();else renderContextOverview()}
function openBuilderContextOrModal(id){recordCommandUsage(id,"build");if(isDockedContext()){activeContextBuilderId=id;ensureContextVisible();setContextMode("builder",true);renderContextBuilder(id)}else openBuilderForCommand(id)}
function handleContextHelpClick(e){
 const copyBtn=e.target.closest("[data-help-copy]");if(copyBtn){copy(copyBtn.dataset.helpCopy,"Help command copied");return}
 const comp=e.target.closest("[data-component-index]");if(comp&&activeCommandHelpId){activeCommandHelpComponent=+comp.dataset.componentIndex;renderCommandHelp();syncCommandHelpContext();return}
 const rel=e.target.closest("[data-related-command]");if(rel){activeCommandHelpId=rel.dataset.relatedCommand;activeCommandHelpComponent=0;renderCommandHelp();syncCommandHelpContext();return}
 const ph=e.target.closest("[data-placeholder-builder]");if(ph&&activeCommandHelpId){openBuilderContextOrModal(activeCommandHelpId);return}
 const a=e.target.closest("[data-help-action]");if(a&&activeCommandHelpId){const m=cmdMeta(activeCommandHelpId),kind=a.dataset.helpAction;if(kind==="copy")commandCopy(m.id);else if(kind==="build")openBuilderContextOrModal(m.id);else if(kind==="library"){const libs=(m.libraries||[]).map(libraryById).filter(Boolean);if(libs.length===1)showLibrary(libs[0].id);else if(libs.length)showLibraryChooser(libs)}else if(kind==="section")navigateSection(m.sectionIndex,m.id);return}
}
contextBody.addEventListener("click",e=>{
 if(W.contextMode==="help")handleContextHelpClick(e);
 const help=e.target.closest("[data-context-field-help]");if(help){const p=contextBody.querySelector(`[data-context-field-note="${CSS.escape(help.dataset.contextFieldHelp)}"]`);if(p)p.hidden=!p.hidden;return}
 const a=e.target.closest("[data-context-action]");if(!a)return;const k=a.dataset.contextAction,s=D.sections[S.current];
 if(k==="help-fallback-drawer"&&activeCommandHelpId){const keep=activeCommandHelpId;W.rightCollapsed=true;applyWorkspaceLayout();openCommandHelp(keep)}else if(k==="tree-current")expandCurrentTree();else if(k==="copy-section")copy(substitute(secText(s)),"Section copied",{section:s.number,title:s.title,id:"section"});else if(k==="source"){if(s.source)window.open(s.source,"_blank","noopener");else say("No external source URL for this section")}else if(k==="settings")showWorkspaceSettings();else if(k==="help-diagnostics"){setHomeChrome(false);helpDiagnostics()}else if(k==="open-full-builder"){$("#openSmartBuilder").click()}else if(k==="command-help"&&activeContextBuilderId)openCommandHelp(activeContextBuilderId);else if(k==="context-builder-copy"){const p=$("#contextBuilderPreview");if(p?.dataset.valid==="true")copy(p.dataset.built,"Validated command copied");else say("Resolve builder validation errors first")}
});
contextBody.addEventListener("input",e=>{if(e.target.matches("[data-context-builder-key]"))refreshContextBuilderPreview()});
document.querySelectorAll("[data-context-mode]").forEach(b=>b.onclick=()=>{ensureContextVisible();const mode=b.dataset.contextMode;if(mode==="help"&&!activeCommandHelpId){W.contextMode="help";saveWorkspace();document.querySelectorAll("[data-context-mode]").forEach(x=>x.classList.toggle("active",x===b));contextTitle.textContent="Command Help";contextBody.innerHTML='<div class="context-card"><h4>COMMAND HELP</h4><p>Select <b>Help</b> on any command row. Exact syntax, flags, placeholders, impact, related commands and library references will appear here.</p></div>';contextStatus.textContent="Select a command Help action";return}setContextMode(mode,true)});
$("#contextPinBtn").onclick=()=>{W.contextPinned=!W.contextPinned;$("#contextPinBtn").setAttribute("aria-pressed",String(W.contextPinned));saveWorkspace();say(W.contextPinned?"Context mode pinned":"Context mode follows selections")};
$("#contextCollapseBtn").onclick=()=>{if(isDockedContext()){W.rightCollapsed=true;applyWorkspaceLayout()}else contextPane.classList.remove("mobile-open")};
$("#contextSettingsBtn").onclick=showWorkspaceSettings;

function openCommandHelpDocked(id){
 const m=cmdMeta(id);if(!m){say("Help metadata unavailable for this command");return}recordCommandUsage(id,"help");
 if(!isDockedContext()){openCommandHelp(id);return}
 helpReturnFocus=document.activeElement;activeCommandHelpId=id;activeCommandHelpComponent=0;W.contextPinned=false;
 ensureContextVisible();W.contextMode="help";saveWorkspace();contextTitle.textContent="Command Help";contextBody.innerHTML=`<div class="context-card"><h4>COMMAND HELP</h4><h3>${esc(commandPathText(m))}</h3><p>Loading detailed reference…</p></div>`;
 ensureHelpDetail(id).then(()=>{if(activeCommandHelpId!==id)return;try{renderCommandHelp();syncCommandHelpContext()}catch(err){console.error("Command Help render failed",err);contextBody.innerHTML=`<div class="context-card"><h4>COMMAND HELP</h4><h3>${esc(commandPathText(m))}</h3><code class="context-command-preview">${esc(m.text)}</code><p>${esc(m.summary||"Contextual command reference")}</p></div>`}});
 document.querySelectorAll("[data-context-mode]").forEach(b=>b.classList.toggle("active",b.dataset.contextMode==="help"));contextPane.classList.add("context-attention");setTimeout(()=>contextPane.classList.remove("context-attention"),500);contextBody.scrollTop=0
}

/* Workspace splitters */
function bindSplitter(el,side){
 let active=false,startX=0,start=0,pending=0,raf=0;
 const limits=()=>side==="left"?[220,600]:[320,760];
 const paint=()=>{raf=0;const [min,max]=limits();if(side==="left")W.left=clamp(pending,min,max);else W.right=clamp(pending,min,max);applyWorkspaceLayout(false);el.setAttribute("aria-valuenow",String(side==="left"?W.left:W.right))};
 const move=e=>{if(!active)return;e.preventDefault();const delta=e.clientX-startX;pending=side==="left"?start+delta:start-delta;if(!raf)raf=requestAnimationFrame(paint)};
 const finish=e=>{if(!active)return;active=false;if(raf){cancelAnimationFrame(raf);raf=0;paint()}document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);document.removeEventListener("pointercancel",finish);document.body.classList.remove("workspace-resizing");el.classList.remove("active");applyWorkspaceLayout(true)};
 el.addEventListener("pointerdown",e=>{if(!isDockedContext()||e.button!==0)return;e.preventDefault();if(side==="left")W.leftCollapsed=false;else W.rightCollapsed=false;applyWorkspaceLayout(false);active=true;startX=e.clientX;start=side==="left"?W.left:W.right;pending=start;document.body.classList.add("workspace-resizing");el.classList.add("active");document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",finish,{once:true});document.addEventListener("pointercancel",finish,{once:true})});
 el.addEventListener("dblclick",()=>{if(side==="left"){W.left=330;W.leftCollapsed=false}else{W.right=420;W.rightCollapsed=false}applyWorkspaceLayout(true)});
 el.addEventListener("click",()=>{if(side==="left"&&W.leftCollapsed){W.leftCollapsed=false;W.left=Math.max(W.left||0,330);applyWorkspaceLayout(true)}else if(side==="right"&&W.rightCollapsed){W.rightCollapsed=false;W.right=Math.max(W.right||0,420);applyWorkspaceLayout(true)}});
 el.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","Home","End","Enter"," "].includes(e.key))return;e.preventDefault();const [min,max]=limits(),step=e.shiftKey?48:16;if(e.key==="Enter"||e.key===" "){if(side==="left")W.leftCollapsed=!W.leftCollapsed;else W.rightCollapsed=!W.rightCollapsed;applyWorkspaceLayout(true);return}if(side==="left"){W.leftCollapsed=false;if(e.key==="Home")W.left=min;else if(e.key==="End")W.left=max;else W.left=clamp(W.left+(e.key==="ArrowRight"?step:-step),min,max)}else{W.rightCollapsed=false;if(e.key==="Home")W.right=min;else if(e.key==="End")W.right=max;else W.right=clamp(W.right+(e.key==="ArrowLeft"?step:-step),min,max)}applyWorkspaceLayout(true);el.setAttribute("aria-valuenow",String(side==="left"?W.left:W.right))})
}
bindSplitter($("#leftSplitter"),"left");bindSplitter($("#rightSplitter"),"right");
$("#navNarrowBtn").onclick=()=>{W.leftCollapsed=false;W.left=clamp(W.left-40,220,600);applyWorkspaceLayout(true)};
$("#navWidenBtn").onclick=()=>{W.leftCollapsed=false;W.left=clamp(W.left+40,220,600);applyWorkspaceLayout(true)};
$("#navCollapseBtn").onclick=()=>{W.leftCollapsed=true;applyWorkspaceLayout(true)};
$("#contextNarrowBtn").onclick=()=>{W.rightCollapsed=false;W.right=clamp(W.right-40,320,760);applyWorkspaceLayout(true)};
$("#contextWidenBtn").onclick=()=>{W.rightCollapsed=false;W.right=clamp(W.right+40,320,760);applyWorkspaceLayout(true)};

const LAYOUT_PRESETS={balanced:{left:330,right:420,leftCollapsed:false,rightCollapsed:false},command:{left:280,right:420,leftCollapsed:false,rightCollapsed:true},research:{left:380,right:500,leftCollapsed:false,rightCollapsed:false},troubleshooting:{left:330,right:540,leftCollapsed:false,rightCollapsed:false},library:{left:400,right:440,leftCollapsed:false,rightCollapsed:false},builder:{left:330,right:540,leftCollapsed:true,rightCollapsed:false},full:{left:330,right:420,leftCollapsed:true,rightCollapsed:true}};
function applyPreset(name){const p=LAYOUT_PRESETS[name];if(!p)return;Object.assign(W,p,{preset:name});applyWorkspaceLayout();renderContextForCurrent();say(`Layout: ${name.replace(/^./,c=>c.toUpperCase())}`)}
function dashboardSettingRows(){return DASH_MODULE_IDS.map(id=>{const card=document.querySelector(`[data-dashboard-module="${id}"]`),label=card?.querySelector("span")?.textContent||id,size=dashboardPrefs.sizes?.[id]||"standard",visible=!(dashboardPrefs.hidden||[]).includes(id);return `<div class="module-setting" data-setting-module="${id}"><label><input type="checkbox" data-setting-visible ${visible?"checked":""}> <span>${esc(label)}</span></label><select data-setting-size><option value="small" ${size==="small"?"selected":""}>Small</option><option value="standard" ${size==="standard"?"selected":""}>Standard</option><option value="wide" ${size==="wide"?"selected":""}>Wide</option><option value="full" ${size==="full"?"selected":""}>Full width</option></select><span>${id}</span></div>`}).join("")}
function showWorkspaceSettings(){openModal("Workspace Layout & Display",`<div class="workspace-settings"><section class="settings-section"><h3>Layout presets</h3><div class="preset-grid">${Object.keys(LAYOUT_PRESETS).map(k=>`<button data-layout-preset="${k}" class="${W.preset===k?"active":""}">${k.replace(/^./,c=>c.toUpperCase())}</button>`).join("")}</div></section><section class="settings-section"><h3>Resizable panes</h3><label class="settings-row"><span>Navigation width</span><input id="settingLeftWidth" type="range" min="220" max="600" value="${W.left}"><b id="settingLeftValue">${W.left}px</b></label><label class="settings-row"><span>Context width</span><input id="settingRightWidth" type="range" min="320" max="760" value="${W.right}"><b id="settingRightValue">${W.right}px</b></label><div class="settings-actions"><button id="settingToggleLeft">${W.leftCollapsed?"Show":"Hide"} navigation</button><button id="settingToggleRight">${W.rightCollapsed?"Show":"Hide"} context</button></div></section><section class="settings-section"><h3>Command display</h3><label class="settings-row"><span>Wrap long commands</span><select id="settingWrap"><option value="auto">Auto</option><option value="on">Always wrap</option><option value="off">Horizontal scroll</option></select><span></span></label><label class="settings-row"><span>Code font size</span><input id="settingCodeFont" type="range" min="10" max="19" value="${W.codeFont}"><b id="settingCodeFontValue">${W.codeFont}px</b></label></section><section class="settings-section"><h3>Home modules</h3><div class="module-settings-list">${dashboardSettingRows()}</div><div class="settings-actions"><button id="settingEditModules">Toggle visual edit mode</button></div></section><section class="settings-section"><h3>Workspace portability</h3><textarea id="workspaceJson" class="settings-json" spellcheck="false" placeholder="Exported workspace JSON"></textarea><div class="settings-actions"><button id="workspaceExport">Export settings</button><button id="workspaceImport">Import settings</button><button id="workspaceReset">Reset workspace</button></div></section></div>`);const root=$("#modalBody");root.querySelectorAll("[data-layout-preset]").forEach(b=>b.onclick=()=>{applyPreset(b.dataset.layoutPreset);showWorkspaceSettings()});const lw=$("#settingLeftWidth"),rw=$("#settingRightWidth"),cf=$("#settingCodeFont"),wr=$("#settingWrap");wr.value=W.wrap;lw.oninput=()=>{W.left=+lw.value;$("#settingLeftValue").textContent=W.left+"px";W.leftCollapsed=false;applyWorkspaceLayout(false)};lw.onchange=saveWorkspace;rw.oninput=()=>{W.right=+rw.value;$("#settingRightValue").textContent=W.right+"px";W.rightCollapsed=false;applyWorkspaceLayout(false)};rw.onchange=saveWorkspace;cf.oninput=()=>{W.codeFont=+cf.value;$("#settingCodeFontValue").textContent=W.codeFont+"px";applyCommandDisplay()};cf.onchange=saveWorkspace;wr.onchange=()=>{W.wrap=wr.value;applyCommandDisplay();saveWorkspace()};$("#settingToggleLeft").onclick=()=>{W.leftCollapsed=!W.leftCollapsed;applyWorkspaceLayout();showWorkspaceSettings()};$("#settingToggleRight").onclick=()=>{W.rightCollapsed=!W.rightCollapsed;applyWorkspaceLayout();showWorkspaceSettings()};root.querySelectorAll("[data-setting-module]").forEach(row=>{row.querySelector("[data-setting-visible]").onchange=e=>{const id=row.dataset.settingModule,set=new Set(dashboardPrefs.hidden||[]);e.target.checked?set.delete(id):set.add(id);dashboardPrefs.hidden=[...set];applyDashboardLayout()};row.querySelector("[data-setting-size]").onchange=e=>{dashboardPrefs.sizes??={};dashboardPrefs.sizes[row.dataset.settingModule]=e.target.value;applyDashboardLayout()}});$("#settingEditModules").onclick=()=>{setModuleEdit(!W.moduleEdit);$("#modal").hidden=true};$("#workspaceExport").onclick=()=>{$("#workspaceJson").value=JSON.stringify({workspace:W,dashboard:dashboardPrefs,treeExpanded:[...treeExpanded],theme:S.theme,density:document.documentElement.dataset.density},null,2)};$("#workspaceImport").onclick=()=>{try{const v=JSON.parse($("#workspaceJson").value);Object.assign(W,v.workspace||{});dashboardPrefs=Object.assign(dashboardPrefs,v.dashboard||{});treeExpanded=new Set(v.treeExpanded||[]);if(v.theme)applyLightTheme(v.theme,false);if(v.density){document.documentElement.dataset.density=v.density;store.set("oe-density",v.density)}applyWorkspaceLayout();applyDashboardLayout();buildNav();saveTreeExpansion();say("Workspace settings imported");$("#modal").hidden=true}catch{say("Invalid workspace JSON")}};$("#workspaceReset").onclick=()=>{Object.assign(W,W_DEFAULT);dashboardPrefs={order:DASH_MODULE_IDS.slice(),hidden:[],sizes:{}};treeExpanded=new Set();applyWorkspaceLayout();applyDashboardLayout();buildNav();saveTreeExpansion();say("Workspace reset");$("#modal").hidden=true}}

/* Navigation tree controls */
document.querySelectorAll("[data-tree-mode]").forEach(b=>b.onclick=()=>{W.treeMode=b.dataset.treeMode;saveWorkspace();buildNav()});
let treeFilterTimer=0;
$("#treeFilter").oninput=e=>{clearTimeout(treeFilterTimer);const value=e.target.value.trim();treeFilterTimer=setTimeout(()=>{treeFilterText=value;buildNav()},140)};
$("#treeExpandAll").onclick=()=>{nav.querySelectorAll("details[data-tree-key]").forEach(d=>{d.open=true;treeExpanded.add(d.dataset.treeKey)});saveTreeExpansion()};
$("#treeCollapseAll").onclick=()=>{nav.querySelectorAll("details[data-tree-key]").forEach(d=>d.open=false);treeExpanded.clear();saveTreeExpansion()};
$("#treeExpandCurrent").onclick=expandCurrentTree;

/* View-local filter and section navigation */
function filterCurrentView(term){const t=String(term||"").trim().toLowerCase();let visible=0;panel.querySelectorAll(".command-row,.command-result,.tool-chip,.library-card-full,.help-card,.tip-card,.guidance-card,.diagnostic-card,.quick-ref-card,.az-tool-card").forEach(el=>{const show=!t||el.textContent.toLowerCase().includes(t);el.classList.toggle("view-filter-hidden",!show);if(show)visible++});panel.querySelectorAll(".command-block").forEach(b=>{const rows=[...b.querySelectorAll(".command-row")];if(rows.length)b.classList.toggle("view-filter-hidden",rows.every(r=>r.classList.contains("view-filter-hidden")))});if(t){summary.hidden=false;summary.innerHTML=`<strong>${visible}</strong> items visible in current view`}}
$("#viewFilter").oninput=e=>filterCurrentView(e.target.value);
$("#viewBack").onclick=workspaceBack;$("#viewForward").onclick=workspaceForward;updateHistoryButtons();
$("#wrapToggle").onclick=()=>{W.wrap=W.wrap==="auto"?"on":W.wrap==="on"?"off":"auto";applyCommandDisplay();saveWorkspace()};

/* Dashboard module sizing/reordering */
$("#dashboardCards").addEventListener("click",e=>{const card=e.target.closest("[data-dashboard-module]"),id=card?.dataset.dashboardModule;if(!id)return;const size=e.target.closest("[data-module-size]");if(size){e.stopPropagation();dashboardPrefs.sizes??={};dashboardPrefs.sizes[id]=size.dataset.moduleSize;applyDashboardLayout();return}const move=e.target.closest("[data-module-move]");if(move){e.stopPropagation();let order=dashboardPrefs.order||DASH_MODULE_IDS.slice(),i=order.indexOf(id),j=clamp(i+(+move.dataset.moduleMove),0,order.length-1);order.splice(i,1);order.splice(j,0,id);dashboardPrefs.order=order;applyDashboardLayout();return}const hide=e.target.closest("[data-module-hide]");if(hide){e.stopPropagation();dashboardPrefs.hidden=[...new Set([...(dashboardPrefs.hidden||[]),id])];applyDashboardLayout();say("Module hidden — restore from Layout")}});
$("#editModulesBtn").onclick=()=>setModuleEdit(!W.moduleEdit);$("#editModulesTopBtn").onclick=()=>{setHomeChrome(true);setModuleEdit(!W.moduleEdit);closeTopMenus()};


/* Dashboard drag/reorder: valid because metric cards are non-button containers. */
let draggedModuleId=null;
$("#dashboardCards").addEventListener("dragstart",e=>{
 const card=e.target.closest("[data-dashboard-module]");if(!W.moduleEdit||!card)return;
 draggedModuleId=card.dataset.dashboardModule;card.classList.add("module-dragging");card.setAttribute("aria-grabbed","true");
 e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedModuleId)
});
$("#dashboardCards").addEventListener("dragover",e=>{
 if(!W.moduleEdit||!draggedModuleId)return;e.preventDefault();
 const target=e.target.closest("[data-dashboard-module]");if(target&&target.dataset.dashboardModule!==draggedModuleId)target.classList.add("module-drop-target")
});
$("#dashboardCards").addEventListener("dragleave",e=>{e.target.closest?.("[data-dashboard-module]")?.classList.remove("module-drop-target")});
$("#dashboardCards").addEventListener("drop",e=>{
 if(!W.moduleEdit||!draggedModuleId)return;e.preventDefault();
 const target=e.target.closest("[data-dashboard-module]");if(!target)return;
 const to=target.dataset.dashboardModule,order=(dashboardPrefs.order||DASH_MODULE_IDS.slice()).filter(Boolean);
 const fromIndex=order.indexOf(draggedModuleId),toIndex=order.indexOf(to);
 if(fromIndex>=0&&toIndex>=0&&fromIndex!==toIndex){order.splice(fromIndex,1);order.splice(toIndex,0,draggedModuleId);dashboardPrefs.order=order;applyDashboardLayout();say("Module moved")}
});
$("#dashboardCards").addEventListener("dragend",e=>{
 draggedModuleId=null;$("#dashboardCards").querySelectorAll(".module-dragging,.module-drop-target").forEach(x=>{x.classList.remove("module-dragging","module-drop-target");x.setAttribute("aria-grabbed","false")})
});
$("#dashboardCards").addEventListener("keydown",e=>{
 const card=e.target.closest("[data-dashboard-module]");if(!card)return;
 if(!W.moduleEdit&&(e.key==="Enter"||e.key===" ")){e.preventDefault();card.click();return}
 if(W.moduleEdit&&e.altKey&&["ArrowLeft","ArrowRight"].includes(e.key)){
   e.preventDefault();const order=dashboardPrefs.order||DASH_MODULE_IDS.slice(),id=card.dataset.dashboardModule,i=order.indexOf(id),j=clamp(i+(e.key==="ArrowLeft"?-1:1),0,order.length-1);
   if(i!==j){order.splice(i,1);order.splice(j,0,id);dashboardPrefs.order=order;applyDashboardLayout();card.focus()}
 }
});

/* Top grouped navigation */
function closeTopMenus(){document.querySelectorAll("[data-top-menu-panel]").forEach(p=>p.hidden=true);document.querySelectorAll("[data-top-menu]").forEach(b=>b.setAttribute("aria-expanded","false"))}
document.querySelectorAll("[data-top-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();const p=document.querySelector(`[data-top-menu-panel="${b.dataset.topMenu}"]`),open=p.hidden;closeTopMenus();p.hidden=!open;b.setAttribute("aria-expanded",String(open))});document.addEventListener("click",e=>{if(!e.target.closest(".top-menu"))closeTopMenus()});document.querySelectorAll(".top-menu-popover button").forEach(b=>b.addEventListener("click",()=>setTimeout(closeTopMenus,0)));

/* Command palette */
const commandPalette=$("#commandPalette");
const PALETTE_ACTIONS=[{k:"home",label:"Open home",run:encyclopediaHome},{k:"quickref",label:"Open Quick Reference",run:quickReferenceView},{k:"mostused",label:"Open Most Used Commands",run:mostUsedView},{k:"az",label:"Open A–Z Tool Index",run:toolIndex},{k:"matrix",label:"Open Enterprise Platform Matrix",run:platformMatrixView},{k:"libraries",label:"Open Library Explorer",run:libraryIndex},{k:"help",label:"Open Help Reference",run:helpIndex},{k:"guidance",label:"Open Operational Guidance",run:tipsIndex},{k:"runbooks",label:"Open runbooks",run:showRunbooks},{k:"layout",label:"Workspace layout settings",run:showWorkspaceSettings},{k:"diagnostics",label:"Open diagnostics",run:()=>setContextMode("diagnostics",true)}];
function renderPalette(raw=""){const r=raw.trim(),ids=r&&!r.startsWith(">")?searchCommandIds(r).slice(0,9):[],acts=PALETTE_ACTIONS.filter(a=>!r||r.startsWith(">")?a.label.toLowerCase().includes(r.replace(/^>/,"").trim().toLowerCase()):false).slice(0,7);let h="";if(acts.length)h+=`<div class="palette-group-label">WORKSPACE ACTIONS</div>${acts.map(a=>`<button class="palette-item" data-palette-action="${a.k}"><div><b>${esc(a.label)}</b><small>Workspace action</small></div><span>↵</span></button>`).join("")}`;if(ids.length)h+=`<div class="palette-group-label">COMMANDS</div>${ids.map(id=>{const m=cmdMeta(id),s=sectionForCommand(m);return `<button class="palette-item" data-palette-command="${esc(id)}"><div><b>${esc(commandPathText(m))}</b><small>${esc(m.text)}</small></div><span>${esc(s?.number||"")}</span></button>`}).join("")}`;commandPalette.innerHTML=h||'<div class="tree-empty">Type a command, tool, flag or <code>&gt;layout</code> workspace action.</div>';commandPalette.hidden=false;q.setAttribute("aria-expanded","true")}
q.addEventListener("focus",()=>renderPalette(q.value));q.addEventListener("input",()=>renderPalette(q.value));q.addEventListener("keydown",e=>{if(e.key==="Escape"){commandPalette.hidden=true;q.setAttribute("aria-expanded","false");q.blur()}});commandPalette.addEventListener("click",e=>{const c=e.target.closest("[data-palette-command]");if(c){const m=cmdMeta(c.dataset.paletteCommand);commandPalette.hidden=true;navigateSection(m.sectionIndex,m.id);return}const a=e.target.closest("[data-palette-action]");if(a){commandPalette.hidden=true;const x=PALETTE_ACTIONS.find(v=>v.k===a.dataset.paletteAction);x?.run()}});document.addEventListener("click",e=>{if(!e.target.closest(".global-search")){commandPalette.hidden=true;q.setAttribute("aria-expanded","false")}});

/* Workspace diagnostics */
function workspaceDiagnostics(){setHomeChrome(false);recordView("workspace-diagnostics");const orphanSections=D.sections.filter(s=>!(H.sectionCommands?.[s.number]||[]).length),treeMapped=D.sections.length-orphanSections.length;panel.innerHTML=`<header class="section-head"><div class="over">WORKSPACE DIAGNOSTICS</div><h2>UI, Navigation & Help Integrity</h2><div class="meta"><span>${D.sections.length} sections</span><span>${H.coverage?.totalCommands||0} commands</span><span>${D.libraries.length} libraries</span></div></header><div class="diagnostic-grid">${[["Tree-mapped sections",treeMapped],["Orphan sections",orphanSections.length],["Expanded tree nodes",treeExpanded.size],["Help dead buttons",H.coverage?.deadHelpButtons||0],["Library coverage",(H.coverage?.libraryCoveragePercent||0)+"%"],["Current left pane",W.leftCollapsed?"Collapsed":W.left+"px"],["Current right pane",W.rightCollapsed?"Collapsed":W.right+"px"],["Layout preset",W.preset]].map(([k,v])=>`<div class="diagnostic-card"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div><div class="library-detail-box"><h4>CURRENT UI STATE</h4><pre class="help-synopsis">${esc(JSON.stringify({workspace:W,treeMode:W.treeMode,scope:W.scope||"All",expandedNodes:treeExpanded.size,dashboard:dashboardPrefs},null,2))}</pre></div>`;setBreadcrumb(["Diagnostics","Workspace"]);summary.hidden=false;summary.innerHTML='<strong>0</strong> dead Help buttons • workspace tree diagnostics available';setContextMode("diagnostics",true)}

function showSources(){openModal("Technical, official & reference-design sources",D.sources.map(s=>`<div class="source-row"><b>${esc(s.name)}</b><span>${esc(s.scope)}</span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></div>`).join(""))}
function showRunbook(i){
 const r=(D.runbooks||[])[i];if(!r)return;
 const title=r.title||r.name||`Runbook ${i+1}`,steps=r.steps||r.commands||r.actions||[];
 openModal(title,`<div class="library-detail"><div class="library-detail-box"><h4>RUNBOOK</h4><p>${esc(r.description||r.symptom||r.goal||"")}</p></div>${Array.isArray(steps)&&steps.length?`<div class="library-detail-box"><h4>STEPS</h4><ol class="guidance-list">${steps.map(x=>`<li>${esc(typeof x==="string"?x:JSON.stringify(x))}</li>`).join("")}</ol></div>`:`<pre class="help-synopsis">${esc(JSON.stringify(r,null,2))}</pre>`}</div>`)
}
function showRunbooks(){
 const R=D.runbooks||[];
 openModal("Incident runbooks",`<div class="runbook-grid">${R.map(r=>`<article class="runbook"><h3>${esc(r.title)}</h3><p>${esc(r.symptoms.join(" • "))}</p><pre>${esc(r.steps.join("\n"))}</pre><button data-run="${encodeURIComponent(r.steps.join("\n"))}">Copy runbook</button></article>`).join("")}</div>`);
 $("#modalBody").querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>copy(decodeURIComponent(b.dataset.run),"Runbook copied"));
}


function librariesForText(text,explicit=[]){
 const ids=new Set(explicit||[]),t=String(text).toLowerCase();
 (D.libraries||[]).forEach(l=>{
   if((l.match||[]).some(m=>t.includes(String(m).toLowerCase())))ids.add(l.id);
   if((l.executables||[]).some(e=>new RegExp(`(^|[^A-Za-z0-9_.-])${String(e).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?=\\s|$|[;|)])`,"i").test(text)))ids.add(l.id)
 });
 return [...ids].map(libraryById).filter(Boolean)
}
function libraryUsage(lib){return LIB_USAGE_MAP.get(lib?.id)||[]}
function showLibrary(id){setHomeChrome(false);recordView(`library:${id}`);
 const lib=libraryById(id);if(!lib)return;const usage=libraryUsage(lib),tree=H.trees?.[lib.id];
 panel.innerHTML=`<header class="section-head"><div class="over">LIBRARY EXPLORER • ${esc(lib.domain)}</div><h2>${esc(lib.name)}</h2>
 <div class="meta"><span>${usage.length} linked commands</span><span>${tree?.count||0} hierarchy mappings</span><span>Official documentation</span></div></header>
 <div class="library-detail">
  <div class="library-detail-head"><span class="eyebrow">${esc(lib.domain)}</span><h2>${esc(lib.name)}</h2><p>${esc(lib.description)}</p>
   <div class="library-head-actions"><a class="library-doc-link" href="${esc(lib.docs||"#")}" target="_blank" rel="noopener">Official documentation ↗</a><button data-lib-help="${esc(lib.id)}">Help Reference</button><button data-lib-tree="${esc(lib.id)}">Command Hierarchy</button></div>
  </div>
  <div class="library-detail-grid">
   <div class="library-detail-box"><h4>WHEN TO USE</h4><p>${esc(lib.when||"")}</p></div>
   <div class="library-detail-box"><h4>KEY CONCEPTS</h4><ul>${(lib.concepts||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
   <div class="library-detail-box"><h4>INSTALL / ENABLE</h4><div class="library-install">${(lib.install||[]).map(x=>`<code>${esc(x)}</code>`).join("")}</div></div>
   <div class="library-detail-box"><h4>EXECUTABLES / MATCHING</h4><ul>${[...(lib.executables||[]),...(lib.match||[])].slice(0,18).map(x=>`<li><code>${esc(x)}</code></li>`).join("")}</ul></div>
  </div>
  ${lib.helpReference?`<div class="library-detail-box help-reference"><h4>HELP & USAGE</h4><div class="help-synopsis">${esc(lib.helpReference.synopsis||"")}</div><div class="help-command-list">${(lib.helpReference.discovery||[]).map(x=>`<div class="help-command"><code>${esc(x)}</code><button data-help-copy="${esc(x)}">Copy</button></div>`).join("")}</div><div class="help-option-groups">${(lib.helpReference.optionGroups||[]).map(x=>`<div class="help-option"><p>${esc(x)}</p></div>`).join("")}</div><ul class="guidance-list">${(lib.helpReference.notes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
  <div class="library-detail-grid library-tip-stack"><div class="library-detail-box"><h4>OPERATIONAL TIPS</h4><ul class="guidance-list">${(lib.tips||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="library-detail-box expert-box"><h4 class="expert-label">EXPERT TECHNIQUES</h4><ul class="guidance-list">${(lib.expertTechniques||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
  <div class="library-detail-box"><h4>LINKED COMMANDS</h4><div class="library-command-links">${usage.slice(0,180).map(m=>{const s=sectionForCommand(m);return `<div class="library-command-link-row"><button data-lib-cmd="${esc(m.id)}"><b>${esc(commandPathText(m))}</b><span>Section ${esc(s?.number||m.section)} • ${esc(riskLabel(m.risk))}</span></button><button data-lib-cmd-help="${esc(m.id)}">Help</button></div>`}).join("")||"<p>No command mappings detected.</p>"}</div></div>
 </div>`;
 panel.querySelectorAll("[data-lib-cmd]").forEach(b=>b.onclick=()=>{const m=cmdMeta(b.dataset.libCmd);S.current=m.sectionIndex;render();setTimeout(()=>document.querySelector(`[data-command-id="${CSS.escape(m.id)}"]`)?.focus(),20)});
 panel.querySelectorAll("[data-lib-cmd-help]").forEach(b=>b.onclick=()=>openCommandHelp(b.dataset.libCmd));
 panel.querySelectorAll("[data-help-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.helpCopy,"Help command copied"));
 panel.querySelectorAll("[data-lib-help]").forEach(b=>b.onclick=()=>showLibraryHelp(b.dataset.libHelp));
 panel.querySelectorAll("[data-lib-tree]").forEach(b=>b.onclick=()=>showCommandHierarchy(b.dataset.libTree));
 summary.hidden=false;summary.innerHTML=`<strong>${usage.length}</strong> commands linked to ${esc(lib.name)}`;toc.innerHTML="";document.title=`${lib.name} Library — Cloud Native Operator Encyclopedia`
}
function showLibraryChooser(libs){
 openModal("Libraries used by this command",`<div class="library-index">${libs.map(l=>`<button class="library-card-full" data-lib="${esc(l.id)}"><span class="lib-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3><p>${esc(l.description)}</p></button>`).join("")}</div>`);
 $("#modalBody").querySelectorAll("[data-lib]").forEach(b=>b.onclick=()=>{$("#modal").hidden=true;showLibrary(b.dataset.lib)})
}
function libraryIndex(){setHomeChrome(false);recordView("libraries");
 const libs=[...(D.libraries||[])].sort((a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name));
 panel.innerHTML=`<header class="section-head"><div class="over">TECHNICAL LIBRARY INDEX</div><h2>Library Explorer</h2><div class="meta"><span>${libs.length} libraries & frameworks</span><span>Linked directly to command-level metadata</span></div></header><div class="library-index">${libs.map(l=>{const n=H.trees?.[l.id]?.count||libraryUsage(l).length;return `<button class="library-card-full" data-lib="${esc(l.id)}"><span class="lib-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3><p>${esc(l.description)}</p><span>${n} linked commands</span></button>`}).join("")}</div>`;
 panel.querySelectorAll("[data-lib]").forEach(b=>b.onclick=()=>showLibrary(b.dataset.lib));summary.hidden=false;summary.innerHTML=`<strong>${libs.length}</strong> technical libraries`;toc.innerHTML=""
}
function showLibraryHelp(id){setHomeChrome(false);recordView(`help:${id}`);
 const lib=libraryById(id);if(!lib)return;const h=lib.helpReference||{};
 panel.innerHTML=`<header class="section-head"><div class="over">HELP REFERENCE • ${esc(lib.domain)}</div><h2>${esc(lib.name)}</h2><div class="meta"><span>Syntax & option discovery</span><span>Installed-version friendly</span></div></header>
 <div class="help-reference"><div class="library-detail-box"><h4>SYNOPSIS</h4><div class="help-synopsis">${esc(h.synopsis||"")}</div></div><div class="library-detail-box"><h4>HELP DISCOVERY COMMANDS</h4><div class="help-command-list">${(h.discovery||[]).map(x=>`<div class="help-command"><code>${esc(x)}</code><button data-help-copy="${esc(x)}">Copy</button></div>`).join("")}</div></div><div class="library-detail-box"><h4>OPTION GROUPS</h4><div class="help-option-groups">${(h.optionGroups||[]).map(x=>`<div class="help-option"><p>${esc(x)}</p></div>`).join("")}</div></div><div class="library-detail-box"><h4>USAGE NOTES</h4><ul class="guidance-list">${(h.notes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="library-detail-box"><h4>NEXT</h4><button id="helpToLibrary">Open full ${esc(lib.name)} library</button> <button id="helpToTree">Command hierarchy</button> ${lib.docs?`<a class="library-doc-link" href="${esc(lib.docs)}" target="_blank" rel="noopener">Official documentation ↗</a>`:""}</div></div>`;
 panel.querySelectorAll("[data-help-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.helpCopy,"Help command copied"));$("#helpToLibrary").onclick=()=>showLibrary(lib.id);$("#helpToTree").onclick=()=>showCommandHierarchy(lib.id);summary.hidden=false;summary.innerHTML=`Help reference for <strong>${esc(lib.name)}</strong>`;toc.innerHTML=""
}
function showHelpChooser(libs){
 openModal("Help references",`<div class="help-index">${libs.map(l=>`<button class="help-card" data-help-lib="${esc(l.id)}"><span class="help-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3><p>${esc(l.helpReference?.synopsis||"Command help reference")}</p></button>`).join("")}</div>`);
 $("#modalBody").querySelectorAll("[data-help-lib]").forEach(b=>b.onclick=()=>{$("#modal").hidden=true;showLibraryHelp(b.dataset.helpLib)})
}
function helpDiagnostics(){setHomeChrome(false);recordView("help-diagnostics");
 const c=H.coverage||{},risks=c.riskCounts||{};
 panel.innerHTML=`<header class="section-head"><div class="over">HELP SYSTEM DIAGNOSTICS</div><h2>Coverage & Parser Diagnostics</h2><div class="meta"><span>${c.totalCommands||0} command rows</span><span>${c.libraries||0} libraries</span><span>${c.libraryCoveragePercent||0}% library mapped</span></div></header>
 <div class="diagnostic-grid">
  ${[
   ["Exact help",c.exactHelp],["Command-aware help",c.commandAwareHelp],["Library fallback",c.libraryFallback],["Generic fallback",c.genericFallback],
   ["Pipeline commands",c.pipelineCommands],["Compound commands",c.compoundCommands],["Dead Help buttons",c.deadHelpButtons],["Unknown Help buttons",c.unknownHelpButtons]
  ].map(([k,v])=>`<div class="diagnostic-card"><span>${esc(k)}</span><b>${v??0}</b></div>`).join("")}
 </div>
 <div class="library-detail-box"><h4>RISK CLASSIFICATION</h4><div class="risk-diagnostic">${Object.entries(risks).map(([r,n])=>`<span class="command-risk risk-pill-${esc(r)}">${esc(riskLabel(r))} <b>${n}</b></span>`).join("")}</div></div>
 <div class="library-detail-box"><h4>SEARCH OPERATORS</h4><div class="help-option-groups">${Object.entries(H.searchOperators||{}).map(([k,v])=>`<div class="help-option"><code>${esc(k)}:</code><p>${esc(v)}</p></div>`).join("")}</div></div>`;
 summary.hidden=false;summary.innerHTML=`<strong>${c.totalCommands||0}</strong> command help mappings • <strong>0</strong> dead Help buttons`;toc.innerHTML=""
}
function helpIndex(){setHomeChrome(false);recordView("help-index");
 const libs=[...(D.libraries||[])].filter(l=>l.helpReference).sort((a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name)),c=H.coverage||{};
 panel.innerHTML=`<header class="section-head"><div class="over">COMMAND DISCOVERY</div><h2>Help Reference</h2><div class="meta"><span>${libs.length} tool/library references</span><span>${c.totalCommands||0} contextual command mappings</span><span>${c.deadHelpButtons||0} dead Help buttons</span></div><div class="section-actions"><button id="helpCoverageBtn">Coverage diagnostics</button><button id="helpHierarchyBtn">Command hierarchy</button></div></header>
 <div class="search-operator-guide"><b>Search operators:</b><code>tool:kubectl</code><code>library:docker</code><code>risk:destructive</code><code>flag:--namespace</code><code>help:reconcile</code></div>
 <div class="help-index">${libs.map(l=>`<button class="help-card" data-help-lib="${esc(l.id)}"><span class="help-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3><p>${esc(l.helpReference.synopsis||"")}</p><span>${(l.helpReference.discovery||[]).length} discovery commands • ${H.trees?.[l.id]?.count||0} linked commands</span></button>`).join("")}</div>`;
 panel.querySelectorAll("[data-help-lib]").forEach(b=>b.onclick=()=>showLibraryHelp(b.dataset.helpLib));$("#helpCoverageBtn").onclick=helpDiagnostics;$("#helpHierarchyBtn").onclick=hierarchyIndex;summary.hidden=false;summary.innerHTML=`<strong>${libs.length}</strong> Help & Usage references`;toc.innerHTML=""
}
function hierarchyNodeHtml(nodes,prefix=[],depth=0){
 if(!nodes||depth>5)return "";
 return `<ul class="command-tree-level tree-depth-${depth}">${Object.entries(nodes).sort((a,b)=>(b[1].count||0)-(a[1].count||0)||a[0].localeCompare(b[0])).map(([name,obj])=>{const p=[...prefix,name];return `<li><div class="tree-node-row"><button data-tree-query="${esc(p.join(" "))}"><code>${esc(name)}</code><span>${obj.count||0}</span></button></div>${obj.children&&Object.keys(obj.children).length?hierarchyNodeHtml(obj.children,p,depth+1):""}</li>`}).join("")}</ul>`
}
function showCommandHierarchy(id){setHomeChrome(false);recordView(`hierarchy:${id}`);
 const lib=libraryById(id),tree=H.trees?.[id];if(!lib)return;
 panel.innerHTML=`<header class="section-head"><div class="over">COMMAND HIERARCHY • ${esc(lib.domain)}</div><h2>${esc(lib.name)}</h2><div class="meta"><span>${tree?.count||0} linked commands</span><span>Click a hierarchy node to filter commands</span></div></header>
 <div class="command-tree">${hierarchyNodeHtml(tree?.tree||{})||"<p>No hierarchy mapping available.</p>"}</div>`;
 panel.querySelectorAll("[data-tree-query]").forEach(b=>b.onclick=()=>{const ids=searchCommandIds(`library:${lib.id} help:"${b.dataset.treeQuery}"`);commandResultView(ids,`commands under ${esc(b.dataset.treeQuery)}`)});
 summary.hidden=false;summary.innerHTML=`Command hierarchy for <strong>${esc(lib.name)}</strong>`;toc.innerHTML=""
}
function hierarchyIndex(){setHomeChrome(false);recordView("hierarchy");
 const libs=[...(D.libraries||[])].filter(l=>(H.trees?.[l.id]?.count||0)>0).sort((a,b)=>(H.trees[b.id]?.count||0)-(H.trees[a.id]?.count||0)||a.name.localeCompare(b.name));
 panel.innerHTML=`<header class="section-head"><div class="over">COMMAND MODEL</div><h2>Command Hierarchy Browser</h2><div class="meta"><span>${libs.length} mapped libraries</span><span>Tool → command → subcommand</span></div></header><div class="library-index">${libs.map(l=>`<button class="library-card-full" data-tree-lib="${esc(l.id)}"><span class="lib-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3><p>${esc(l.description)}</p><span>${H.trees[l.id].count} command mappings</span></button>`).join("")}</div>`;
 panel.querySelectorAll("[data-tree-lib]").forEach(b=>b.onclick=()=>showCommandHierarchy(b.dataset.treeLib));summary.hidden=false;summary.innerHTML=`<strong>${libs.length}</strong> command hierarchies`;toc.innerHTML=""
}

/* Contextual per-command Help drawer */

function componentHelpHtml(m,index){
 const c=m.components?.[index],lib=c?.libraries?.map(libraryById).find(Boolean)||libraryById(m.primaryLibrary);
 if(!c)return `<p>No parsed component metadata.</p>`;
 const isPrimary=index===(m.primaryComponentIndex||0),summaryText=isPrimary?m.summary:(lib?.description||`Command component ${c.pathText}.`);
 const synopsis=isPrimary?m.synopsis:(lib?.helpReference?.synopsis||`${c.pathText} [options]`);
 const discovery=[`${c.pathText} --help`,...(lib?.helpReference?.discovery||[])].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,6);
 return `<div class="component-reference"><div class="help-synopsis">${esc(synopsis)}</div><p>${esc(summaryText)}</p>${lib?`<div class="component-library"><b>${esc(lib.name)}</b><span>${esc(lib.domain)}</span></div>`:""}<div class="help-command-list">${discovery.map(x=>`<div class="help-command"><code>${esc(x)}</code><button data-help-copy="${esc(x)}">Copy</button></div>`).join("")}</div></div>`
}
function shellTokenize(text){return String(text||"").match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|2>&1|2>>|2>|>>|>|<|\|\||&&|\||;|[^\s|&;<>]+/g)||[]}
function explainToken(m,t,i){
 const clean=t.replace(/^['"]|['"]$/g,"");
 if(t==="|")return "Pipe standard output into the next command.";
 if(t==="&&")return "Run the next command only if this command succeeds.";
 if(t==="||")return "Run the next command only if this command fails.";
 if(t===";")return "Command separator: run the next command after this one.";
 if(t===">"||t===">>")return t===">"?"Redirect standard output to a file, replacing it.":"Append standard output to a file.";
 if(t==="2>&1")return "Send standard error to the same destination as standard output.";
 if(t==="2>")return "Redirect standard error.";
 if(/^<[^>]+>$/.test(t))return placeholderHelp(t.slice(1,-1));
 if((m.flags||[]).includes(clean))return flagHelp(m,clean);
 const comp=(m.components||[]).find(c=>(c.path||[]).includes(clean));
 if(comp){if(clean===comp.executable||clean===comp.tool)return `Executable / tool: ${comp.tool}.`;return `Command or subcommand in ${comp.tool}: ${clean}.`}
 if(/^[-]{1,2}[A-Za-z0-9]/.test(clean))return flagHelp(m,clean);
 if(i===0)return `Executable or shell element: ${clean}.`;
 return "Argument or value. Confirm its expected type and scope in command-specific Help before execution.";
}
function commandExplanationHtml(m){const tokens=shellTokenize(m.text);if(!tokens.length)return "";return `<div class="command-explain-grid">${tokens.map((t,i)=>`<div class="command-explain-token"><code>${esc(t)}</code><p>${esc(explainToken(m,t,i))}</p></div>`).join("")}</div>`}

function renderCommandHelp(){
 const m=cmdMeta(activeCommandHelpId);if(!m)return;const s=sectionForCommand(m),libs=(m.libraries||[]).map(libraryById).filter(Boolean),primary=libraryById(m.primaryLibrary);
 $("#commandHelpEyebrow").textContent=`${riskLabel(m.risk)} • SECTION ${s?.number||m.section}`;
 $("#commandHelpTitle").textContent=commandPathText(m);
 $("#commandHelpSubtitle").textContent=m.summary;
 const components=m.components||[];
 commandHelpBody.innerHTML=`<section class="drawer-command"><h4>CURRENT COMMAND</h4><pre>${fmt(m.text)}</pre><div class="drawer-command-actions"><button data-help-action="copy">Copy</button><button data-help-action="build">${(m.placeholders||[]).length?"Build":"Review"}</button>${libs.length?`<button data-help-action="library">Library${libs.length>1?` ${libs.length}`:""}</button>`:""}</div></section>
 <section><h4>EXPLAIN THIS COMMAND</h4><p class="explain-intro">A token-level walkthrough of the command structure, options, placeholders and shell operators.</p>${commandExplanationHtml(m)}</section>
 <section class="drawer-impact risk-panel-${esc(m.risk)}"><div><span>IMPACT</span><b>${esc(riskLabel(m.risk))}</b></div><p>${esc(m.riskReason)}</p></section>
 ${components.length?`<section><h4>COMMAND COMPONENTS</h4><div class="component-tabs">${components.map((c,i)=>`<button data-component-index="${i}" class="${i===activeCommandHelpComponent?"active":""}">${esc(c.pathText||c.tool)}</button>`).join("")}</div><div id="componentHelpPanel">${componentHelpHtml(m,activeCommandHelpComponent)}</div></section>`:""}
 ${m.flags?.length?`<section><h4>OPTIONS USED IN THIS COMMAND</h4><div class="flag-help-list">${m.flags.map(f=>`<div class="flag-help-row"><code>${esc(f)}</code><p>${esc(flagHelp(m,f))}</p></div>`).join("")}</div></section>`:""}
 ${m.placeholders?.length?`<section><h4>PLACEHOLDERS</h4><div class="placeholder-help-list">${m.placeholders.map(k=>`<div class="placeholder-help-row"><code>&lt;${esc(k)}&gt;</code><p>${esc(placeholderHelp(k))}</p><button data-placeholder-builder="${esc(k)}">Build</button></div>`).join("")}</div></section>`:""}
 <section><h4>OPERATIONAL GUIDANCE</h4><ul class="guidance-list"><li>${esc(m.riskReason)}</li>${(primary?.tips||[]).slice(0,3).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
 ${m.helpDiscovery?.length?`<section><h4>HELP DISCOVERY</h4><div class="help-command-list">${m.helpDiscovery.map(x=>`<div class="help-command"><code>${esc(x)}</code><button data-help-copy="${esc(x)}">Copy</button></div>`).join("")}</div></section>`:""}
 ${m.related?.length?`<section><h4>RELATED COMMANDS</h4><div class="related-command-list">${m.related.map(id=>{const r=cmdMeta(id);return r?`<button data-related-command="${esc(id)}"><code>${esc(commandPathText(r))}</code><span>${esc(r.text.slice(0,95))}${r.text.length>95?"…":""}</span></button>`:""}).join("")}</div></section>`:""}
 ${m.provenance?`<section><h4>SOURCE & FRESHNESS</h4><div class="provenance-grid"><div><span>SOURCE</span><b>${esc(m.provenance.sourceType||"Reference")}</b></div><div><span>VERIFIED</span><b>${esc(m.provenance.verifiedDate||"")}</b></div><div><span>STATUS</span><b>${esc(m.provenance.freshness||"REFERENCE")}</b></div><div><span>CONFIDENCE</span><b>${esc(m.provenance.confidence||"curated")}</b></div></div>${m.provenance.source?`<a class="library-doc-link" href="${esc(m.provenance.source)}" target="_blank" rel="noopener">Command source ↗</a>`:""}</section>`:""}
 <section class="drawer-reference-actions"><button data-help-action="section">Open section</button>${primary?`<button data-help-action="library">Open ${esc(primary.name)} library</button>`:""}${primary?.docs?`<a href="${esc(primary.docs)}" target="_blank" rel="noopener">Official documentation ↗</a>`:""}</section>`;
 commandHelpBody.querySelectorAll("[data-help-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.helpCopy,"Help command copied"));
 commandHelpBody.querySelectorAll("[data-component-index]").forEach(b=>b.onclick=()=>{activeCommandHelpComponent=+b.dataset.componentIndex;renderCommandHelp()});
 commandHelpBody.querySelectorAll("[data-related-command]").forEach(b=>b.onclick=()=>{activeCommandHelpId=b.dataset.relatedCommand;activeCommandHelpComponent=0;ensureHelpDetail(activeCommandHelpId).then(()=>renderCommandHelp())});
 commandHelpBody.querySelectorAll("[data-placeholder-builder]").forEach(b=>b.onclick=()=>{const id=m.id;if(!isDockedContext())closeCommandHelp();openBuilderContextOrModal(id)});
}
function openCommandHelp(id){
 const m=cmdMeta(id);if(!m)return;if(isDockedContext()){openCommandHelpDocked(id);return}recordCommandUsage(id,"help");helpReturnFocus=document.activeElement;activeCommandHelpId=id;activeCommandHelpComponent=0;
 commandHelpBackdrop.hidden=false;commandHelpDrawer.classList.add("open");commandHelpDrawer.setAttribute("aria-hidden","false");document.body.classList.add("help-drawer-open");commandHelpBody.innerHTML='<section><h4>COMMAND HELP</h4><p>Loading detailed reference…</p></section>';
 ensureHelpDetail(id).then(()=>{if(activeCommandHelpId===id)renderCommandHelp()});setTimeout(()=>$("#commandHelpClose").focus(),20)
}
function closeCommandHelp(){
 commandHelpDrawer.classList.remove("open");commandHelpDrawer.setAttribute("aria-hidden","true");commandHelpBackdrop.hidden=true;document.body.classList.remove("help-drawer-open");
 const r=helpReturnFocus;activeCommandHelpId=null;if(r&&document.contains(r))setTimeout(()=>r.focus(),20)
}
function showQuickHelpForRow(row,m){
 if(!m||window.innerWidth<720||document.body.classList.contains("workspace-resizing"))return;
 const rect=row.getBoundingClientRect(),flags=(m.flags||[]).slice(0,4);
 quickHelp.innerHTML=`<div class="quick-help-head"><b>${esc(commandPathText(m))}</b><span class="command-risk risk-pill-${esc(m.risk)}">${esc(riskLabel(m.risk))}</span></div><p>${esc(m.summary)}</p>${flags.length?`<div class="quick-flags">${flags.map(f=>`<code>${esc(f)}</code>`).join("")}</div>`:""}<small>Use the Help action for syntax, option details and related commands.</small>`;
 quickHelp.hidden=false;quickHelp.setAttribute("aria-hidden","false");
 const width=Math.min(380,window.innerWidth-24);quickHelp.style.width=`${width}px`;
 const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
 let top=rect.bottom+8;if(top+quickHelp.offsetHeight>window.innerHeight-12)top=Math.max(12,rect.top-quickHelp.offsetHeight-8);
 quickHelp.style.left=`${left}px`;quickHelp.style.top=`${top}px`
}
function hideQuickHelp(){clearTimeout(quickTimer);quickHelp.hidden=true;quickHelp.setAttribute("aria-hidden","true")}

function tipsIndex(){setHomeChrome(false);recordView("guidance");
 const libs=[...(D.libraries||[])].sort((a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name));
 const total=libs.reduce((n,l)=>n+(l.tips||[]).length+(l.expertTechniques||[]).length,0);
 panel.innerHTML=`<header class="section-head"><div class="over">OPERATOR KNOWLEDGE</div><h2>Operational Guidance</h2><div class="meta"><span>${total} curated guidance items</span><span>${libs.length} linked libraries</span></div></header><div class="tip-grid">${libs.map(l=>`<article class="tip-card"><div class="tip-head"><div><span class="tip-domain">${esc(l.domain)}</span><h3>${esc(l.name)}</h3></div><button data-tiplib="${esc(l.id)}">Library</button></div><div><b>OPERATIONAL TIPS</b><ul class="tip-list">${(l.tips||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="expert-box" style="padding:9px;border-radius:8px;border-width:1px;border-style:solid"><span class="expert-label">EXPERT TECHNIQUES</span><ul class="tip-list">${(l.expertTechniques||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></article>`).join("")}</div>`;
 panel.querySelectorAll("[data-tiplib]").forEach(b=>b.onclick=()=>showLibrary(b.dataset.tiplib));
 summary.hidden=false;summary.innerHTML=`<strong>${total}</strong> guidance items`;toc.innerHTML="";
}

function quickReferenceCardHtml(m){const s=sectionForCommand(m),lib=libraryById(m.primaryLibrary);return `<article class="quick-ref-card" data-command-id="${esc(m.id)}"><div class="quick-ref-top"><span class="command-risk risk-pill-${esc(m.risk)}">${esc(riskLabel(m.risk))}</span><span class="quick-ref-tool">${esc(lib?.name||m.primaryTool||"Reference")}</span></div><h3>${esc(commandPathText(m))}</h3><p>${esc(m.summary||"")}</p><pre><code>${fmt(m.text)}</code></pre><div class="quick-ref-meta"><span>Section ${esc(s?.number||m.section)}</span><span>${esc(commandUsageLabel(m.id))}</span></div><div class="quick-ref-actions"><button data-quick-action="help">Help</button>${(m.placeholders||[]).length?`<button data-quick-action="build">Build</button>`:""}<button data-quick-action="copy">Copy</button>${lib?`<button data-quick-action="library">Library</button>`:""}</div></article>`}
function quickReferenceView(){setHomeChrome(false);recordView("quick-reference");const scoped=COMMAND_LIST.filter(m=>sectionInScope(sectionForCommand(m)));scoped.sort((a,b)=>commandUsageScore(b.id)-commandUsageScore(a.id)||(RISK_ORDER[a.risk]||0)-(RISK_ORDER[b.risk]||0)||commandPathText(a).localeCompare(commandPathText(b)));const shown=scoped.slice(0,180);panel.innerHTML=`<header class="section-head"><div class="over">FAST RETRIEVAL</div><h2>Quick Reference</h2><div class="meta"><span>${scoped.length} commands in current scope</span><span>Practical examples first</span><span>Local usage stays in this browser</span></div></header><div class="quick-reference-note"><b>Use this view when you know the task and need the command quickly.</b><span>Open Help for exact options and the Library for deeper context.</span></div><div class="quick-reference-grid">${shown.map(quickReferenceCardHtml).join("")}</div>`;summary.hidden=false;summary.innerHTML=`<strong>${shown.length}</strong> quick-reference commands${scoped.length>shown.length?` • top ${shown.length} shown`:""}`;toc.innerHTML=""}
function mostUsedView(){setHomeChrome(false);recordView("most-used");const ids=COMMAND_LIST.filter(m=>commandUsageScore(m.id)>0).sort((a,b)=>commandUsageScore(b.id)-commandUsageScore(a.id)||(commandUsage[b.id]?.last||"").localeCompare(commandUsage[a.id]?.last||"")).map(m=>m.id);if(!ids.length){panel.innerHTML=`<header class="section-head"><div class="over">PRIVATE LOCAL WORKSPACE</div><h2>Most Used Commands</h2></header><div class="result"><b>No local usage yet.</b><p>Copy, Help and Build actions are counted only in this browser. No telemetry is sent.</p><button id="mostUsedQuickStart">Open Quick Reference</button></div>`;$("#mostUsedQuickStart").onclick=quickReferenceView;summary.hidden=true;toc.innerHTML="";return}commandResultView(ids,`most used commands • private local ranking`)}
function printCurrentReference(){document.body.classList.add("print-reference");setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove("print-reference"),250)},20)}


function matrixCommandMeta(text){return COMMAND_TEXT_MAP.get(normalizeCommandText(text))||null}
function matrixPlatformById(id){return (PM.platforms||[]).find(p=>p.id===id)||null}
function matrixCommandHtml(text,platformId){
 const m=matrixCommandMeta(text),p=matrixPlatformById(platformId),lib=m?libraryById(m.primaryLibrary):libraryById(p?.library);
 return `<div class="matrix-command" data-matrix-command="${esc(text)}">
   <code>${fmt(text)}</code>
   <div class="matrix-command-actions">
     ${m?`<button data-matrix-action="open" data-command-id="${esc(m.id)}">Open</button><button data-matrix-action="help" data-command-id="${esc(m.id)}">Help</button>`:""}
     <button data-matrix-action="copy">Copy</button>
     ${lib?`<button data-matrix-action="library" data-library-id="${esc(lib.id)}">Library</button>`:""}
   </div>
 </div>`
}
function renderPlatformMatrix(){
 const root=$("#platformMatrixRoot");if(!root)return;
 const qv=($("#matrixSearch")?.value||"").trim().toLowerCase();
 const cat=$("#matrixCategory")?.value||"All";
 const enabled=new Set([...root.querySelectorAll("[data-matrix-platform].active")].map(b=>b.dataset.matrixPlatform));
 const visiblePlatforms=(PM.platforms||[]).filter(p=>!enabled.size||enabled.has(p.id));
 const tasks=(PM.tasks||[]).filter(t=>{
   if(cat!=="All"&&t.category!==cat)return false;
   if(!qv)return true;
   const hay=[t.task,t.category,...Object.values(t.commands||{}).flat()].join(" ").toLowerCase();
   return hay.includes(qv)
 });
 $("#matrixTaskCount").textContent=String(tasks.length);
 $("#matrixPlatformCount").textContent=String(visiblePlatforms.length);
 const cards=tasks.map(t=>`<article class="matrix-task-card">
   <header><div><span class="matrix-category">${esc(t.category)}</span><h3>${esc(t.task)}</h3></div><span class="matrix-task-platform-count">${visiblePlatforms.length} platforms</span></header>
   <div class="matrix-grid" style="--matrix-cols:${Math.max(1,Math.min(visiblePlatforms.length,3))}">
     ${visiblePlatforms.map(p=>`<section class="matrix-platform-cell">
       <div class="matrix-platform-head"><b>${esc(p.name)}</b><span class="freshness-badge freshness-${esc((p.status||"").toLowerCase())}">${esc(p.status||"")}</span></div>
       <div class="matrix-command-list">${(t.commands?.[p.id]||[]).length?(t.commands[p.id].map(c=>matrixCommandHtml(c,p.id)).join("")):'<span class="matrix-na">No mapped command in this task.</span>'}</div>
     </section>`).join("")}
   </div>
 </article>`).join("");
 $("#matrixResults").innerHTML=cards||'<div class="tree-empty">No platform tasks match the current filter.</div>';
}
function platformMatrixView(){
 setHomeChrome(false);recordView("platform-matrix");
 const cats=["All",...new Set((PM.tasks||[]).map(t=>t.category))];
 panel.innerHTML=`<header class="section-head">
   <div class="over">CROSS-PLATFORM OPERATIONS</div>
   <h2>Enterprise Platform Matrix</h2>
   <div class="meta"><span><b id="matrixTaskCount">${(PM.tasks||[]).length}</b> tasks</span><span><b id="matrixPlatformCount">${(PM.platforms||[]).length}</b> platforms</span><span><b>${PM.commandPlacements||0}</b> command placements</span><span>vendor-oriented command semantics</span></div>
 </header>
 <section class="matrix-intro">
   <div><h3>Compare the same operational task across enterprise platforms.</h3><p>Use the matrix for rapid translation across Linux distributions, enterprise Unix, virtualization, storage and container platforms. Version-sensitive platforms are explicitly marked; use Help and Library links for deeper context.</p></div>
   <div class="matrix-legend"><span class="freshness-badge freshness-current">CURRENT</span><span>Current-oriented reference</span><span class="freshness-badge freshness-version-sensitive">VERSION-SENSITIVE</span><span>Verify installed release</span></div>
 </section>
 <section id="platformMatrixRoot" class="platform-matrix-root">
   <div class="matrix-toolbar">
     <div class="matrix-preset-row" aria-label="Platform presets"><button data-matrix-preset="all">All platforms</button><button data-matrix-preset="linux">Linux</button><button data-matrix-preset="unix">Enterprise Unix</button><button data-matrix-preset="infra">Infrastructure</button><button data-matrix-preset="orchestration">Orchestration</button></div><div class="matrix-platform-filter">${(PM.platforms||[]).map(p=>`<button class="matrix-platform-chip active" data-matrix-platform="${esc(p.id)}" aria-pressed="true"><span>${esc(p.name)}</span><small>${esc(p.status)}</small></button>`).join("")}</div>
     <div class="matrix-filter-row"><label><span>Task category</span><select id="matrixCategory">${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select></label><label class="matrix-search-label"><span>Filter matrix</span><input id="matrixSearch" type="search" placeholder="storage, routing, logs, support…" autocomplete="off"></label><button id="matrixReset">Reset filters</button></div>
   </div>
   <div id="matrixResults"></div>
 </section>`;
 setBreadcrumb(["Engineering Reference","Platform Matrix"]);
 summary.hidden=false;summary.innerHTML=`<strong>${(PM.tasks||[]).length}</strong> tasks • ${(PM.platforms||[]).length} platforms • <strong>${PM.commandPlacements||0}</strong> command placements`;
 toc.innerHTML="";
 const root=$("#platformMatrixRoot");
 root.addEventListener("click",e=>{
   const preset=e.target.closest("[data-matrix-preset]");
   if(preset){const groups={all:["rhel","ubuntu","sles","aix","solaris","hpux","esxi","ontap","kubernetes","openshift"],linux:["rhel","ubuntu","sles"],unix:["aix","solaris","hpux"],infra:["esxi","ontap"],orchestration:["kubernetes","openshift"]};const wanted=new Set(groups[preset.dataset.matrixPreset]||groups.all);root.querySelectorAll("[data-matrix-platform]").forEach(b=>{const on=wanted.has(b.dataset.matrixPlatform);b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on))});renderPlatformMatrix();return}
   const chip=e.target.closest("[data-matrix-platform]");
   if(chip){chip.classList.toggle("active");chip.setAttribute("aria-pressed",String(chip.classList.contains("active")));renderPlatformMatrix();return}
   const action=e.target.closest("[data-matrix-action]");
   if(action){
     const row=action.closest("[data-matrix-command]"),text=row?.dataset.matrixCommand||"",kind=action.dataset.matrixAction;
     if(kind==="copy"){copy(text,"Matrix command copied");return}
     if(kind==="open"){const m=cmdMeta(action.dataset.commandId);if(m)navigateSection(m.sectionIndex,m.id);return}
     if(kind==="help"){openCommandHelp(action.dataset.commandId);return}
     if(kind==="library"){showLibrary(action.dataset.libraryId);return}
   }
 });
 $("#matrixCategory").onchange=renderPlatformMatrix;
 let mt=0;$("#matrixSearch").oninput=()=>{clearTimeout(mt);mt=setTimeout(renderPlatformMatrix,120)};
 $("#matrixReset").onclick=()=>{root.querySelectorAll("[data-matrix-platform]").forEach(b=>{b.classList.add("active");b.setAttribute("aria-pressed","true")});$("#matrixCategory").value="All";$("#matrixSearch").value="";renderPlatformMatrix()};
 renderPlatformMatrix()
}

function toolIndex(){setHomeChrome(false);recordView("tools");
 const libs=[...(D.libraries||[])].sort((a,b)=>a.name.localeCompare(b.name)),groups={};libs.forEach(l=>{const c=(l.name.match(/[A-Za-z0-9]/)||["#"])[0].toUpperCase();(groups[c]??=[]).push(l)});const letters=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
 panel.innerHTML=`<header class="section-head"><div class="over">FAST COMMAND REFERENCE</div><h2>A–Z Tool & Library Index</h2><div class="meta"><span>${libs.length} technical libraries</span><span>Alphabetical direct navigation</span></div></header><nav class="az-letter-bar" aria-label="A to Z tool navigation">${letters.map(x=>`<button data-az-letter="${esc(x)}">${esc(x)}</button>`).join("")}</nav><div class="az-index">${letters.map(letter=>`<section class="az-group" id="az-${esc(letter)}"><h3>${esc(letter)}</h3><div class="az-tool-grid">${groups[letter].map(l=>`<button class="az-tool-card" data-az-lib="${esc(l.id)}"><b>${esc(l.name)}</b><span>${esc(l.domain)}</span><small>${libraryUsage(l).length} linked commands</small></button>`).join("")}</div></section>`).join("")}</div>`;
 panel.querySelectorAll("[data-az-letter]").forEach(b=>b.onclick=()=>panel.querySelector(`#az-${CSS.escape(b.dataset.azLetter)}`)?.scrollIntoView({block:"start",behavior:"auto"}));panel.querySelectorAll("[data-az-lib]").forEach(b=>b.onclick=()=>showLibrary(b.dataset.azLib));summary.hidden=false;summary.innerHTML=`<strong>${libs.length}</strong> tools and libraries indexed A–Z`;toc.innerHTML=""
}
function encyclopediaHome(){setHomeChrome(true);recordView("home");
 panel.innerHTML=`<header class="section-head"><div class="over">OPERATOR ENCYCLOPEDIA</div><h2>Advanced Command Intelligence Home</h2>
 <div class="meta"><span>${D.sections.length} sections</span><span>${D.totalCommands} reference lines</span><span>${(D.runbooks||[]).length} runbooks</span><span>${D.sentinel?.functional_command_lines||0} Sentinel commands</span></div></header>
 <div class="tool-index macro-index">${MACROS.map(c=>`<button class="tool-chip" data-macro="${esc(c)}"><b>${esc(c)}</b><span>${D.sections.filter(s=>macroDomain(s.category)===c).length} sections • ${D.sections.filter(s=>macroDomain(s.category)===c).reduce((n,s)=>n+s.command_count,0)} commands</span></button>`).join("")}</div>`;
 panel.querySelectorAll("[data-macro]").forEach(b=>b.onclick=()=>{W.scope=b.dataset.macro;domain.value=W.scope;W.treeMode="commands";saveWorkspace();buildNav();const i=D.sections.findIndex(s=>macroDomain(s.category)===W.scope);if(i>=0)navigateSection(i)});
 summary.hidden=true;toc.innerHTML="";
}
function sentinelHome(){
 const cat="DEVOPS SENTINEL / OPERATOR";W.scope="DevOps Sentinel";domain.value=W.scope;W.treeMode="commands";saveWorkspace();buildNav();const i=D.sections.findIndex(s=>s.category===cat);if(i>=0)navigateSection(i)
}

$("#runbookBtn").onclick=showRunbooks;
$("#sourcesBtn").onclick=showSources;
$("#platformMatrixBtn").onclick=()=>{platformMatrixView();closeTopMenus()};
$("#platformMatrixIndexBtn").onclick=platformMatrixView;
$("#quickRefBtn").onclick=()=>{quickReferenceView();closeTopMenus()};
$("#mostUsedBtn").onclick=()=>{mostUsedView();closeTopMenus()};
$("#azIndexBtn").onclick=()=>{toolIndex();closeTopMenus()};
$("#printCurrentBtn").onclick=()=>{printCurrentReference();closeTopMenus()};
$("#quickRefIndexBtn").onclick=quickReferenceView;
$("#toolIndexBtn").onclick=toolIndex;
$("#libraryIndexBtn").onclick=libraryIndex;
$("#librariesBtn").onclick=libraryIndex;
$("#helpBtn").onclick=helpIndex;
$("#helpIndexBtn").onclick=helpIndex;
$("#hierarchyIndexBtn").onclick=hierarchyIndex;
$("#tipsBtn").onclick=tipsIndex;
$("#tipsIndexBtn").onclick=tipsIndex;
$("#encyclopediaHome").onclick=encyclopediaHome;
$("#homeBtn").onclick=encyclopediaHome;
$("#homeTop").onclick=encyclopediaHome;
$("#dangerOnly").onclick=()=>mode("danger");
$("#sentinelOnly").onclick=sentinelHome;
$("#favMode").onclick=()=>mode("favorites");
$("#riskTopBtn").onclick=()=>{mode("danger");closeTopMenus()};
$("#sentinelTopBtn").onclick=()=>{sentinelHome();closeTopMenus()};
$("#diagnosticsTopBtn").onclick=()=>{workspaceDiagnostics();closeTopMenus()};
$("#layoutBtn").onclick=()=>{showWorkspaceSettings();closeTopMenus()};

$("#applyPlaceholders").onclick=()=>{render();say("Placeholders applied to visible commands")};
$("#copySection").onclick=()=>{const s=D.sections[S.current];copy(substitute(secText(s)),"Section copied",{section:s.number,title:s.title,id:"section"})};
$("#openSource").onclick=()=>{const u=D.sections[S.current].source;if(u)window.open(u,"_blank","noopener");else say("This section is grounded in internal/local source analysis")};

function dl(name,type,text){const b=new Blob([text],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$("#exportTxt").onclick=()=>{const s=D.sections[S.current];dl(`${s.number}-${slug(s.title)}.txt`,"text/plain",secText(s))};
$("#exportJson").onclick=()=>{const s=D.sections[S.current];dl(`${s.number}-${slug(s.title)}.json`,"application/json",JSON.stringify(s,null,2))};

document.querySelectorAll(".metric-card").forEach(c=>c.onclick=e=>{if(W.moduleEdit||e.target.closest(".module-edit-controls"))return;const a=c.dataset.home;if(a==="tools")toolIndex();else if(a==="libraries")libraryIndex();else if(a==="help")helpIndex();else if(a==="tips")tipsIndex();else if(a==="runbooks")showRunbooks();else if(a==="risk")mode("danger");else if(a==="sentinel")sentinelHome();else if(a==="platform-matrix")platformMatrixView()});

function closeMobileNav(){$("#sidebar").classList.remove("open")}
$("#menuBtn").onclick=()=>{if(innerWidth>820){W.leftCollapsed=false;applyWorkspaceLayout()}else $("#sidebar").classList.toggle("open")};
document.addEventListener("keydown",e=>{
 const typing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName);
 if(e.key==="Escape"&&commandHelpDrawer.classList.contains("open")){e.preventDefault();closeCommandHelp();return}
 if(e.key==="Escape"&&!isDockedContext()&&contextPane.classList.contains("mobile-open")){contextPane.classList.remove("mobile-open");return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();q.focus();q.select();renderPalette(q.value);return}
 if(e.altKey&&e.key==="ArrowLeft"&&!typing){e.preventDefault();workspaceBack();return}
 if(e.altKey&&e.key==="ArrowRight"&&!typing){e.preventDefault();workspaceForward();return}
 if(e.key==="/"&&!typing){e.preventDefault();q.focus();q.select();renderPalette(q.value);return}
 if(typing)return;
 const focusedRow=document.activeElement?.closest?.(".command-row");
 if(focusedRow&&["h","b","c","l","f","enter"].includes(e.key.toLowerCase()))return;
 if(e.key.toLowerCase()==="j"){S.current=Math.min(D.sections.length-1,S.current+1);render();scrollTo(0,0)}
 else if(e.key.toLowerCase()==="k"){S.current=Math.max(0,S.current-1);render();scrollTo(0,0)}
 else if(e.key.toLowerCase()==="c")$("#copySection").click();
 else if(e.key.toLowerCase()==="f")mode("favorites");
 else if(e.key==="?")openModal("Keyboard shortcuts","<p><b>Global</b><br>Ctrl/Cmd + K Command palette<br>Alt + ← / → Workspace back / forward<br>/ Search<br>J / K Next / previous section<br>C Copy current section<br>F Favorites<br>? Shortcuts</p><p><b>Focused command</b><br>H Help<br>B Build<br>C Copy command<br>L Library<br>F Favorite<br>Enter Open Help<br>Esc Close drawers</p>")
});


window.addEventListener("error",e=>{console.error("UI runtime error",e.error||e.message);const st=document.getElementById("contextStatus");if(st)st.textContent="UI error detected — open Diagnostics"});
window.addEventListener("unhandledrejection",e=>{console.error("Unhandled UI promise rejection",e.reason)});

/* Advanced author drawer + floating bubble */
const authorDrawer=$("#authorDrawer");
const authorBackdrop=$("#authorBackdrop");
const bubbleDock=$("#bubbleDock");
const bubbleMain=$("#bubbleMain");

function openAuthor(){
  authorBackdrop.hidden=false;
  authorDrawer.classList.add("open");
  authorDrawer.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeAuthor(){
  authorDrawer.classList.remove("open");
  authorDrawer.setAttribute("aria-hidden","true");
  authorBackdrop.hidden=true;
  document.body.style.overflow="";
}
function toggleBubble(){
  const open=bubbleDock.classList.toggle("open");
  bubbleMain.setAttribute("aria-expanded",String(open));
  $("#bubbleActions").setAttribute("aria-hidden",String(!open));
}
bubbleMain.onclick=toggleBubble;
$("#bubbleAuthor").onclick=()=>{openAuthor();bubbleDock.classList.remove("open")};
$("#bubbleSearch").onclick=()=>{q.focus();q.select();bubbleDock.classList.remove("open")};
$("#bubbleRunbooks").onclick=()=>{showRunbooks();bubbleDock.classList.remove("open")};
$("#bubbleSentinel").onclick=()=>{sentinelHome();bubbleDock.classList.remove("open")};
$("#bubbleTop").onclick=()=>{scrollTo({top:0,behavior:"auto"});bubbleDock.classList.remove("open")};

$("#authorTopBtn").onclick=openAuthor;
$("#heroAuthorChip").onclick=openAuthor;
$("#authorFooterBtn").onclick=openAuthor;
$("#authorClose").onclick=closeAuthor;
authorBackdrop.onclick=closeAuthor;
$("#authorCopyLink").onclick=()=>copy("https://www.linkedin.com/in/dheeraj-vishwakarma-61350918/","LinkedIn profile link copied");

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && authorDrawer.classList.contains("open")) closeAuthor();
});



/* Context-aware Smart Command Builder */
const BUILDER_META={ns:{label:"Namespace",hint:"Kubernetes namespace",type:"k8s"},namespace:{label:"Namespace",hint:"Kubernetes namespace",type:"k8s"},context:{label:"Kube Context",hint:"kubectl context",type:"text"},ctx:{label:"Kube Context",hint:"kubectl context",type:"text"},"kube-context":{label:"Kube Context",hint:"kubectl / Helm context",type:"text"},pod:{label:"Pod",hint:"Kubernetes pod name",type:"k8s"},container:{label:"Container",hint:"Container name",type:"k8s"},node:{label:"Node",hint:"Kubernetes node",type:"host"},svc:{label:"Service",hint:"Kubernetes service",type:"k8s"},service:{label:"Service",hint:"Service name",type:"k8s"},release:{label:"Helm Release",hint:"Helm release",type:"k8s"},rel:{label:"Helm Release",hint:"Helm release",type:"k8s"},chart:{label:"Chart",hint:"Helm chart/path",type:"text"},image:{label:"Container Image",hint:"registry/repository:tag",type:"text"},registry:{label:"Registry",hint:"Registry hostname",type:"host"},repo:{label:"Repository",hint:"Repository name/path",type:"text"},"repo-url":{label:"Repository URL",hint:"Repository URL",type:"url"},"git-url":{label:"Git URL",hint:"Git repository URL",type:"url"},tag:{label:"Tag",hint:"Image/release tag",type:"text"},port:{label:"Port",hint:"TCP/UDP port 1-65535",type:"port"},ip:{label:"IP Address",hint:"IPv4/IPv6 address",type:"ip"},host:{label:"Host",hint:"DNS name/IP",type:"host"},server:{label:"Server",hint:"Server name/IP",type:"host"},path:{label:"Path",hint:"Filesystem path",type:"path"},file:{label:"File",hint:"File path/name",type:"path"},dir:{label:"Directory",hint:"Directory path",type:"path"},topic:{label:"Topic",hint:"Kafka/messaging topic",type:"text"},broker:{label:"Broker",hint:"Broker host[:port]",type:"text"},secret:{label:"Secret",hint:"Kubernetes secret",type:"k8s"},cm:{label:"ConfigMap",hint:"ConfigMap name",type:"k8s"},pvc:{label:"PVC",hint:"PVC name",type:"k8s"},"pvc-name":{label:"PVC",hint:"PVC name",type:"k8s"},user:{label:"User",hint:"User/account",type:"text"},token:{label:"Token",hint:"Sensitive token",type:"secret"},hex:{label:"Hex Value",hint:"Hexadecimal data",type:"hex"},"schedule-id":{label:"Schedule ID",hint:"Sentinel schedule ID",type:"text"},"container-id":{label:"Container ID",hint:"Runtime container ID",type:"text"},pid:{label:"PID",hint:"Process ID",type:"number"},revision:{label:"Revision",hint:"Revision",type:"text"},rev:{label:"Revision",hint:"Revision",type:"text"},region:{label:"Region",hint:"Cloud region",type:"text"},project:{label:"Project",hint:"Project ID/name",type:"text"},cluster:{label:"Cluster",hint:"Cluster name",type:"text"},name:{label:"Name",hint:"Resource/object name",type:"text"},url:{label:"URL",hint:"HTTP(S)/service URL",type:"url"}};

Object.assign(BUILDER_META,{
 device:{label:"Device",hint:"Block/network/device path",type:"path"},
 iface:{label:"Interface",hint:"Network interface name",type:"text"},
 interface:{label:"Interface",hint:"Network interface name",type:"text"},
 mountpoint:{label:"Mount Point",hint:"Filesystem mount point",type:"path"},
 package:{label:"Package",hint:"Package name",type:"text"},
 user:{label:"User",hint:"Account/user name",type:"text"},
 group:{label:"Group",hint:"Group name",type:"text"},
 password:{label:"Password",hint:"Sensitive value — avoid storing or sharing",type:"secret"},
 database:{label:"Database",hint:"Database/schema name",type:"text"},
 "output-file":{label:"Output File",hint:"Destination output file",type:"path"},
 "input-file":{label:"Input File",hint:"Input file path",type:"path"},
 "test-file":{label:"Test File",hint:"Benchmark/test file path",type:"path"},
 size:{label:"Size",hint:"Size such as 1G, 512M",type:"text"},
 duration:{label:"Duration",hint:"Duration such as 30s, 5m",type:"text"},
 seconds:{label:"Seconds",hint:"Duration in seconds",type:"number"},
 count:{label:"Count",hint:"Numeric count",type:"number"},
 pid:{label:"PID",hint:"Process ID",type:"number"},
 uid:{label:"UID",hint:"User ID",type:"number"},
 "vlan-id":{label:"VLAN ID",hint:"VLAN ID 1-4094",type:"number"},
 timezone:{label:"Timezone",hint:"IANA timezone, e.g. Asia/Kolkata",type:"text"},
 "raid-level":{label:"RAID Level",hint:"RAID level such as 1, 5, 6, 10",type:"text"},
 replicas:{label:"Replicas",hint:"Desired replica count",type:"number"},
 revision:{label:"Revision",hint:"Revision/version number",type:"number"},
 dependency:{label:"Dependency",hint:"Dependency/module identifier",type:"text"},
 configuration:{label:"Configuration",hint:"Build/dependency configuration",type:"text"},
 target:{label:"Target",hint:"Build or runtime target",type:"text"},
 module:{label:"Module",hint:"Module name",type:"text"},
 "audit-key":{label:"Audit Key",hint:"Linux Audit rule key",type:"text"},
 "syslog-host":{label:"Syslog Host",hint:"Remote syslog server",type:"host"},
 "nfs-server":{label:"NFS Server",hint:"NFS server hostname/IP",type:"host"},
 "smb-server":{label:"SMB Server",hint:"SMB/CIFS server hostname/IP",type:"host"},
 "target-host":{label:"Target Host",hint:"Storage/network target host",type:"host"},
 "broker-host":{label:"Broker Host",hint:"Kafka/message broker",type:"host"},
 "broker-port":{label:"Broker Port",hint:"Broker TCP port",type:"port"},
 "local-port":{label:"Local Port",hint:"Local TCP port",type:"port"},
 "remote-port":{label:"Remote Port",hint:"Remote TCP port",type:"port"}
,
 "api-group":{label:"API Group",hint:"Kubernetes API group",type:"text"},
 "group-version":{label:"Group / Version",hint:"Example apps/v1",type:"text"},
 "debug-image":{label:"Debug Image",hint:"Troubleshooting container image",type:"text"},
 "debug-pod":{label:"Debug Pod",hint:"Name for copied debug pod",type:"k8s"},
 cgroup:{label:"cgroup Path",hint:"Path relative to /sys/fs/cgroup",type:"path"},
 "oom-score-adjustment":{label:"OOM Score Adjustment",hint:"-1000 to 1000",type:"number"},
 value:{label:"Value",hint:"Kernel/system value",type:"text"},
 "program-id":{label:"BPF Program ID",hint:"bpftool program ID",type:"number"},
 "map-id":{label:"BPF Map ID",hint:"bpftool map ID",type:"number"},
 "vmlinux-header":{label:"vmlinux.h Output",hint:"Output header path",type:"path"},
 "policy-file":{label:"Policy File",hint:"Policy/Rego/Kyverno file",type:"path"},
 "policy-path":{label:"Policy Path",hint:"Policy directory/file",type:"path"},
 "resource-file":{label:"Resource File",hint:"Kubernetes resource YAML",type:"path"},
 "input-file":{label:"Input File",hint:"Input JSON/YAML",type:"path"},
 package:{label:"Policy Package",hint:"OPA/Rego package",type:"text"},
 rule:{label:"Policy Rule",hint:"OPA/Rego rule",type:"text"},
 "deny-rule":{label:"Deny Rule",hint:"OPA/Rego deny rule",type:"text"},
 "bundle-file":{label:"OPA Bundle",hint:"Bundle tar.gz path",type:"path"},
 "sbom-file":{label:"SBOM File",hint:"Syft/SPDX/CycloneDX file",type:"path"},
 image:{label:"Image",hint:"OCI/container image reference",type:"text"},
 "kubernetes-version":{label:"Kubernetes Version",hint:"Target Kubernetes version",type:"text"},
 provider:{label:"Provider",hint:"Cluster API provider",type:"text"},
 contract:{label:"CAPI Contract",hint:"Example v1beta1",type:"text"},
 "target-kubeconfig":{label:"Target Kubeconfig",hint:"Target management cluster kubeconfig",type:"path"},
 environment:{label:"Environment",hint:"Helmfile environment",type:"text"},
 plugin:{label:"Plugin",hint:"Krew plugin name",type:"text"},
 "plugin-list-file":{label:"Plugin List",hint:"Plugin inventory file",type:"path"},
 "index-name":{label:"Index Name",hint:"Krew plugin index name",type:"text"},
 "index-url":{label:"Index URL",hint:"Krew index Git URL",type:"url"}
});

let activeBuilder=null;
function extractPlaceholders(text){const found=[],seen=new Set();String(text).replace(/<([A-Za-z][A-Za-z0-9_.:/-]{0,80})>/g,(m,key)=>{if(!seen.has(key)){seen.add(key);found.push(key)}return m});return found}
function builderMeta(key){if(BUILDER_META[key])return BUILDER_META[key];const k=key.toLowerCase();if(k.includes("port"))return {label:key.replace(/-/g," "),hint:"Port number",type:"port"};if(k.includes("url"))return {label:key.replace(/-/g," "),hint:"URL",type:"url"};if(k.includes("path")||k.includes("file")||k.includes("dir"))return {label:key.replace(/-/g," "),hint:"Path/filename",type:"path"};if(k==="ip"||k.endsWith("-ip"))return {label:key.replace(/-/g," "),hint:"IP address",type:"ip"};return {label:key.replace(/[-_.]/g," ").replace(/\b\w/g,c=>c.toUpperCase()),hint:`Value for <${key}>`,type:"text"}}
function seedValue(key){const d=commonDefaults();return d[key]||""}
function validateBuilderValue(key,value,type){const v=String(value||"").trim(),errors=[],warnings=[];if(!v)errors.push("Required value is empty.");if(/[\r\n\0]/.test(v))errors.push("Line breaks/control characters are not allowed.");if(/[<>]/.test(v))errors.push("Remove angle brackets; enter only the replacement value.");if(type==="port"&&v&&!(/^\d+$/.test(v)&&+v>=1&&+v<=65535))errors.push("Port must be 1-65535.");if(type==="number"&&v&&!/^\d+$/.test(v))errors.push("Enter a numeric value.");if(type==="hex"&&v&&!/^(?:0x)?[0-9a-fA-F]+$/.test(v.replace(/\s+/g,"")))errors.push("Enter hexadecimal data only.");if(type==="k8s"&&v&&!/^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(v))warnings.push("Unusual Kubernetes resource-name format.");if(type==="url"&&v&&!/^(https?:\/\/|ssh:\/\/|git:\/\/|git@|[A-Za-z0-9._-]+\/)/.test(v))warnings.push("Value does not look like a conventional URL/repository.");if(type==="ip"&&v&&!/^[0-9a-fA-F:.]+$/.test(v))warnings.push("Value does not look like IPv4/IPv6.");if(type==="host"&&v&&/\s/.test(v))warnings.push("Hostname contains whitespace.");if(/[;&`]|\$\(|\|\||&&/.test(v))warnings.push("Shell control characters detected. Review before execution.");return {errors,warnings}}
function currentBuilderValues(){const v={};$("#builderFields").querySelectorAll("input[data-key]").forEach(i=>v[i.dataset.key]=i.value.trim());return v}
function refreshBuilder(){if(!activeBuilder)return {built:"",errors:["No active command"],warnings:[]};const vals=currentBuilderValues(),errors=[],warnings=[];$("#builderFields").querySelectorAll("input[data-key]").forEach(inp=>{const r=validateBuilderValue(inp.dataset.key,inp.value,inp.dataset.type);inp.classList.toggle("invalid",r.errors.length>0);inp.classList.toggle("warning",!r.errors.length&&r.warnings.length>0);r.errors.forEach(x=>errors.push(`<${inp.dataset.key}>: ${x}`));r.warnings.forEach(x=>warnings.push(`<${inp.dataset.key}>: ${x}`))});const built=replacePlaceholders(activeBuilder.text,vals);$("#builderPreview").textContent=built;extractPlaceholders(built).forEach(k=>errors.push(`<${k}> is still unresolved.`));const msg=$("#builderValidationMessages"),pill=$("#builderValidationStatus");msg.innerHTML=(errors.length?errors.map(x=>`<div class="validation-message bad">✕ <span>${esc(x)}</span></div>`):warnings.length?warnings.map(x=>`<div class="validation-message warn">! <span>${esc(x)}</span></div>`):[`<div class="validation-message">✓ <span>All detected placeholders are resolved. Verify context, target and impact before execution.</span></div>`]).join("");pill.className="validation-pill "+(errors.length?"bad":warnings.length?"warn":"good");pill.textContent=errors.length?`${errors.length} ERROR${errors.length===1?"":"S"}`:warnings.length?`${warnings.length} REVIEW`:"VALID";$("#builderCopy").disabled=errors.length>0;return {built,errors,warnings}}
function openCommandBuilder(payload){
 activeBuilder=payload;const phs=extractPlaceholders(payload.text),cm=payload.commandMeta||cmdMeta(payload.id);
 $("#builderModalTitle").textContent=cm?commandPathText(cm):(payload.section?payload.section.title:"Smart Command Builder");
 $("#builderModalSubtitle").textContent=phs.length?`This command uses ${phs.length} configurable field${phs.length===1?"":"s"}. Each field includes contextual help.`:"This command is already concrete; no placeholders were detected.";
 $("#builderTemplate").textContent=payload.text;$("#builderTemplateMeta").textContent=payload.section?`SECTION ${payload.section.number}${cm?` • ${riskLabel(cm.risk)}`:""}`:"GLOBAL";$("#builderFieldCount").textContent=`${phs.length} FIELD${phs.length===1?"":"S"}`;
 const fields=$("#builderFields");
 fields.innerHTML=phs.length?phs.map(key=>{const m=builderMeta(key),detail=placeholderHelp(key);return `<div class="builder-field"><div class="builder-field-label"><span><b>${esc(m.label)}</b><small>${esc(m.hint)} • &lt;${esc(key)}&gt;</small></span><button type="button" class="builder-field-help" data-builder-field-help="${esc(key)}" aria-expanded="false" title="Explain this field">?</button></div><input data-key="${esc(key)}" data-type="${esc(m.type)}" value="${esc(seedValue(key))}" placeholder="${esc(key)}" autocomplete="off" spellcheck="false"><p class="builder-field-help-text" data-builder-help-text="${esc(key)}" hidden>${esc(detail)}</p></div>`}).join(""):`<div class="builder-empty">No variable placeholders detected. Review and copy the command as-is.</div>`;
 fields.querySelectorAll("input").forEach(i=>i.addEventListener("input",refreshBuilder));
 fields.querySelectorAll("[data-builder-field-help]").forEach(b=>b.onclick=()=>{const p=fields.querySelector(`[data-builder-help-text="${CSS.escape(b.dataset.builderFieldHelp)}"]`),open=p.hidden;p.hidden=!open;b.setAttribute("aria-expanded",String(open))});
 $("#builderModal").hidden=false;document.body.style.overflow="hidden";refreshBuilder();const first=fields.querySelector("input");if(first)setTimeout(()=>first.focus(),30)
}
function closeCommandBuilder(){$("#builderModal").hidden=true;document.body.style.overflow="";activeBuilder=null}
$("#builderModalClose").onclick=closeCommandBuilder;$("#builderModal").onclick=e=>{if(e.target.id==="builderModal")closeCommandBuilder()};$("#builderReset").onclick=()=>{if(activeBuilder){const p=activeBuilder;openCommandBuilder(p)}};$("#builderCopy").onclick=()=>{const r=refreshBuilder();if(!r.errors.length)copy(r.built,"Validated command copied",{section:activeBuilder.section?.number||"",title:activeBuilder.section?.title||"Builder",id:activeBuilder.id||"builder"})};$("#builderCopyPreview").onclick=()=>{const r=refreshBuilder();if(!r.errors.length)copy(r.built,"Built command copied")};$("#openSmartBuilder").onclick=()=>{const s=D.sections[S.current],item=s.items.find(x=>x.type==="command"&&extractPlaceholders(x.lines.join("\n")).length)||s.items.find(x=>x.type==="command");if(item)openCommandBuilder({section:s,item,text:item.lines.join("\n"),id:item.id});else say("No command block in this section")};

/* Advanced 10-light-theme studio */
const LIGHT_THEMES={
 arctic:"Arctic Cloud",
 paper:"Paper Reference",
 mint:"Mint Ops",
 azure:"Azure Air",
 lavender:"Lavender Grid",
 sand:"Sandstone",
 graphite:"Graphite Light",
 rose:"Rose Quartz",
 solar:"Solar Day",
 cloud:"Cloud Glass"
};
const themeDrawer=$("#themeDrawer");
const themeBackdrop=$("#themeBackdrop");
const themeGrid=$("#themeGrid");
const densitySelect=$("#densitySelect");

function applyLightTheme(id,notify=true){
 if(!LIGHT_THEMES[id])id="arctic";
 S.theme=id;
 document.documentElement.dataset.theme=id;
 store.set("oe-light-theme",id);
 $("#activeThemeName").textContent=LIGHT_THEMES[id];
 themeGrid.querySelectorAll(".theme-card").forEach(card=>{
   card.classList.toggle("active",card.dataset.themeChoice===id);
 });
 if(notify)say(`Theme: ${LIGHT_THEMES[id]}`);
}
function openThemeStudio(){
 themeBackdrop.hidden=false;
 themeDrawer.classList.add("open");
 themeDrawer.setAttribute("aria-hidden","false");
 document.body.style.overflow="hidden";
}
function closeThemeStudio(){
 themeDrawer.classList.remove("open");
 themeDrawer.setAttribute("aria-hidden","true");
 themeBackdrop.hidden=true;
 document.body.style.overflow="";
}
$("#themeBtn").onclick=()=>{closeTopMenus();openThemeStudio()};
$("#themeClose").onclick=closeThemeStudio;
themeBackdrop.onclick=closeThemeStudio;
$("#themeReset").onclick=()=>applyLightTheme("arctic");
themeGrid.querySelectorAll(".theme-card").forEach(card=>{
 card.onclick=()=>applyLightTheme(card.dataset.themeChoice);
});
densitySelect.value=store.get("oe-density","comfortable")||"comfortable";
densitySelect.onchange=()=>{
 document.documentElement.dataset.density=densitySelect.value;
 store.set("oe-density",densitySelect.value);
 say(`Density: ${densitySelect.options[densitySelect.selectedIndex].text}`);
};
applyLightTheme(S.theme,false);

document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&themeDrawer.classList.contains("open"))closeThemeStudio();
});


/* Workspace initialization */
applyDashboardLayout();
document.body.classList.toggle("module-editing",!!W.moduleEdit);
$("#contextPinBtn").setAttribute("aria-pressed",String(W.contextPinned));
let contextRefreshRaf=0;
new MutationObserver(()=>{if(contextRefreshRaf)return;contextRefreshRaf=requestAnimationFrame(()=>{contextRefreshRaf=0;updateBreadcrumbFromPanel();if(!W.contextPinned&&W.contextMode==="overview")renderContextOverview()})}).observe(panel,{childList:true});
window.addEventListener("resize",()=>{if(isDockedContext())contextPane.classList.remove("mobile-open")});

const hm=location.hash.match(/^#section-(\d{3})$/);
if(hm){const i=D.sections.findIndex(s=>s.number===hm[1]);if(i>=0)S.current=i}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#builderModal").hidden)closeCommandBuilder()});
if(hm){buildNav();render()}else{buildNav();encyclopediaHome()}
renderContextForCurrent();
})();

/* Offline-first PWA registration */
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(err=>console.warn("Offline cache unavailable",err)))}
