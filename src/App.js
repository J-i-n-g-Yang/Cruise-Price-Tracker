import { useState, useEffect, useCallback } from "react";
import {
  Ship, TrendingDown, TrendingUp, Plus, Trash2, Edit2, Save, X,
  Calendar, MapPin, Anchor, Bell, RefreshCw,
  ChevronDown, ChevronUp, Download, Upload, BarChart3, Link2,
  Zap, Clock, CheckCircle, Eye,
} from "lucide-react";

const STORAGE_KEY = "cruise-tracker-v3";

const SHIP_NAMES = {
  AD:"Adventure of the Seas", AL:"Allure of the Seas", AN:"Anthem of the Seas",
  BR:"Brilliance of the Seas", EN:"Enchantment of the Seas", EX:"Explorer of the Seas",
  FR:"Freedom of the Seas", GR:"Grandeur of the Seas", HM:"Harmony of the Seas",
  IC:"Icon of the Seas", ID:"Independence of the Seas", JW:"Jewel of the Seas",
  LB:"Liberty of the Seas", MA:"Mariner of the Seas", NV:"Navigator of the Seas",
  OA:"Oasis of the Seas", OY:"Odyssey of the Seas", OV:"Ovation of the Seas",
  QN:"Quantum of the Seas", RD:"Radiance of the Seas", RH:"Rhapsody of the Seas",
  SC:"Spectrum of the Seas", SR:"Serenade of the Seas", ST:"Star of the Seas",
  SY:"Symphony of the Seas", UT:"Utopia of the Seas", VI:"Vision of the Seas",
  VY:"Voyager of the Seas", WN:"Wonder of the Seas",
};
const CABIN_MAP = {
  INTERIOR:"interior", OCEANVIEW:"oceanview", BALCONY:"balcony", SUITE:"suite",
  INSIDE:"interior", OUTSIDE:"oceanview", JUNIOR_SUITE:"suite",
};
const STATEROOMS = [
  { id:"interior",  label:"Interior",   icon:"🛏️", color:"#185FA5" },
  { id:"oceanview", label:"Ocean View", icon:"🪟", color:"#0F6E56" },
  { id:"balcony",   label:"Balcony",    icon:"🌊", color:"#534AB7" },
  { id:"suite",     label:"Suite",      icon:"👑", color:"#854F0B" },
];

function parseRCUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const p = u.searchParams;
    const shipCode = (p.get("shipCode") || "").toUpperCase();
    const sailDate = p.get("sailDate") || "";
    const cabinRaw = (p.get("r0d") || p.get("cabinClassType") || "").toUpperCase().trim();
    const stateroomType = CABIN_MAP[cabinRaw] || null;
    const ship = SHIP_NAMES[shipCode] || null;
    const urlPrice = p.get("r0A") ? parseFloat(p.get("r0A")) : null;
    let departureDate = sailDate, friendlyDate = "";
    if (sailDate) {
      const d = new Date(sailDate);
      if (!isNaN(d)) {
        departureDate = d.toISOString().split("T")[0];
        friendlyDate = d.toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
      }
    }
    let duration = null;
    const pkg = (p.get("packageCode") || "").match(/[A-Z]{2}(\d+)[A-Z]/);
    if (pkg) duration = String(parseInt(pkg[1]));
    const r0f = (p.get("r0f") || "").match(/^(\d+)N$/i);
    if (!duration && r0f) duration = r0f[1];
    const name = ship && friendlyDate ? `${ship} — ${friendlyDate}` : null;
    return { name, ship, departureDate, duration, stateroomType, urlPrice };
  } catch { return null; }
}

function fmt(price, currency = "USD") {
  if (price == null || isNaN(price)) return "—";
  return new Intl.NumberFormat("en-US", { style:"currency", currency, maximumFractionDigits:0 }).format(price);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

function newCruise() {
  return {
    id: Date.now().toString(),
    name:"", ship:"", departureDate:"", duration:"", destination:"",
    royalCaribbeanUrl:"", scraperId:"",
    priceHistory: [],
    currentPrices: { interior:"", oceanview:"", balcony:"", suite:"" },
    alerts: { interior:"", oceanview:"", balcony:"", suite:"" },
  };
}

// ─── Simulated scraped data store (mocked since no backend in browser) ────────
function loadScrapedData() {
  try {
    const raw = localStorage.getItem("cruise-scraped-v3");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
function saveScrapedData(map) {
  try { localStorage.setItem("cruise-scraped-v3", JSON.stringify(map)); } catch {}
}

export default function App() {
  const [cruises, setCruises]     = useState([]);
  const [scrapedMap, setScraped]  = useState({});
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [expanded, setExpanded]   = useState(null);


  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCruises(JSON.parse(stored));
    } catch {}
    setScraped(loadScrapedData());
    setLoading(false);
  }, []);

  const saveCruises = useCallback((list) => {
    const sorted = [...list].sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
    setCruises(sorted);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); } catch {}
  }, []);

  const saveCruise = useCallback((cruise) => {
    setCruises(prev => {
      const idx = prev.findIndex(c => c.id === cruise.id);
      const updated = idx >= 0 ? prev.map((c, i) => i === idx ? cruise : c) : [...prev, cruise];
      const sorted = updated.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); } catch {}
      return sorted;
    });
  }, []);

  const deleteCruise = (id) => {
    if (!window.confirm("Remove this cruise from your watchlist?")) return;
    saveCruises(cruises.filter(c => c.id !== id));
  };

  // Simulate a price scrape by adding to scraped history
  const simulateScrape = (cruiseId, prices) => {
    const ts = new Date().toISOString();
    setScraped(prev => {
      const existing = prev[cruiseId] || { history: [], prices: {} };
      const merged = { ...existing.prices, ...prices };
      const newEntry = { timestamp: ts, prices };
      const newMap = {
        ...prev,
        [cruiseId]: {
          ...existing,
          prices: merged,
          lastScraped: ts,
          history: [...existing.history, newEntry],
        }
      };
      saveScrapedData(newMap);
      return newMap;
    });
  };

  const getScrapedData = (cruise) => scrapedMap[cruise.scraperId] || scrapedMap[cruise.id] || null;

  const getPriceHistory = (cruise, type) => {
    const manual = (cruise.priceHistory || []).filter(h => h.stateroomType === type);
    const scraped = getScrapedData(cruise);
    const auto = (scraped?.history || [])
      .filter(h => h.prices?.[type] != null)
      .map(h => ({ date: h.timestamp, stateroomType: type, price: h.prices[type], source: "auto" }));
    return [...manual, ...auto].sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getCurrentPrice = (cruise, type) => {
    const scraped = getScrapedData(cruise);
    if (scraped?.prices?.[type]) return scraped.prices[type];
    const v = parseFloat(cruise.currentPrices?.[type]);
    return isNaN(v) ? null : v;
  };

  const getPriceChange = (cruise, type) => {
    const hist = getPriceHistory(cruise, type);
    if (hist.length < 2) return null;
    const latest = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const change = latest.price - prev.price;
    return { change, pct: (change / prev.price) * 100, latest: latest.price };
  };

  const hasAlert = (cruise, type) => {
    const alert = parseFloat(cruise.alerts?.[type]);
    const cur = getCurrentPrice(cruise, type);
    return alert && cur && cur <= alert;
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ cruises, scrapedMap }, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cruises-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cruises) {
          saveCruises(data.cruises);
          if (data.scrapedMap) { setScraped(data.scrapedMap); saveScrapedData(data.scrapedMap); }
          alert("Imported successfully!");
        } else if (Array.isArray(data)) {
          saveCruises(data);
          alert("Imported!");
        } else { alert("Invalid file format."); }
      } catch (err) { alert("Error: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const totalAlerts = cruises.reduce((n, c) => n + STATEROOMS.filter(t => hasAlert(c, t.id)).length, 0);
  const trackedCount = cruises.filter(c => getScrapedData(c)).length;

  if (loading) return (
    <div style={s.center}>
      <Ship size={32} style={{ color:"#185FA5" }} />
      <p style={{ color:"#5F5E5A", marginTop:10, fontSize:14 }}>Loading…</p>
    </div>
  );

  return (
    <div style={s.app}>
      {/* ── Nav ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={s.logo}><Ship size={18} /></div>
            <div>
              <h1 style={s.appName}>CruiseWatch</h1>
              <p style={s.appSub}>Royal Caribbean price tracker</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={exportData} style={s.iconBtn} title="Export data">
              <Download size={15} />
            </button>
            <label style={s.iconBtn} title="Import data">
              <Upload size={15} />
              <input type="file" accept=".json" onChange={importData} style={{ display:"none" }} />
            </label>
            <button onClick={() => { setEditing(newCruise()); setShowForm(true); }} style={s.addBtn}>
              <Plus size={15} /> Add cruise
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div style={s.statsBar}>
          <StatChip label="Watching" value={cruises.length} icon={<Eye size={13} />} />
          <StatChip label="Auto-tracked" value={trackedCount} icon={<Zap size={13} />} color="#0F6E56" />
          <StatChip label="Price alerts" value={totalAlerts} icon={<Bell size={13} />} color={totalAlerts > 0 ? "#854F0B" : undefined} />
        </div>
      </header>

      <main style={s.main}>
        {cruises.length === 0 ? (
          <EmptyState onAdd={() => { setEditing(newCruise()); setShowForm(true); }} />
        ) : (
          <div style={s.cardList}>
            {cruises.map(cruise => (
              <CruiseCard
                key={cruise.id}
                cruise={cruise}
                expanded={expanded === cruise.id}
                scraped={getScrapedData(cruise)}
                getCurrentPrice={getCurrentPrice}
                getPriceChange={getPriceChange}
                getPriceHistory={getPriceHistory}
                hasAlert={hasAlert}
                onToggle={() => setExpanded(expanded === cruise.id ? null : cruise.id)}
                onEdit={() => { setEditing({ ...cruise }); setShowForm(true); }}
                onDelete={() => deleteCruise(cruise.id)}
                onSave={saveCruise}
                onSimulateScrape={simulateScrape}
              />
            ))}
          </div>
        )}
      </main>

      {showForm && editing && (
        <CruiseForm
          initial={editing}
          onSave={cruise => { saveCruise(cruise); setShowForm(false); setEditing(null); }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ── Cruise Card ───────────────────────────────────────────────────────────────
function CruiseCard({ cruise, expanded, scraped, getCurrentPrice, getPriceChange, getPriceHistory, hasAlert, onToggle, onEdit, onDelete, onSave, onSimulateScrape }) {
  const days = daysUntil(cruise.departureDate);
  const isAutoTracked = !!scraped;
  const anyAlert = STATEROOMS.some(t => hasAlert(cruise, t.id));
  const [scrapeInput, setScrapeInput] = useState({ interior:"", oceanview:"", balcony:"", suite:"" });
  const [showScrapePanel, setShowScrapePanel] = useState(false);

  const runSimScrape = () => {
    const prices = {};
    Object.entries(scrapeInput).forEach(([k,v]) => {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) prices[k] = n;
    });
    if (Object.keys(prices).length === 0) return;
    onSimulateScrape(cruise.scraperId || cruise.id, prices);
    setScrapeInput({ interior:"", oceanview:"", balcony:"", suite:"" });
    setShowScrapePanel(false);
  };

  return (
    <div style={{ ...s.card, borderColor: anyAlert ? "#EF9F27" : undefined, borderWidth: anyAlert ? 2 : 1 }}>
      {/* Card header gradient */}
      <div style={s.cardHdr}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
              <h3 style={s.cruiseName}>{cruise.name || "Unnamed cruise"}</h3>
              {isAutoTracked
                ? <Badge color="#9FE1CB" text_color="#085041"><Zap size={10} /> Auto-tracked</Badge>
                : <Badge color="rgba(255,255,255,0.2)" text_color="rgba(255,255,255,0.85)"><Clock size={10} /> Manual</Badge>
              }
              {anyAlert && <Badge color="#FAC775" text_color="#412402"><Bell size={10} /> Price alert!</Badge>}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {cruise.ship        && <MetaChip icon={<Ship size={11} />}     label={cruise.ship} />}
              {cruise.destination && <MetaChip icon={<MapPin size={11} />}   label={cruise.destination} />}
              {cruise.departureDate && <MetaChip icon={<Calendar size={11} />} label={new Date(cruise.departureDate + "T00:00:00").toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" })} />}
              {cruise.duration    && <MetaChip icon={<Anchor size={11} />}   label={`${cruise.duration} nights`} />}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            <button onClick={onEdit} style={s.hdrBtn} title="Edit"><Edit2 size={14} /></button>
            <button onClick={onDelete} style={s.hdrBtn} title="Delete"><Trash2 size={14} /></button>
          </div>
        </div>
        {days != null && days >= 0 && days <= 90 && (
          <div style={s.countdown}>
            {days === 0 ? "🎉 Departing today!" : days === 1 ? "⏰ 1 day until departure" : `⏰ ${days} days until departure`}
          </div>
        )}
        {scraped?.lastScraped && (
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)", margin:"6px 0 0" }}>
            Last scraped: {new Date(scraped.lastScraped).toLocaleString("en-SG", { dateStyle:"medium", timeStyle:"short" })}
          </p>
        )}
      </div>

      {/* Price grid */}
      <div style={{ padding:"20px 20px 0" }}>
        <div style={s.priceGrid}>
          {STATEROOMS.map(type => {
            const cur    = getCurrentPrice(cruise, type.id);
            const change = getPriceChange(cruise, type.id);
            const alert  = hasAlert(cruise, type.id);
            return (
              <PriceCell
                key={type.id}
                type={type}
                price={cur}
                change={change}
                alert={alert}
                isAutoTracked={isAutoTracked}
                cruise={cruise}
                onSave={onSave}
              />
            );
          })}
        </div>
      </div>

      {/* Expand / collapse */}
      <div style={{ padding:"12px 20px" }}>
        <button onClick={onToggle} style={s.expandBtn}>
          {expanded
            ? <><ChevronUp size={14} /> Hide details</>
            : <><ChevronDown size={14} /><BarChart3 size={14} /> History & alerts</>}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding:"0 20px 20px", borderTop:"0.5px solid #D3D1C7" }}>
          {/* Scraper info */}
          {cruise.royalCaribbeanUrl && (
            <div style={s.infoBox}>
              <Link2 size={13} style={{ color:"#185FA5", flexShrink:0 }} />
              <a href={cruise.royalCaribbeanUrl} target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5", fontSize:12, wordBreak:"break-all" }}>
                {cruise.royalCaribbeanUrl.length > 80 ? cruise.royalCaribbeanUrl.slice(0, 80) + "…" : cruise.royalCaribbeanUrl}
              </a>
            </div>
          )}
          {cruise.scraperId && (
            <div style={{ ...s.infoBox, background:"#EAF3DE", borderColor:"#C0DD97", marginTop:8 }}>
              <Zap size={13} style={{ color:"#3B6D11", flexShrink:0 }} />
              <span style={{ fontSize:12, color:"#3B6D11" }}>Scraper ID: <code style={{ fontFamily:"monospace", background:"rgba(0,0,0,0.06)", padding:"1px 5px", borderRadius:4 }}>{cruise.scraperId}</code></span>
            </div>
          )}

          {/* Simulate new scrape */}
          <div style={{ marginTop:16 }}>
            <button onClick={() => setShowScrapePanel(p => !p)} style={{ ...s.expandBtn, borderColor:"#185FA5", color:"#185FA5", gap:6 }}>
              <RefreshCw size={13} /> {showScrapePanel ? "Cancel update" : "Add today's prices (simulate scrape)"}
            </button>
            {showScrapePanel && (
              <div style={{ marginTop:10, padding:14, background:"#E6F1FB", borderRadius:10, border:"0.5px solid #85B7EB" }}>
                <p style={{ fontSize:12, color:"#0C447C", margin:"0 0 10px" }}>Enter today's prices — these will be recorded in the price history.</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  {STATEROOMS.map(t => (
                    <div key={t.id}>
                      <label style={{ fontSize:12, color:"#5F5E5A", display:"block", marginBottom:3 }}>{t.icon} {t.label}</label>
                      <input
                        type="number"
                        placeholder="Price in USD"
                        value={scrapeInput[t.id]}
                        onChange={e => setScrapeInput(p => ({ ...p, [t.id]: e.target.value }))}
                        style={s.input}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={runSimScrape} style={s.primaryBtn}>
                  <Save size={13} /> Record prices
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          <h4 style={s.sectionHead}><Bell size={13} style={{ color:"#BA7517" }} /> Price alerts</h4>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:8 }}>
            {STATEROOMS.map(type => {
              const cur = getCurrentPrice(cruise, type.id);
              const al = parseFloat(cruise.alerts?.[type.id]);
              const hit = al && cur && cur <= al;
              return (
                <div key={type.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background: hit ? "#E1F5EE" : "#F1EFE8", borderRadius:8, border:`0.5px solid ${hit ? "#5DCAA5" : "#D3D1C7"}` }}>
                  <span style={{ fontSize:13, minWidth:95, color:"#444441" }}>{type.icon} {type.label}</span>
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:12, color:"#888780" }}>$</span>
                    <input
                      type="number"
                      value={cruise.alerts?.[type.id] || ""}
                      onChange={e => onSave({ ...cruise, alerts: { ...cruise.alerts, [type.id]: e.target.value } })}
                      placeholder="Set target"
                      style={{ ...s.input, fontSize:12, padding:"4px 8px" }}
                    />
                  </div>
                  {hit && <CheckCircle size={14} style={{ color:"#0F6E56", flexShrink:0 }} />}
                </div>
              );
            })}
          </div>

          {/* History */}
          <h4 style={s.sectionHead}><BarChart3 size={13} style={{ color:"#185FA5" }} /> Price history</h4>
          <PriceHistoryTable cruise={cruise} getPriceHistory={getPriceHistory} />
        </div>
      )}
    </div>
  );
}

// ── Price Cell ────────────────────────────────────────────────────────────────
function PriceCell({ type, price, change, alert, isAutoTracked, cruise, onSave }) {
  const [val, setVal] = useState("");
  const commit = () => {
    const p = parseFloat(val);
    if (!val || isNaN(p) || p < 0) return;
    const old = parseFloat(cruise.currentPrices?.[type.id]) || 0;
    onSave({
      ...cruise,
      currentPrices: { ...cruise.currentPrices, [type.id]: val },
      priceHistory: [...(cruise.priceHistory || []), {
        date: new Date().toISOString(), stateroomType: type.id,
        price: p, change: old ? p - old : 0, source: "manual"
      }],
    });
    setVal("");
  };

  return (
    <div style={{
      padding:14, borderRadius:10,
      border: `${alert ? 2 : 1}px solid ${alert ? "#1D9E75" : "#D3D1C7"}`,
      background: alert ? "#E1F5EE" : "#FAFAF8",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <span style={{ fontSize:18 }}>{type.icon}</span>
          <span style={{ fontWeight:500, fontSize:12, marginLeft:5, color:"#444441" }}>{type.label}</span>
          {alert && <div style={{ fontSize:10, color:"#085041", marginTop:2 }}>🔔 Alert hit!</div>}
        </div>
        {change && (
          <span style={{ fontSize:12, fontWeight:500, color: change.change < 0 ? "#0F6E56" : "#993C1D", display:"flex", alignItems:"center", gap:2 }}>
            {change.change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {Math.abs(change.pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ marginBottom: isAutoTracked ? 0 : 6 }}>
        <span style={{ fontSize:22, fontWeight:600, color: type.color }}>{fmt(price)}</span>
        {change && (
          <span style={{ fontSize:11, color: change.change < 0 ? "#0F6E56" : "#993C1D", marginLeft:6 }}>
            ({change.change > 0 ? "+" : ""}{fmt(change.change)})
          </span>
        )}
      </div>
      {!isAutoTracked && (
        <div style={{ display:"flex", gap:5, marginTop:4 }}>
          <input
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && commit()}
            placeholder="Manual price"
            style={{ ...s.input, fontSize:11, padding:"4px 7px", flex:1 }}
          />
          <button onClick={commit} style={{ padding:"4px 10px", background:"#185FA5", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:11 }}>Set</button>
        </div>
      )}
      {isAutoTracked && (
        <p style={{ fontSize:10, color:"#888780", margin:0 }}>Auto-updated</p>
      )}
    </div>
  );
}

// ── Price History Table ───────────────────────────────────────────────────────
function PriceHistoryTable({ cruise, getPriceHistory }) {
  const all = STATEROOMS.flatMap(t =>
    getPriceHistory(cruise, t.id).map(h => ({ ...h, typeInfo: t }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  if (!all.length) return (
    <div style={{ textAlign:"center", padding:"18px", background:"#F1EFE8", borderRadius:8, color:"#888780", fontSize:13 }}>
      No history yet. Prices are recorded after each daily scrape or manual entry.
    </div>
  );

  return (
    <div style={{ maxHeight:300, overflowY:"auto", borderRadius:8, border:"0.5px solid #D3D1C7", overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ background:"#F1EFE8" }}>
            <th style={s.th}>Date</th>
            <th style={s.th}>Category</th>
            <th style={s.th}>Price</th>
            <th style={s.th}>Change</th>
            <th style={s.th}>Source</th>
          </tr>
        </thead>
        <tbody>
          {all.map((entry, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#FAFAF8", borderTop:"0.5px solid #D3D1C7" }}>
              <td style={s.td}>{new Date(entry.date).toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" })}</td>
              <td style={s.td}>{entry.typeInfo.icon} {entry.typeInfo.label}</td>
              <td style={{ ...s.td, fontWeight:500, color: entry.typeInfo.color }}>{fmt(entry.price)}</td>
              <td style={{ ...s.td, color: entry.change < 0 ? "#0F6E56" : entry.change > 0 ? "#993C1D" : "#888780" }}>
                {entry.change > 0 ? "+" : ""}{entry.change !== 0 ? fmt(entry.change) : "—"}
              </td>
              <td style={s.td}>
                <span style={{ fontSize:10, background: entry.source === "auto" ? "#C0DD97" : "#D3D1C7", color: entry.source === "auto" ? "#27500A" : "#444441", padding:"2px 6px", borderRadius:20 }}>
                  {entry.source}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add/Edit Form ─────────────────────────────────────────────────────────────
function CruiseForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [urlStatus, setUrlStatus] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPrice = (k, v) => setForm(f => ({ ...f, currentPrices: { ...f.currentPrices, [k]: v } }));

  const parseUrl = (url) => {
    if (!url || !url.includes("royalcaribbean.com")) return;
    const parsed = parseRCUrl(url);
    if (!parsed) { setUrlStatus("error"); return; }
    setForm(f => ({
      ...f,
      royalCaribbeanUrl: url,
      name: parsed.name || f.name,
      ship: parsed.ship || f.ship,
      departureDate: parsed.departureDate || f.departureDate,
      duration: parsed.duration || f.duration,
      currentPrices: {
        ...(f.currentPrices || {}),
        ...(parsed.stateroomType && parsed.urlPrice ? { [parsed.stateroomType]: String(parsed.urlPrice) } : {}),
      },
    }));
    setUrlStatus(parsed.urlPrice ? "success" : "partial");
  };

  const handleSave = () => {
    if (!form.name || !form.departureDate) {
      alert("Please fill in at least the cruise name and departure date.");
      return;
    }
    onSave(form);
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHdr}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Ship size={17} />
            <h2 style={{ color:"#fff", fontWeight:500, fontSize:17, margin:0 }}>
              {form.name ? "Edit cruise" : "Add cruise to watchlist"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:6, padding:"6px 9px", cursor:"pointer", color:"#fff" }}><X size={14} /></button>
        </div>

        <div style={{ padding:20, overflowY:"auto", flex:1 }}>
          {/* URL auto-fill */}
          <div style={{ background:"#E6F1FB", border:"0.5px solid #85B7EB", borderRadius:10, padding:14, marginBottom:18 }}>
            <label style={{ fontSize:13, fontWeight:500, color:"#0C447C", display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <Link2 size={13} /> Paste Royal Caribbean checkout URL (auto-fills details)
            </label>
            <input
              type="url"
              value={form.royalCaribbeanUrl || ""}
              onChange={e => set("royalCaribbeanUrl", e.target.value)}
              onBlur={e => parseUrl(e.target.value)}
              placeholder="https://www.royalcaribbean.com/checkout/guest-info?sailDate=…"
              style={{ ...s.input, width:"100%", boxSizing:"border-box" }}
            />
            {urlStatus === "success" && <p style={{ margin:"5px 0 0", fontSize:12, color:"#085041" }}>✅ Ship, date & price filled from URL!</p>}
            {urlStatus === "partial" && <p style={{ margin:"5px 0 0", fontSize:12, color:"#BA7517" }}>✅ Ship & date filled — enter price manually below.</p>}
            {urlStatus === "error"   && <p style={{ margin:"5px 0 0", fontSize:12, color:"#993C1D" }}>❌ Could not parse URL. Fill in details manually.</p>}
            {!urlStatus && <p style={{ margin:"5px 0 0", fontSize:12, color:"#185FA5" }}>💡 Go to royalcaribbean.com → pick cabin → reach guest info page → copy URL here.</p>}

            <div style={{ marginTop:12 }}>
              <label style={{ fontSize:12, fontWeight:500, color:"#0C447C", display:"block", marginBottom:5 }}>
                Scraper ID <span style={{ fontWeight:400, color:"#378ADD" }}>(optional — links to GitHub Actions scraper)</span>
              </label>
              <input
                type="text"
                value={form.scraperId || ""}
                onChange={e => set("scraperId", e.target.value)}
                placeholder="e.g. harmony-dec-2026 (must match id in CRUISE_URLS secret)"
                style={{ ...s.input, width:"100%", boxSizing:"border-box" }}
              />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <FormField label="Cruise name *">
              <input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Caribbean Adventure 2026" style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
            </FormField>
            <FormField label="Ship">
              <input value={form.ship || ""} onChange={e => set("ship", e.target.value)} placeholder="Harmony of the Seas" style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
            </FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <FormField label="Departure date *">
              <input type="date" value={form.departureDate || ""} onChange={e => set("departureDate", e.target.value)} style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
            </FormField>
            <FormField label="Duration (nights)">
              <input type="number" min="1" value={form.duration || ""} onChange={e => set("duration", e.target.value)} placeholder="7" style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
            </FormField>
            <FormField label="Destination">
              <input value={form.destination || ""} onChange={e => set("destination", e.target.value)} placeholder="Eastern Caribbean" style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
            </FormField>
          </div>

          <FormField label="Starting prices (optional)">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {STATEROOMS.map(t => (
                <div key={t.id} style={{ border:"0.5px solid #D3D1C7", borderRadius:8, padding:10 }}>
                  <label style={{ fontSize:12, fontWeight:500, display:"block", marginBottom:5 }}>{t.icon} {t.label}</label>
                  <input type="number" min="0" value={form.currentPrices?.[t.id] || ""} onChange={e => setPrice(t.id, e.target.value)} placeholder="Price USD" style={{ ...s.input, width:"100%", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>
          </FormField>

          <div style={{ display:"flex", gap:10, marginTop:18 }}>
            <button onClick={handleSave} style={{ ...s.primaryBtn, flex:1, justifyContent:"center", padding:12, fontSize:14 }}>
              <Save size={14} /> {form.name ? "Save changes" : "Add to watchlist"}
            </button>
            <button onClick={onClose} style={{ padding:"12px 20px", background:"#F1EFE8", border:"0.5px solid #B4B2A9", borderRadius:8, cursor:"pointer", fontSize:14 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ color, text_color, children }) {
  return (
    <span style={{ background: color, color: text_color, fontSize:11, fontWeight:500, padding:"3px 9px", borderRadius:20, display:"inline-flex", alignItems:"center", gap:4 }}>
      {children}
    </span>
  );
}
function MetaChip({ icon, label }) {
  return (
    <span style={{ background:"rgba(255,255,255,0.18)", borderRadius:20, padding:"3px 9px", display:"inline-flex", alignItems:"center", gap:4, fontSize:12, color:"rgba(255,255,255,0.9)" }}>
      {icon}{label}
    </span>
  );
}
function StatChip({ label, value, icon, color = "#185FA5" }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", background:"rgba(255,255,255,0.7)", borderRadius:20, border:"0.5px solid #D3D1C7" }}>
      <span style={{ color, display:"flex" }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:600, color }}>{value}</span>
      <span style={{ fontSize:12, color:"#5F5E5A" }}>{label}</span>
    </div>
  );
}
function FormField({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:500, marginBottom:5, color:"#444441" }}>{label}</label>
      {children}
    </div>
  );
}
function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign:"center", padding:"60px 20px" }}>
      <Ship size={48} style={{ color:"#B5D4F4", marginBottom:16 }} />
      <h2 style={{ fontSize:22, fontWeight:500, color:"#2C2C2A", margin:"0 0 8px" }}>No cruises tracked yet</h2>
      <p style={{ color:"#5F5E5A", fontSize:14, margin:"0 0 24px" }}>Add a Royal Caribbean cruise to start monitoring prices daily.</p>
      <button onClick={onAdd} style={s.primaryBtn}>
        <Plus size={15} /> Add your first cruise
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  app:        { minHeight:"100vh", background:"linear-gradient(160deg,#EBF5FF 0%,#F0EEFF 100%)", fontFamily:"system-ui,-apple-system,sans-serif" },
  center:     { minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" },
  header:     { background:"#fff", borderBottom:"0.5px solid #D3D1C7", position:"sticky", top:0, zIndex:10 },
  headerInner:{ maxWidth:980, margin:"0 auto", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  logo:       { width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#185FA5,#534AB7)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" },
  appName:    { fontSize:18, fontWeight:600, margin:0, color:"#0C447C" },
  appSub:     { fontSize:11, color:"#888780", margin:0 },
  statsBar:   { maxWidth:980, margin:"0 auto", padding:"8px 20px 10px", display:"flex", gap:8, flexWrap:"wrap" },
  main:       { maxWidth:980, margin:"0 auto", padding:"20px" },
  cardList:   { display:"flex", flexDirection:"column", gap:16 },
  card:       { background:"#fff", borderRadius:14, border:"1px solid #D3D1C7", overflow:"hidden" },
  cardHdr:    { background:"linear-gradient(135deg,#185FA5,#534AB7)", padding:"18px 20px", color:"#fff" },
  cruiseName: { fontWeight:600, fontSize:18, margin:0, color:"#fff" },
  countdown:  { marginTop:10, display:"inline-block", background:"rgba(255,255,255,0.2)", color:"#fff", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:500 },
  hdrBtn:     { padding:"6px 9px", background:"rgba(255,255,255,0.18)", border:"none", borderRadius:7, cursor:"pointer", color:"#fff" },
  iconBtn:    { padding:"7px 11px", background:"#F1EFE8", border:"0.5px solid #D3D1C7", borderRadius:8, cursor:"pointer", color:"#444441", display:"inline-flex", alignItems:"center" },
  addBtn:     { padding:"8px 16px", background:"#185FA5", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500, display:"inline-flex", alignItems:"center", gap:6 },
  primaryBtn: { padding:"8px 16px", background:"#185FA5", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500, display:"inline-flex", alignItems:"center", gap:6 },
  priceGrid:  { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:0 },
  expandBtn:  { width:"100%", padding:9, background:"none", border:"0.5px solid #D3D1C7", borderRadius:8, cursor:"pointer", color:"#185FA5", fontSize:12, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", gap:5 },
  sectionHead:{ fontWeight:500, fontSize:14, margin:"18px 0 8px", display:"flex", alignItems:"center", gap:6, color:"#2C2C2A" },
  infoBox:    { padding:"9px 12px", background:"#E6F1FB", border:"0.5px solid #B5D4F4", borderRadius:8, display:"flex", alignItems:"flex-start", gap:8, marginTop:14 },
  input:      { padding:"7px 10px", border:"0.5px solid #B4B2A9", borderRadius:7, fontSize:13, background:"#fff", color:"#2C2C2A", outline:"none", width:"100%" },
  overlay:    { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:50 },
  modal:      { background:"#fff", borderRadius:14, width:"100%", maxWidth:640, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" },
  modalHdr:   { background:"linear-gradient(135deg,#185FA5,#534AB7)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  th:         { textAlign:"left", padding:"8px 10px", fontSize:11, fontWeight:600, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.04em" },
  td:         { padding:"7px 10px", fontSize:12, color:"#2C2C2A" },
};
