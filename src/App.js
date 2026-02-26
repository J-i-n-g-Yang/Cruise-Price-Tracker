import React, { useState, useEffect, useCallback } from 'react';
import {
  Ship, TrendingDown, TrendingUp, Plus, Trash2, Edit2, Save, X,
  DollarSign, Calendar, MapPin, Users, Bell, RefreshCw,
  ChevronDown, ChevronUp, Download, Upload, BarChart3, Link, Loader2,
} from 'lucide-react';
import './App.css';

const STORAGE_KEY = 'royal-caribbean-cruises';
const BACKEND_URL = process.env.REACT_APP_SCRAPER_URL || null;
const SCRAPED_PRICES_URL = './data/prices.json';

export default function App() {
  const [cruises, setCruises] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCruise, setEditingCruise] = useState(null);
  const [expandedCruise, setExpandedCruise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrapedData, setScrapedData] = useState({});
  const [lastAutoUpdate, setLastAutoUpdate] = useState(null);

  const stateroomTypes = [
    { id: 'interior', name: 'Interior', icon: '🛏️' },
    { id: 'oceanview', name: 'Ocean View', icon: '🪟' },
    { id: 'balcony', name: 'Balcony', icon: '🌊' },
    { id: 'suite', name: 'Suite', icon: '👑' },
  ];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCruises(parsed.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate)));
      }
    } catch (e) { console.error('Error loading cruises:', e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch(SCRAPED_PRICES_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const map = {};
        for (const entry of data) { if (entry.url) map[entry.url] = entry; }
        setScrapedData(map);
        const latest = data.reduce((max, e) => ((e.lastScraped || '') > max ? e.lastScraped : max), '');
        if (latest) setLastAutoUpdate(new Date(latest));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (Object.keys(scrapedData).length === 0) return;
    setCruises(prev => {
      let changed = false;
      const updated = prev.map(cruise => {
        const scraped = cruise.royalCaribbeanUrl && scrapedData[cruise.royalCaribbeanUrl];
        if (!scraped?.prices) return cruise;
        const newCruise = { ...cruise, currentPrices: { ...cruise.currentPrices }, priceHistory: [...(cruise.priceHistory || [])] };
        let priceChanged = false;
        for (const type of ['interior', 'oceanview', 'balcony', 'suite']) {
          const scrapedPrice = scraped.prices[type];
          const currentPrice = parseFloat(cruise.currentPrices[type]);
          if (scrapedPrice && scrapedPrice !== currentPrice) {
            newCruise.currentPrices[type] = scrapedPrice.toString();
            newCruise.priceHistory.push({ date: scraped.lastScraped || new Date().toISOString(), stateroomType: type, price: scrapedPrice, change: currentPrice ? scrapedPrice - currentPrice : 0, source: 'auto' });
            priceChanged = true;
          }
        }
        if (priceChanged) changed = true;
        return newCruise;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
      }
      return prev;
    });
  }, [scrapedData]);

  const saveCruises = useCallback((updatedCruises) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCruises));
      setCruises(updatedCruises.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate)));
    } catch { alert('Failed to save cruise data'); }
  }, []);

  const saveCruise = useCallback((cruise) => {
    setCruises(prev => {
      const idx = prev.findIndex(c => c.id === cruise.id);
      const updated = idx >= 0 ? prev.map((c, i) => (i === idx ? cruise : c)) : [...prev, cruise];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
    });
  }, []);

  const deleteCruise = (cruiseId) => {
    if (!window.confirm('Delete this cruise?')) return;
    saveCruises(cruises.filter(c => c.id !== cruiseId));
  };

  const addNewCruise = () => {
    setEditingCruise({
      id: Date.now().toString(), name: '', ship: '', departureDate: '', duration: '', destination: '',
      royalCaribbeanUrl: '', priceHistory: [],
      currentPrices: { interior: '', oceanview: '', balcony: '', suite: '' },
      alerts: { interior: '', oceanview: '', balcony: '', suite: '' },
    });
    setShowAddForm(true);
  };

  const updatePrice = (cruise, stateroomType, newPrice) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    const oldPrice = parseFloat(cruise.currentPrices[stateroomType]) || 0;
    saveCruise({ ...cruise, currentPrices: { ...cruise.currentPrices, [stateroomType]: price.toString() }, priceHistory: [...(cruise.priceHistory || []), { date: new Date().toISOString(), stateroomType, price, change: oldPrice ? price - oldPrice : 0 }] });
  };

  const calculatePriceChange = (cruise, stateroomType) => {
    const history = cruise.priceHistory?.filter(h => h.stateroomType === stateroomType) || [];
    if (history.length < 2) return null;
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const change = latest.price - previous.price;
    return { change, percentChange: (change / previous.price) * 100 };
  };

  const checkPriceAlert = (cruise, stateroomType) => {
    const alertPrice = parseFloat(cruise.alerts[stateroomType]);
    const currentPrice = parseFloat(cruise.currentPrices[stateroomType]);
    return alertPrice && currentPrice && currentPrice <= alertPrice;
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(cruises, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cruise-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) { saveCruises(imported); alert('Imported successfully!'); }
        else alert('Invalid file format');
      } catch (err) { alert('Error: ' + err.message); }
    };
    reader.readAsText(file);
  };

  const CruiseCard = ({ cruise }) => {
    const isExpanded = expandedCruise === cruise.id;
    const daysUntil = Math.ceil((new Date(cruise.departureDate) - new Date()) / 86400000);
    const hasAutoData = cruise.royalCaribbeanUrl && scrapedData[cruise.royalCaribbeanUrl];

    return (
      <div className="cruise-card bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="text-2xl font-bold">{cruise.name}</h3>
                {hasAutoData && (
                  <span className="bg-green-400 text-green-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Auto-tracked
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  { icon: <Ship className="w-4 h-4" />, text: cruise.ship },
                  { icon: <MapPin className="w-4 h-4" />, text: cruise.destination },
                  { icon: <Calendar className="w-4 h-4" />, text: new Date(cruise.departureDate).toLocaleDateString() },
                  { icon: <Users className="w-4 h-4" />, text: `${cruise.duration} nights` },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                    {icon}<span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingCruise({ ...cruise }); setShowAddForm(true); }} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deleteCruise(cruise.id)} className="p-2 bg-white/20 hover:bg-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          {daysUntil >= 0 && (
            <div className="bg-yellow-400 text-gray-900 rounded-lg px-4 py-2 inline-block font-semibold">
              {daysUntil === 0 ? '🎉 Departing Today!' : `⏰ ${daysUntil} days until departure`}
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {stateroomTypes.map((type) => {
              const currentPrice = cruise.currentPrices[type.id];
              const priceChange = calculatePriceChange(cruise, type.id);
              const hasAlert = checkPriceAlert(cruise, type.id);
              return (
                <div key={type.id} className={`p-4 rounded-lg border-2 ${hasAlert ? 'border-green-500 bg-green-50 ring-4 ring-green-200' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{type.icon}</span>
                      <div>
                        <h4 className="font-bold text-gray-900">{type.name}</h4>
                        {hasAlert && <div className="flex items-center gap-1 text-green-700 text-xs font-semibold"><Bell className="w-3 h-3" /><span>🎯 Price Alert!</span></div>}
                      </div>
                    </div>
                    {priceChange && (
                      <div className={`flex items-center gap-1 text-sm font-bold ${priceChange.change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {priceChange.change < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        <span>{priceChange.percentChange.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold text-blue-600">{currentPrice ? `$${parseFloat(currentPrice).toLocaleString()}` : '—'}</span>
                    {priceChange && (
                      <span className={`text-sm font-semibold ${priceChange.change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({priceChange.change > 0 ? '+' : ''}${priceChange.change.toFixed(0)})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Override price"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { updatePrice(cruise, type.id, e.target.value); e.target.value = ''; } }} />
                    <button onClick={(e) => { const input = e.target.closest('div').querySelector('input'); if (input.value) { updatePrice(cruise, type.id, input.value); input.value = ''; } }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Update</button>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={() => setExpandedCruise(isExpanded ? null : cruise.id)}
            className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-semibold flex items-center justify-center gap-2">
            {isExpanded ? <><ChevronUp className="w-4 h-4" />Hide Details</> : <><ChevronDown className="w-4 h-4" /><BarChart3 className="w-4 h-4" />Show Price History & Alerts</>}
          </button>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
              {cruise.royalCaribbeanUrl && (
                <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-2 text-sm">
                  <Link className="w-4 h-4 text-blue-500 shrink-0" />
                  <a href={cruise.royalCaribbeanUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{cruise.royalCaribbeanUrl}</a>
                </div>
              )}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-lg"><Bell className="w-5 h-5 text-yellow-500" />Price Alerts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stateroomTypes.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700 w-28">{type.icon} {type.name}:</span>
                      <div className="flex-1 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <input type="number" value={cruise.alerts[type.id] || ''}
                          onChange={(e) => saveCruise({ ...cruise, alerts: { ...cruise.alerts, [type.id]: e.target.value } })}
                          placeholder="Alert price"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-lg"><RefreshCw className="w-5 h-5 text-blue-500" />Price History</h4>
                {cruise.priceHistory?.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {[...cruise.priceHistory].reverse().map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">{new Date(entry.date).toLocaleDateString()}</span>
                          <span className="font-bold text-gray-800">{stateroomTypes.find(t => t.id === entry.stateroomType)?.icon}{' '}{stateroomTypes.find(t => t.id === entry.stateroomType)?.name}</span>
                          {entry.source === 'auto' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">auto</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-blue-600 text-lg">${entry.price.toLocaleString()}</span>
                          {entry.change !== 0 && (
                            <span className={`flex items-center gap-1 font-semibold ${entry.change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.change < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                              {entry.change > 0 ? '+' : ''}${entry.change.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm italic">No price history yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AddEditForm = () => {
    const [formData, setFormData] = useState(editingCruise || {});
    const [urlLoading, setUrlLoading] = useState(false);
    const [urlStatus, setUrlStatus] = useState('');

    const parseCheckoutUrl = (rawUrl) => {
      const SHIP_NAMES = {
        AD:'Adventure of the Seas',AL:'Allure of the Seas',AN:'Anthem of the Seas',
        BR:'Brilliance of the Seas',EN:'Enchantment of the Seas',EX:'Explorer of the Seas',
        FR:'Freedom of the Seas',GR:'Grandeur of the Seas',HM:'Harmony of the Seas',
        IC:'Icon of the Seas',ID:'Independence of the Seas',JW:'Jewel of the Seas',
        LB:'Liberty of the Seas',MA:'Mariner of the Seas',NV:'Navigator of the Seas',
        OA:'Oasis of the Seas',OY:'Odyssey of the Seas',OV:'Ovation of the Seas',
        QN:'Quantum of the Seas',RD:'Radiance of the Seas',RH:'Rhapsody of the Seas',
        SC:'Spectrum of the Seas',SR:'Serenade of the Seas',ST:'Star of the Seas',
        SY:'Symphony of the Seas',UT:'Utopia of the Seas',VI:'Vision of the Seas',
        VY:'Voyager of the Seas',WN:'Wonder of the Seas',
      };
      const CABIN_MAP = {
        INTERIOR:'interior',INSIDE:'interior',OUTSIDE:'oceanview',OCEANVIEW:'oceanview',
        OCEAN_VIEW:'oceanview',BALCONY:'balcony',DELUXE:'balcony',
        SUITE:'suite',GRAND_SUITE:'suite',SKY_SUITE:'suite',
      };
      try {
        const u = new URL(rawUrl);
        const p = u.searchParams;
        const shipCode = (p.get('shipCode') || '').toUpperCase();
        const sailDate = p.get('sailDate') || '';
        const cabinRaw = (p.get('cabinClassType') || p.get('r0d') || '').toUpperCase();
        const adults = parseInt(p.get('r0a') || '2');
        const stateroomType = CABIN_MAP[cabinRaw] || null;
        const ship = SHIP_NAMES[shipCode] || shipCode || null;
        const pricePerPerson = p.get('r0j') ? parseFloat(p.get('r0j')) : null;
        const totalPrice = pricePerPerson ? Math.round(pricePerPerson * adults * 100) / 100 : null;
        let departureDate = sailDate;
        let friendlyDate = '';
        if (sailDate) {
          const d = new Date(sailDate);
          if (!isNaN(d)) {
            departureDate = d.toISOString().split('T')[0];
            friendlyDate = d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
          }
        }
        let duration = null;
        const pkgMatch = (p.get('packageCode') || '').match(/[A-Z]{2}(\d+)[A-Z]/);
        if (pkgMatch) duration = pkgMatch[1];
        const r0fMatch = (p.get('r0f') || '').match(/^(\d+)N$/i);
        if (!duration && r0fMatch) duration = r0fMatch[1];
        const name = ship && friendlyDate ? `${ship} — ${friendlyDate}` : null;
        const prices = {};
        if (totalPrice && stateroomType) prices[stateroomType] = totalPrice;
        return { name, ship, departureDate, duration, stateroomType, pricePerPerson, totalPrice, adults, prices };
      } catch { return null; }
    };

    const fetchFromUrl = async (url) => {
      if (!url || !url.includes('royalcaribbean.com')) return;
      setUrlLoading(true);
      setUrlStatus('');
      const isCheckoutUrl = url.includes('/checkout/guest-info');
      try {
        if (isCheckoutUrl) {
          const parsed = parseCheckoutUrl(url);
          if (parsed && (parsed.ship || parsed.totalPrice)) {
            setFormData(prev => ({
              ...prev,
              royalCaribbeanUrl: url,
              name: parsed.name || prev.name,
              ship: parsed.ship || prev.ship,
              departureDate: parsed.departureDate || prev.departureDate,
              duration: parsed.duration || prev.duration,
              currentPrices: {
                interior: parsed.prices?.interior?.toString() || prev.currentPrices?.interior || '',
                oceanview: parsed.prices?.oceanview?.toString() || prev.currentPrices?.oceanview || '',
                balcony: parsed.prices?.balcony?.toString() || prev.currentPrices?.balcony || '',
                suite: parsed.prices?.suite?.toString() || prev.currentPrices?.suite || '',
              },
            }));
            setUrlStatus(parsed.totalPrice ? 'success' : 'partial_no_price');
            setUrlLoading(false);
            return;
          }
        }
        if (BACKEND_URL) {
          const res = await fetch(`${BACKEND_URL}/api/scrape-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          const result = await res.json();
          if (result.needsCheckoutUrl) {
            setFormData(prev => ({ ...prev, royalCaribbeanUrl: url }));
            setUrlStatus('needs_checkout');
          } else if (result.success && result.data) {
            const d = result.data;
            setFormData(prev => ({ ...prev, royalCaribbeanUrl: url, name: d.name || prev.name, ship: d.ship || prev.ship, departureDate: d.departureDate || prev.departureDate, duration: d.duration || prev.duration, currentPrices: { interior: d.prices?.interior?.toString() || prev.currentPrices?.interior || '', oceanview: d.prices?.oceanview?.toString() || prev.currentPrices?.oceanview || '', balcony: d.prices?.balcony?.toString() || prev.currentPrices?.balcony || '', suite: d.prices?.suite?.toString() || prev.currentPrices?.suite || '' } }));
            setUrlStatus('success');
          } else { setUrlStatus('needs_checkout'); }
        } else {
          setFormData(prev => ({ ...prev, royalCaribbeanUrl: url }));
          setUrlStatus(isCheckoutUrl ? 'saved' : 'needs_checkout');
        }
      } catch { setUrlStatus('error'); }
      setUrlLoading(false);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      saveCruise(formData);
      setShowAddForm(false);
      setEditingCruise(null);
    };

    const statusMessages = {
      success: { color: 'text-green-600', msg: '✅ Ship, date & price auto-filled from URL!' },
      partial_no_price: { color: 'text-amber-600', msg: '✅ Ship & date filled. Price not found in URL — enter manually or use a checkout URL for auto-pricing.' },
      needs_checkout: { color: 'text-amber-600', msg: '⚠️ For auto-fill to work, use a checkout URL. Go to royalcaribbean.com → select cruise → pick cabin → proceed to guest info page → copy that URL.' },
      saved: { color: 'text-blue-600', msg: 'ℹ️ URL saved. GitHub Actions will auto-track prices on next run. Fill in details manually for now.' },
      error: { color: 'text-red-600', msg: '❌ Something went wrong. Fill in details manually.' },
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex justify-between items-center z-10">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Ship className="w-7 h-7" />{formData.name ? 'Edit Cruise' : 'Add New Cruise'}
            </h2>
            <button onClick={() => { setShowAddForm(false); setEditingCruise(null); }} className="text-white hover:bg-white/20 rounded-lg p-2"><X className="w-6 h-6" /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                <Link className="w-4 h-4" />Paste Royal Caribbean Checkout URL to Auto-Fill
              </label>
              <div className="flex gap-2">
                <input type="url" value={formData.royalCaribbeanUrl || ''}
                  onChange={(e) => setFormData({ ...formData, royalCaribbeanUrl: e.target.value })}
                  onBlur={(e) => fetchFromUrl(e.target.value)}
                  placeholder="https://www.royalcaribbean.com/checkout/guest-info?..."
                  className="flex-1 px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                <button type="button" onClick={() => fetchFromUrl(formData.royalCaribbeanUrl)} disabled={urlLoading}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
                  {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {urlLoading ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
              {urlStatus && <p className={`mt-2 text-sm font-medium ${statusMessages[urlStatus]?.color}`}>{statusMessages[urlStatus]?.msg}</p>}
              {!urlStatus && (
                <div className="mt-2 text-xs text-blue-600 space-y-1">
                  <p className="font-semibold">💡 How to get the right URL:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-500">
                    <li>Open royalcaribbean.com in <strong>incognito</strong> mode (logged out)</li>
                    <li>Search your cruise, pick cabin type, proceed to <strong>Guest Info</strong> page</li>
                    <li>Copy the full URL — starts with <code className="bg-blue-100 px-1 rounded">/checkout/guest-info?</code></li>
                    <li>Paste here — ship, date & price fill instantly!</li>
                  </ol>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Cruise Name *</label>
              <input type="text" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Caribbean Adventure 2026" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Ship Name *</label>
                <input type="text" required value={formData.ship || ''} onChange={(e) => setFormData({ ...formData, ship: e.target.value })}
                  placeholder="e.g., Harmony of the Seas" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Departure Date *</label>
                <input type="date" required value={formData.departureDate || ''} onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Duration (nights) *</label>
                <input type="number" required min="1" value={formData.duration || ''} onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="7" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Destination *</label>
                <input type="text" required value={formData.destination || ''} onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="e.g., Eastern Caribbean" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3">Prices <span className="font-normal text-gray-500">(auto-filled from URL — or enter manually)</span></label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stateroomTypes.map((type) => (
                  <div key={type.id} className="border-2 border-gray-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{type.icon} {type.name}</label>
                    <input type="number" min="0" value={formData.currentPrices?.[type.id] || ''}
                      onChange={(e) => setFormData({ ...formData, currentPrices: { ...formData.currentPrices, [type.id]: e.target.value } })}
                      placeholder="Price" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <Save className="w-5 h-5" />{formData.name ? 'Save Changes' : 'Add Cruise'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setEditingCruise(null); }} className="px-8 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Ship className="w-20 h-20 text-blue-600 animate-bounce mx-auto mb-4" />
          <p className="text-gray-700 text-lg font-semibold">Loading your cruises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Ship className="w-10 h-10 text-blue-600" />Royal Caribbean Price Tracker
              </h1>
              <p className="text-gray-600">Track stateroom prices and get alerts when prices drop 📉</p>
              {lastAutoUpdate && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />Prices auto-updated: {lastAutoUpdate.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <label className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-3 rounded-lg cursor-pointer flex items-center gap-2 shadow">
                <Upload className="w-5 h-5" />Import<input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
              <button onClick={exportData} disabled={cruises.length === 0} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-3 rounded-lg flex items-center gap-2 shadow disabled:opacity-50">
                <Download className="w-5 h-5" />Export
              </button>
              <button onClick={addNewCruise} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg">
                <Plus className="w-5 h-5" />Add Cruise
              </button>
            </div>
          </div>
        </div>

        {cruises.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Ship className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No cruises tracked yet</h3>
            <p className="text-gray-600 mb-6">Paste a Royal Caribbean checkout URL to auto-fill, or add details manually!</p>
            <button onClick={addNewCruise} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 py-4 rounded-lg inline-flex items-center gap-2 shadow-lg">
              <Plus className="w-5 h-5" />Add Your First Cruise
            </button>
          </div>
        ) : (
          <div className="space-y-6">{cruises.map((cruise) => <CruiseCard key={cruise.id} cruise={cruise} />)}</div>
        )}

        {showAddForm && <AddEditForm />}
      </div>
    </div>
  );
}
