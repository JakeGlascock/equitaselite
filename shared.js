// ── Equitas Elite — Shared Utilities ──────────────────────────

// ── Design Tokens (injected into each page's tailwind config) ──
const EE_COLORS = {
  "surface-container-highest": "#26364a",
  "surface-container-high": "#1b2b3f",
  "surface-container": "#102034",
  "surface-container-low": "#0b1c30",
  "surface-container-lowest": "#000f21",
  "background": "#031427",
  "surface": "#031427",
  "surface-bright": "#2a3a4f",
  "surface-variant": "#26364a",
  "primary": "#bec6e0",
  "on-primary": "#283044",
  "primary-container": "#0f172a",
  "on-primary-container": "#798098",
  "secondary": "#e9c176",
  "on-secondary": "#412d00",
  "secondary-container": "#604403",
  "on-secondary-container": "#dab36a",
  "tertiary": "#4edea3",
  "on-tertiary": "#003824",
  "tertiary-container": "#001c10",
  "on-tertiary-container": "#009365",
  "on-surface": "#d3e4fe",
  "on-surface-variant": "#c6c6cd",
  "outline": "#909097",
  "outline-variant": "#45464d",
};

// ── Mock Data ──────────────────────────────────────────────────
const MOCK_FAMILY_OFFICES = [
  { type:'family_office', name:'Edward Blackwood', firm:'Blackwood Capital Partners', title:'CIO', location:'London, UK', aum:'$450M', minCheck:5, maxCheck:50, stages:['Series A','Series B'], sectors:['Life Sciences','Deep Tech','Clean Energy'], geography:'Global', riskTolerance:'Moderate', mandate:'Growth', concentration:'Direct' },
  { type:'family_office', name:'Sophia Vanderbilt', firm:'Vanderbilt Family Trust', title:'Managing Director', location:'Geneva, Switzerland', aum:'$1.2B', minCheck:10, maxCheck:75, stages:['Series A','Series B','Series B+'], sectors:['FinTech','AI / ML','Real Estate'], geography:'Europe', riskTolerance:'Conservative', mandate:'Value', concentration:'Syndicated' },
  { type:'family_office', name:'Haruto Miyamoto', firm:'Miyamoto Asset Partners', title:'Head of Alternatives', location:'Tokyo, Japan', aum:'$320M', minCheck:3, maxCheck:30, stages:['Seed','Series A'], sectors:['AI / ML','Deep Tech','Healthcare'], geography:'Asia-Pacific', riskTolerance:'Aggressive', mandate:'Venture', concentration:'Direct' },
  { type:'family_office', name:'Isabelle Fontaine', firm:'Fontaine Patrimoine', title:'CIO', location:'Paris, France', aum:'$680M', minCheck:5, maxCheck:40, stages:['Series A','Series B'], sectors:['Clean Energy','SaaS','Defense Tech'], geography:'Europe', riskTolerance:'Moderate', mandate:'Impact', concentration:'Syndicated' },
  { type:'family_office', name:'Omar Al-Rashid', firm:'Meridian Sovereign Capital', title:'Managing Director', location:'Dubai, UAE', aum:'$2.1B', minCheck:15, maxCheck:100, stages:['Series B','Series B+','Growth'], sectors:['FinTech','Real Estate','Defense Tech'], geography:'Middle East', riskTolerance:'Moderate', mandate:'Growth', concentration:'Direct' },
  { type:'family_office', name:'Priya Mehta', firm:'Mehta Generations Trust', title:'CIO', location:'Singapore', aum:'$580M', minCheck:5, maxCheck:35, stages:['Seed','Series A','Series B'], sectors:['Healthcare','SaaS','AI / ML'], geography:'Asia-Pacific', riskTolerance:'Moderate', mandate:'Balanced', concentration:'Syndicated' },
];

const MOCK_ANGELS = [
  { type:'angel', name:'Alexandra Mercer', firm:'Mercer Ventures', title:'Managing Partner', location:'New York, USA', aum:'$50M', minCheck:1, maxCheck:10, stages:['Seed','Series A'], sectors:['FinTech','Deep Tech','Life Sciences'], geography:'North America', riskTolerance:'Aggressive', expectedReturn:'10x+', timeline:'5-7 years' },
  { type:'angel', name:'James Fairfax', firm:'Fairfax Capital', title:'General Partner', location:'San Francisco, USA', aum:'$80M', minCheck:2, maxCheck:15, stages:['Seed','Series A','Series B'], sectors:['AI / ML','SaaS','Deep Tech'], geography:'North America', riskTolerance:'Aggressive', expectedReturn:'10x+', timeline:'5-7 years' },
  { type:'angel', name:'Chiara Rossetti', firm:'Rossetti Innovation Fund', title:'Managing Director', location:'Milan, Italy', aum:'$35M', minCheck:0.5, maxCheck:5, stages:['Pre-Seed','Seed'], sectors:['Clean Energy','Life Sciences','Consumer'], geography:'Europe', riskTolerance:'Moderate', expectedReturn:'5x–10x', timeline:'7-10 years' },
  { type:'angel', name:'Marcus Cole', firm:'Cole Frontier Capital', title:'Founder & GP', location:'Austin, USA', aum:'$120M', minCheck:3, maxCheck:20, stages:['Series A','Series B'], sectors:['Defense Tech','AI / ML','FinTech'], geography:'North America', riskTolerance:'Aggressive', expectedReturn:'10x+', timeline:'5-7 years' },
  { type:'angel', name:'Yuki Tanaka', firm:'Tanaka Innovation Partners', title:'Managing Partner', location:'Osaka, Japan', aum:'$25M', minCheck:0.5, maxCheck:3, stages:['Pre-Seed','Seed'], sectors:['Healthcare','AI / ML','Deep Tech'], geography:'Asia-Pacific', riskTolerance:'Aggressive', expectedReturn:'10x+', timeline:'5-7 years' },
  { type:'angel', name:'Amara Nwosu', firm:'Nwosu Capital Collective', title:'Founding Partner', location:'Lagos, Nigeria', aum:'$40M', minCheck:0.5, maxCheck:5, stages:['Seed','Series A'], sectors:['FinTech','Healthcare','SaaS'], geography:'Middle East', riskTolerance:'Moderate', expectedReturn:'5x–10x', timeline:'5-7 years' },
];

const MOCK_DEALS = [
  { id:'d1', name:'Aurelius Capital Series B', company:'Aurelius Capital', stage:'Series B', sector:'Clean Energy', target:25, raised:18.4, status:'Active', pct:73, verified:true, description:'Transition to renewable energy grid infrastructure with proprietary CEMS technology.' },
  { id:'d2', name:'Nova Labs AI — Series A', company:'Nova Labs AI', stage:'Series A', sector:'AI / ML', target:12, raised:9.2, status:'Active', pct:76, verified:true, description:'Deep learning diagnostic platform for oncology, currently undergoing FDA breakthrough trials.' },
  { id:'d3', name:'GreenHorizon Seed', company:'GreenHorizon', stage:'Seed', sector:'Clean Energy', target:4, raised:2.1, status:'Active', pct:52, verified:false, description:'Modular green hydrogen systems for industrial decarbonisation.' },
  { id:'d4', name:'Vault Therapeutics Series B', company:'Vault Therapeutics', stage:'Series B', sector:'Life Sciences', target:30, raised:24.5, status:'Closing', pct:81, verified:true, description:'Proprietary vault nanoparticle platform for targeted drug delivery.' },
];

const MOCK_NOTIFICATIONS = [
  { id:'n1', tab:'matches', icon:'hub', iconColor:'text-secondary', iconBg:'bg-secondary/20', title:'New 90% Match: Solaris Core (Series A · FinTech)', body:'Based on your investment mandate, Solaris Core aligns perfectly with your fintech and sustainability criteria. Lead investors include Sequoia and Andreessen Horowitz.', time:'2h ago', actions:[{label:'View Alignment', style:'primary', href:'alignment.html'},{label:'Dismiss', style:'ghost'}], read:false },
  { id:'n2', tab:'deal_room', icon:'upload_file', iconColor:'text-primary', iconBg:'bg-primary/20', title:'Sarah Chen uploaded technical_audit_v4.pdf', body:'Aurelius Capital Deal Room updated with latest compliance documentation for your review.', time:'5h ago', actions:[{label:'Review Document', style:'primary'}], read:false },
  { id:'n3', tab:'matches', icon:'group_add', iconColor:'text-tertiary', iconBg:'bg-tertiary/20', title:"You've been invited to join the 'Global Green Energy' Syndicate", body:"The Managing Partner of Sovereign Wealth Group has personally invited your office to participate in a $200M infrastructure syndicate focusing on North Sea wind energy.", time:'Yesterday', actions:[{label:'Accept Invitation', style:'positive'},{label:'Decline', style:'ghost'}], read:false },
  { id:'n4', tab:'account', icon:'tune', iconColor:'text-on-surface-variant', iconBg:'bg-surface-container', title:'Investment Mandate successfully updated', body:'Changes applied to automatic matching algorithm. New matches will reflect your updated criteria within 24 hours.', time:'2 days ago', actions:[], read:true },
  { id:'n5', tab:'deal_room', icon:'bar_chart', iconColor:'text-secondary', iconBg:'bg-secondary/20', title:'Portfolio Q3 Reporting Available', body:"The quarterly performance summary for the 'Alpha Tech Basket' is now ready for download in your vault.", time:'5 days ago', actions:[{label:'View Report', style:'primary', href:'reports.html'}], read:true },
  { id:'n6', tab:'matches', icon:'verified', iconColor:'text-tertiary', iconBg:'bg-tertiary/20', title:'New 85% Match: Meridian Biotech Partners', body:'Your expanded Life Sciences mandate has surfaced a new high-confidence match. Meridian manages $340M with a focus on late-stage therapeutics.', time:'1 week ago', actions:[{label:'View Alignment', style:'primary', href:'alignment.html'},{label:'Dismiss', style:'ghost'}], read:true },
];

// ── Auth ──────────────────────────────────────────────────────
function eeGetUser() {
  return JSON.parse(localStorage.getItem('ee_current_user') || 'null');
}
function eeCheckAuth() {
  const u = eeGetUser();
  if (!u) { window.location.href = 'index.html'; return null; }
  return u;
}
function eeLogout() {
  localStorage.removeItem('ee_current_user');
  window.location.href = 'index.html';
}

// ── Scoring ──────────────────────────────────────────────────
function eeMatchScore(a, b) {
  let score = 0;
  const aSectors = a.sectors||[], bSectors = b.sectors||[];
  score += (aSectors.filter(s=>bSectors.includes(s)).length / Math.max(aSectors.length,bSectors.length,1)) * 40;
  const aStages = a.stages||[], bStages = b.stages||[];
  score += (aStages.filter(s=>bStages.includes(s)).length / Math.max(aStages.length,bStages.length,1)) * 30;
  if ((a.minCheck||0)<=(b.maxCheck||999) && (b.minCheck||0)<=(a.maxCheck||999)) score += 20;
  if (a.geography===b.geography||a.geography==='Global'||b.geography==='Global') score += 10;
  return Math.min(Math.round(score), 99);
}
function eeScoreLabel(s) {
  return s>=85?'Exceptional':s>=70?'Strong':s>=55?'Good':'Moderate';
}
function eeScoreColors(s) {
  if (s>=85) return {text:'text-tertiary',bg:'bg-tertiary/15 border-tertiary/30',bar:'#4edea3'};
  if (s>=70) return {text:'text-secondary',bg:'bg-secondary/15 border-secondary/30',bar:'#e9c176'};
  return {text:'text-on-surface-variant',bg:'bg-surface-container border-outline-variant/30',bar:'#909097'};
}

// ── Sidebar HTML ──────────────────────────────────────────────
function eeSidebarHTML(activePage, user) {
  const isAngel = user && user.type === 'angel';
  const icon = isAngel ? 'person_raised_hand' : 'account_balance';
  const pages = [
    { href:'dashboard.html', icon:'dashboard', label:'Dashboard' },
    { href:'discovery.html', icon:'explore', label:'Discovery' },
    { href:'deal-room.html', icon:'handshake', label:'Deal Room' },
    { href:'portfolio.html', icon:'account_balance_wallet', label:'Portfolio' },
    { href:'network.html', icon:'group', label:'Network' },
    { href:'reports.html', icon:'bar_chart', label:'Reports' },
  ];
  return `
  <aside class="fixed left-0 top-14 bottom-0 w-60 bg-surface-container-low border-r border-outline-variant/40 flex-col hidden lg:flex z-40">
    <div class="p-4 border-b border-outline-variant/30">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-secondary" style="font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 24">${icon}</span>
        </div>
        <div class="min-w-0">
          <p class="font-body text-[13px] font-semibold text-on-surface truncate">${user?.name||'Member'}</p>
          <p class="font-label text-[10px] tracking-wider text-secondary uppercase">${isAngel?'Angel Investor':'Family Office'}</p>
        </div>
      </div>
    </div>
    <nav class="flex flex-col gap-0.5 p-3 flex-grow">
      ${pages.map(p=>`
      <a href="${p.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label text-[11px] font-semibold tracking-widest uppercase transition-all ${activePage===p.href?'bg-secondary/12 text-secondary border-r-2 border-secondary':'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}">
        <span class="material-symbols-outlined text-lg" style="${activePage===p.href?"font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 24":''}">${p.icon}</span>
        ${p.label}
      </a>`).join('')}
    </nav>
    <div class="p-3 space-y-1">
      <button onclick="eeOpenModal('syndicate-modal')" class="w-full py-2.5 bg-tertiary/15 border border-tertiary/30 text-tertiary font-label text-[11px] font-semibold tracking-widest uppercase rounded-lg hover:bg-tertiary/25 transition-all">
        Join Syndicate
      </button>
      <a href="settings.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
        <span class="material-symbols-outlined text-lg">settings</span>Settings
      </a>
      <button onclick="eeLogout()" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-label text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
        <span class="material-symbols-outlined text-lg">logout</span>Sign Out
      </button>
    </div>
  </aside>`;
}

// ── Top Bar HTML ──────────────────────────────────────────────
function eeTopbarHTML(activePage, user) {
  const navLinks = [
    { href:'dashboard.html', label:'Dashboard' },
    { href:'discovery.html', label:'Discovery' },
    { href:'deal-room.html', label:'Deal Room' },
    { href:'portfolio.html', label:'Portfolio' },
    { href:'network.html', label:'Network' },
  ];
  const unread = MOCK_NOTIFICATIONS.filter(n=>!n.read).length;
  return `
  <header class="fixed top-0 left-0 right-0 h-14 bg-surface-container-low/90 backdrop-blur-md border-b border-outline-variant/40 flex items-center justify-between px-5 md:px-8 z-50">
    <div class="flex items-center gap-5">
      <a href="dashboard.html" class="flex items-center">
        <img src="logo.png" alt="Equitas Elite" class="h-9 w-auto rounded-md" style="background:#fff; padding:2px 6px;"/>
      </a>
      <nav class="hidden lg:flex items-center gap-0.5">
        ${navLinks.map(l=>`<a href="${l.href}" class="font-label text-[11px] font-semibold tracking-widest uppercase px-3 py-1.5 transition-colors ${activePage===l.href?'text-secondary border-b-2 border-secondary':'text-on-surface-variant hover:text-on-surface'}">${l.label}</a>`).join('')}
      </nav>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="eeOpenNewDeal()" class="hidden sm:flex h-8 px-4 bg-secondary text-on-secondary font-label text-[10px] font-bold tracking-widest uppercase rounded-lg hover:opacity-90 transition-all items-center gap-1.5">
        <span class="material-symbols-outlined text-sm">add</span>New Deal
      </button>
      <button onclick="eeOpenNotifications()" class="relative p-2 hover:bg-surface-container rounded-lg transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
        ${unread>0?`<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary"></span>`:''}
      </button>
      <a href="settings.html" class="p-2 hover:bg-surface-container rounded-lg transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant text-xl">settings</span>
      </a>
      <a href="settings.html" class="w-8 h-8 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center cursor-pointer">
        <span class="font-label text-[12px] font-bold text-secondary">${(user?.name||'U')[0].toUpperCase()}</span>
      </a>
    </div>
  </header>`;
}

// ── Mobile Bottom Nav ─────────────────────────────────────────
function eeMobileNavHTML(activePage) {
  const items = [
    { href:'dashboard.html', icon:'dashboard', label:'Home' },
    { href:'discovery.html', icon:'explore', label:'Discover' },
    { href:'deal-room.html', icon:'handshake', label:'Deals' },
    { href:'portfolio.html', icon:'account_balance_wallet', label:'Portfolio' },
    { href:'network.html', icon:'group', label:'Network' },
  ];
  return `
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant/40 flex justify-around items-center px-2 z-50">
    ${items.map(i=>`
    <a href="${i.href}" class="flex flex-col items-center gap-0.5 ${activePage===i.href?'text-secondary':'text-on-surface-variant'}">
      <span class="material-symbols-outlined text-xl" style="${activePage===i.href?"font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 24":''}">${i.icon}</span>
      <span class="font-label text-[9px] tracking-widest">${i.label}</span>
    </a>`).join('')}
  </nav>`;
}

// ── Modal Utilities ───────────────────────────────────────────
function eeOpenModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
}
function eeCloseModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
}
// close on backdrop click
document.addEventListener('click', e => {
  if (e.target.dataset.modalBackdrop) eeCloseModal(e.target.id.replace('-backdrop','').replace('-modal','') + '-modal' || e.target.id);
});

// ── New Deal Modal ────────────────────────────────────────────
function eeInjectNewDealModal() {
  const html = `
  <div id="new-deal-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4" data-modal-backdrop>
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="eeCloseModal('new-deal-modal')"></div>
    <div class="relative w-full max-w-lg bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-2xl z-10">
      <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
        <div>
          <span class="font-label text-[10px] tracking-widest text-secondary uppercase">Deal Room</span>
          <h2 class="font-display text-xl font-bold text-on-surface">Create New Deal</h2>
        </div>
        <button onclick="eeCloseModal('new-deal-modal')" class="p-2 hover:bg-surface-container rounded-lg transition-colors">
          <span class="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <form onsubmit="eeSubmitNewDeal(event)" class="px-6 py-5 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Deal / Company Name</label>
            <input id="nd-name" type="text" placeholder="e.g. Aether Finance Series B" required
              class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
          </div>
          <div class="space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Investment Stage</label>
            <select id="nd-stage" class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none transition-colors">
              <option value="">Select stage</option>
              <option>Pre-Seed</option><option>Seed</option><option>Series A</option>
              <option>Series B</option><option>Series B+</option><option>Growth</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Sector</label>
            <select id="nd-sector" class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none transition-colors">
              <option value="">Select sector</option>
              <option>FinTech</option><option>Deep Tech</option><option>Life Sciences</option>
              <option>Clean Energy</option><option>SaaS</option><option>AI / ML</option>
              <option>Healthcare</option><option>Defense Tech</option><option>Consumer</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Target Raise ($M)</label>
            <input id="nd-target" type="number" min="0.1" step="0.1" placeholder="25.0"
              class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
          </div>
          <div class="space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Valuation ($M)</label>
            <input id="nd-val" type="number" min="0.1" step="0.5" placeholder="120.0"
              class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
          </div>
          <div class="col-span-2 space-y-1">
            <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Brief Description</label>
            <textarea id="nd-desc" rows="3" placeholder="Describe the investment opportunity…"
              class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors resize-none"></textarea>
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="eeCloseModal('new-deal-modal')" class="flex-1 h-10 border border-outline-variant text-on-surface font-label text-[10px] font-semibold tracking-widest uppercase rounded-lg hover:bg-surface-container transition-all">Cancel</button>
          <button type="submit" class="flex-1 h-10 bg-secondary text-on-secondary font-label text-[10px] font-bold tracking-widest uppercase rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">add_circle</span>Create Deal Room
          </button>
        </div>
      </form>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function eeOpenNewDeal() { eeOpenModal('new-deal-modal'); }

function eeSubmitNewDeal(e) {
  e.preventDefault();
  const name = document.getElementById('nd-name').value;
  eeCloseModal('new-deal-modal');
  eeShowToast(`Deal room created for "${name}". You can now upload documents and invite stakeholders.`);
  setTimeout(() => { window.location.href = 'deal-room.html'; }, 1500);
}

// ── Notifications Drawer ──────────────────────────────────────
function eeInjectNotificationsDrawer() {
  const unread = MOCK_NOTIFICATIONS.filter(n=>!n.read).length;
  const html = `
  <div id="notif-drawer" class="hidden fixed inset-0 z-[100]">
    <div class="absolute inset-0 bg-black/40" onclick="eeCloseNotifications()"></div>
    <div class="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-surface-container-low border-l border-outline-variant/40 flex flex-col shadow-2xl" style="transform:translateX(100%);transition:transform 0.3s ease" id="notif-panel">
      <div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 shrink-0">
        <div>
          <h2 class="font-display text-lg font-bold text-on-surface">Notifications</h2>
          ${unread>0?`<p class="font-label text-[10px] tracking-wider text-secondary uppercase">${unread} Unread</p>`:'<p class="font-label text-[10px] tracking-wider text-on-surface-variant uppercase">All caught up</p>'}
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.location.href='notifications.html'" class="font-label text-[10px] font-semibold tracking-wider text-secondary hover:underline uppercase">View All</button>
          <button onclick="eeCloseNotifications()" class="p-1.5 hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined text-on-surface-variant text-lg">close</span>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto divide-y divide-outline-variant/20">
        ${MOCK_NOTIFICATIONS.slice(0,5).map(n=>`
        <div class="px-5 py-4 hover:bg-surface-container/40 transition-colors ${n.read?'opacity-60':''}">
          <div class="flex gap-3 items-start">
            <div class="w-9 h-9 rounded-full ${n.iconBg} flex items-center justify-center shrink-0 mt-0.5">
              <span class="material-symbols-outlined ${n.iconColor} text-base" style="font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 24">${n.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-on-surface leading-5 mb-0.5">${n.title}</p>
              <p class="text-[11px] text-on-surface-variant leading-4 line-clamp-2">${n.body}</p>
              <p class="font-label text-[10px] text-on-surface-variant/50 mt-1.5">${n.time}</p>
              ${n.actions.length>0?`
              <div class="flex gap-2 mt-2">
                ${n.actions.map(a=>`<button onclick="${a.href?`window.location.href='${a.href}'`:'eeCloseNotifications()'}" class="font-label text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded ${a.style==='primary'?'bg-secondary text-on-secondary':a.style==='positive'?'bg-tertiary/20 text-tertiary border border-tertiary/30':'border border-outline-variant text-on-surface-variant'} hover:opacity-80 transition-all">${a.label}</button>`).join('')}
              </div>`:''}
            </div>
            ${!n.read?'<div class="w-2 h-2 rounded-full bg-secondary shrink-0 mt-2"></div>':''}
          </div>
        </div>`).join('')}
      </div>
      <div class="px-5 py-3 border-t border-outline-variant/30 shrink-0">
        <a href="notifications.html" class="w-full h-9 flex items-center justify-center font-label text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant hover:text-on-surface transition-colors">
          See All Notifications →
        </a>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function eeOpenNotifications() {
  const drawer = document.getElementById('notif-drawer');
  const panel = document.getElementById('notif-panel');
  drawer.classList.remove('hidden');
  requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; });
}
function eeCloseNotifications() {
  const panel = document.getElementById('notif-panel');
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => { document.getElementById('notif-drawer').classList.add('hidden'); }, 300);
}

// ── Quick Message Modal ───────────────────────────────────────
function eeInjectMessageModal() {
  const html = `
  <div id="message-modal" class="hidden fixed inset-0 z-[100] items-end sm:items-center justify-center p-0 sm:p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="eeCloseModal('message-modal')"></div>
    <div class="relative w-full sm:max-w-md bg-surface-container-low border border-outline-variant/60 rounded-t-2xl sm:rounded-xl shadow-2xl z-10">
      <div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30">
        <div>
          <span class="font-label text-[10px] tracking-widest text-secondary uppercase">Secure Channel</span>
          <h2 class="font-display text-lg font-bold text-on-surface" id="msg-recipient">Send Message</h2>
        </div>
        <button onclick="eeCloseModal('message-modal')" class="p-2 hover:bg-surface-container rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <div class="px-5 py-4 space-y-3">
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Subject</label>
          <input id="msg-subject" type="text" placeholder="Introduction / Partnership Inquiry"
            class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
        </div>
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Message</label>
          <textarea id="msg-body" rows="4" placeholder="Write your secure message…"
            class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors resize-none"></textarea>
        </div>
        <div class="flex items-center gap-2 text-[11px] text-on-surface-variant/60">
          <span class="material-symbols-outlined text-sm">lock</span>
          End-to-end encrypted · Only visible to recipient
        </div>
        <div class="flex gap-3 pt-1">
          <button onclick="eeCloseModal('message-modal')" class="flex-1 h-10 border border-outline-variant text-on-surface font-label text-[10px] font-semibold tracking-widest uppercase rounded-lg hover:bg-surface-container transition-all">Cancel</button>
          <button onclick="eeSendMessage()" class="flex-1 h-10 bg-secondary text-on-secondary font-label text-[10px] font-bold tracking-widest uppercase rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">send</span>Send
          </button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function eeOpenMessage(recipientName) {
  document.getElementById('msg-recipient').textContent = `Message ${recipientName||''}`;
  eeOpenModal('message-modal');
}
function eeSendMessage() {
  eeCloseModal('message-modal');
  eeShowToast('Message sent securely. You\'ll be notified when they respond.');
}

// ── Invite Member Modal ───────────────────────────────────────
function eeInjectInviteModal() {
  const html = `
  <div id="invite-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="eeCloseModal('invite-modal')"></div>
    <div class="relative w-full max-w-md bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-2xl z-10">
      <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
        <div>
          <span class="font-label text-[10px] tracking-widest text-secondary uppercase">Team Management</span>
          <h2 class="font-display text-xl font-bold text-on-surface">Invite Member</h2>
        </div>
        <button onclick="eeCloseModal('invite-modal')" class="p-2 hover:bg-surface-container rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Full Name</label>
          <input id="inv-name" type="text" placeholder="Jane Smith"
            class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
        </div>
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Work Email</label>
          <input id="inv-email" type="email" placeholder="jane@institution.com"
            class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-colors"/>
        </div>
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Role</label>
          <select id="inv-role" class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none transition-colors">
            <option>Managing Partner</option><option>Associate</option><option>Analyst</option>
            <option>Advisor</option><option>Observer (Read-only)</option>
          </select>
        </div>
        <div class="p-3 bg-surface-container rounded-lg border border-outline-variant/30">
          <p class="text-[12px] text-on-surface-variant">They will receive an email invitation to join your firm's Equitas Elite workspace. Pending approval within 24 hours.</p>
        </div>
        <div class="flex gap-3">
          <button onclick="eeCloseModal('invite-modal')" class="flex-1 h-10 border border-outline-variant text-on-surface font-label text-[10px] font-semibold tracking-widest uppercase rounded-lg hover:bg-surface-container transition-all">Cancel</button>
          <button onclick="eeSendInvite()" class="flex-1 h-10 bg-secondary text-on-secondary font-label text-[10px] font-bold tracking-widest uppercase rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">send</span>Send Invite
          </button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
function eeSendInvite() {
  const name = document.getElementById('inv-name').value;
  eeCloseModal('invite-modal');
  eeShowToast(`Invitation sent to ${name||'team member'}. They'll receive an email shortly.`);
}

// ── Upload Document Modal ─────────────────────────────────────
function eeInjectUploadModal() {
  const html = `
  <div id="upload-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="eeCloseModal('upload-modal')"></div>
    <div class="relative w-full max-w-lg bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-2xl z-10">
      <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
        <div>
          <span class="font-label text-[10px] tracking-widest text-secondary uppercase">Document Vault</span>
          <h2 class="font-display text-xl font-bold text-on-surface">Upload Document</h2>
        </div>
        <button onclick="eeCloseModal('upload-modal')" class="p-2 hover:bg-surface-container rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div id="upload-dropzone" class="border-2 border-dashed border-outline-variant/50 rounded-xl p-8 text-center hover:border-secondary/50 transition-colors cursor-pointer" onclick="document.getElementById('upload-file-input').click()" ondragover="event.preventDefault();this.classList.add('border-secondary/50')" ondragleave="this.classList.remove('border-secondary/50')">
          <span class="material-symbols-outlined text-on-surface-variant text-4xl block mb-3">cloud_upload</span>
          <p class="text-[14px] font-semibold text-on-surface mb-1">Drop files here or <span class="text-secondary">browse</span></p>
          <p class="text-[12px] text-on-surface-variant">PDF, XLSX, DOCX, PPTX · Max 50MB per file</p>
          <input id="upload-file-input" type="file" class="hidden" multiple accept=".pdf,.xlsx,.docx,.pptx,.csv" onchange="eeHandleFileSelect(this)"/>
        </div>
        <div id="upload-file-list" class="space-y-2 hidden"></div>
        <div class="space-y-1">
          <label class="font-label text-[10px] font-semibold tracking-widest text-primary uppercase">Document Category</label>
          <select class="w-full bg-surface-container border border-outline-variant/50 focus:border-secondary rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none transition-colors">
            <option>Due Diligence</option><option>Financial Projections</option><option>Legal</option>
            <option>Technical Audit</option><option>Term Sheet</option><option>Other</option>
          </select>
        </div>
        <div class="flex gap-3">
          <button onclick="eeCloseModal('upload-modal')" class="flex-1 h-10 border border-outline-variant text-on-surface font-label text-[10px] font-semibold tracking-widest uppercase rounded-lg hover:bg-surface-container transition-all">Cancel</button>
          <button onclick="eeUploadFiles()" class="flex-1 h-10 bg-secondary text-on-secondary font-label text-[10px] font-bold tracking-widest uppercase rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">upload</span>Upload to Vault
          </button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function eeHandleFileSelect(input) {
  const list = document.getElementById('upload-file-list');
  list.classList.remove('hidden');
  list.innerHTML = Array.from(input.files).map(f=>`
    <div class="flex items-center gap-3 p-2.5 bg-surface-container rounded-lg border border-outline-variant/30">
      <span class="material-symbols-outlined text-secondary text-lg">description</span>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-semibold text-on-surface truncate">${f.name}</p>
        <p class="text-[11px] text-on-surface-variant">${(f.size/1024/1024).toFixed(1)} MB</p>
      </div>
      <span class="material-symbols-outlined text-tertiary text-lg">check_circle</span>
    </div>`).join('');
}

function eeUploadFiles() {
  eeCloseModal('upload-modal');
  eeShowToast('Documents uploaded to vault successfully. All participants have been notified.');
}

// ── Syndicate Modal ───────────────────────────────────────────
function eeInjectSyndicateModal() {
  const syndicates = [
    { name:'Global Green Energy', desc:'$200M infrastructure syndicate · North Sea wind energy', members:12, min:'$2M' },
    { name:'FinTech Alpha', desc:'Series B & early growth · US & European markets', members:8, min:'$1M' },
    { name:'MedTech Ventures Co-Investment Pool', desc:'Life sciences co-investment, FDA-track pipeline', members:19, min:'$500K' },
  ];
  const html = `
  <div id="syndicate-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="eeCloseModal('syndicate-modal')"></div>
    <div class="relative w-full max-w-lg bg-surface-container-low border border-outline-variant/60 rounded-xl shadow-2xl z-10 max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 shrink-0">
        <div>
          <span class="font-label text-[10px] tracking-widest text-tertiary uppercase">Exclusive Access</span>
          <h2 class="font-display text-xl font-bold text-on-surface">Join a Syndicate</h2>
        </div>
        <button onclick="eeCloseModal('syndicate-modal')" class="p-2 hover:bg-surface-container rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        ${syndicates.map(s=>`
        <div class="border border-outline-variant/40 rounded-xl p-4 hover:border-secondary/40 transition-colors">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-body text-[14px] font-semibold text-on-surface">${s.name}</h3>
            <span class="font-label text-[9px] tracking-wider px-2 py-0.5 bg-tertiary/15 text-tertiary border border-tertiary/30 rounded-full">OPEN</span>
          </div>
          <p class="text-[12px] text-on-surface-variant mb-3">${s.desc}</p>
          <div class="flex items-center justify-between">
            <div class="flex gap-4 text-[11px] text-on-surface-variant">
              <span><span class="font-semibold text-on-surface">${s.members}</span> members</span>
              <span>Min. <span class="font-semibold text-secondary">${s.min}</span></span>
            </div>
            <button onclick="eeJoinSyndicate('${s.name}')" class="h-8 px-4 bg-tertiary/15 border border-tertiary/30 text-tertiary font-label text-[10px] font-bold tracking-wider uppercase rounded-lg hover:bg-tertiary/25 transition-all">Request Access</button>
          </div>
        </div>`).join('')}
      </div>
      <div class="px-6 py-3 border-t border-outline-variant/30 shrink-0">
        <a href="network.html" onclick="eeCloseModal('syndicate-modal')" class="w-full flex items-center justify-center gap-2 font-label text-[10px] font-semibold tracking-widest text-secondary hover:underline uppercase">
          View All Syndicates in Network →
        </a>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
function eeJoinSyndicate(name) {
  eeCloseModal('syndicate-modal');
  eeShowToast(`Access request sent for "${name}". The syndicate manager will review your profile.`);
}

// ── Toast Notification ────────────────────────────────────────
function eeShowToast(msg, type='success') {
  const existing = document.getElementById('ee-toast');
  if (existing) existing.remove();
  const color = type==='error' ? 'bg-error-container border-error/40 text-on-error-container' : 'bg-tertiary/15 border-tertiary/40 text-on-surface';
  const icon = type==='error' ? 'error' : 'check_circle';
  const iconColor = type==='error' ? 'text-error' : 'text-tertiary';
  const toast = document.createElement('div');
  toast.id = 'ee-toast';
  toast.className = `fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl border ${color} shadow-2xl max-w-sm w-[calc(100vw-2rem)] transition-all duration-300 opacity-0`;
  toast.innerHTML = `<span class="material-symbols-outlined ${iconColor} text-lg shrink-0" style="font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 24">${icon}</span><p class="text-[13px] leading-5">${msg}</p>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Page Bootstrap ────────────────────────────────────────────
function eeBootstrap(activePage) {
  const user = eeCheckAuth();
  if (!user) return;

  // Inject topbar
  const topbarMount = document.getElementById('ee-topbar');
  if (topbarMount) topbarMount.outerHTML = eeTopbarHTML(activePage, user);

  // Inject sidebar
  const sidebarMount = document.getElementById('ee-sidebar');
  if (sidebarMount) sidebarMount.outerHTML = eeSidebarHTML(activePage, user);

  // Inject mobile nav
  const mobileNavMount = document.getElementById('ee-mobile-nav');
  if (mobileNavMount) mobileNavMount.outerHTML = eeMobileNavHTML(activePage);

  // Inject all modals
  eeInjectNewDealModal();
  eeInjectNotificationsDrawer();
  eeInjectMessageModal();
  eeInjectInviteModal();
  eeInjectUploadModal();
  eeInjectSyndicateModal();

  return user;
}
