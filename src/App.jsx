import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createSync, apiFetch, setAccessCode, LOCKED_EVENT } from "./sync.js";
import { nid, localISO, esc, CATS, C_ICO, C_CLR, stockState } from "./shared.js";
import { Icon, Toast, Sheet, Stepper, ItemForm, EditForm, ShopTab, LockScreen, SettingsModal } from "./ui.jsx";
import "./styles.css";

// ─── Smart local product keyword database ─────────────────────────────────────
const PRODUCT_DB = [
  // Oral Care
  {keywords:["toothpaste","colgate","sensodyne","oral-b","crest","aquafresh","closeup","darlie","fluoride"],  name:"Toothpaste",        category:"Oral Care",       unit:"tube",   emoji:"🦷"},
  {keywords:["toothbrush","oral b","dentalcare"],                                                              name:"Toothbrush",         category:"Oral Care",       unit:"piece",  emoji:"🪥"},
  {keywords:["mouthwash","listerine","scope","mouth rinse","oral rinse"],                                      name:"Mouthwash",          category:"Oral Care",       unit:"bottle", emoji:"🦷"},
  {keywords:["dental floss","floss","flossing"],                                                               name:"Dental Floss",       category:"Oral Care",       unit:"piece",  emoji:"🦷"},
  // Toilet Paper
  {keywords:["toilet paper","toilet roll","bathroom tissue","charmin","cottonelle","scott","kleenex bathroom"],name:"Toilet Paper",       category:"Toilet Paper",    unit:"roll",   emoji:"🧻"},
  {keywords:["tissue","facial tissue","kleenex","handkerchief"],                                               name:"Tissue Paper",       category:"Toilet Paper",    unit:"pack",   emoji:"🧻"},
  {keywords:["paper towel","bounty","kitchen roll","kitchen paper"],                                           name:"Paper Towel",        category:"Toilet Paper",    unit:"roll",   emoji:"🧻"},
  // Personal Care
  {keywords:["shampoo","head shoulders","pantene","rejoice","sunsilk","dove shampoo","tresemme","loreal hair","hair wash","h&s"],name:"Shampoo",category:"Personal Care",unit:"bottle",emoji:"🧴"},
  {keywords:["conditioner","hair conditioner","treatment"],                                                    name:"Conditioner",        category:"Personal Care",   unit:"bottle", emoji:"🧴"},
  {keywords:["body wash","shower gel","safeguard","dove body","lifebuoy","palmolive shower"],                  name:"Body Wash",          category:"Personal Care",   unit:"bottle", emoji:"🚿"},
  {keywords:["hand soap","hand wash","liquid soap","handsoap"],                                                name:"Hand Soap",          category:"Personal Care",   unit:"bottle", emoji:"🧼"},
  {keywords:["bar soap","bath soap","irish spring","dove bar","palmolive bar","lux","safeguard bar"],          name:"Bar Soap",           category:"Personal Care",   unit:"bar",    emoji:"🧼"},
  {keywords:["deodorant","antiperspirant","rexona","dove deo","axe","sure","nivea deo","degree"],              name:"Deodorant",          category:"Personal Care",   unit:"piece",  emoji:"✨"},
  {keywords:["facial wash","face wash","cleanser","cetaphil","neutrogena","pond","clean clear","acne"],        name:"Facial Wash",        category:"Personal Care",   unit:"bottle", emoji:"🫧"},
  {keywords:["lotion","moisturizer","body lotion","vaseline","nivea","jergens","celeteque"],                   name:"Body Lotion",        category:"Personal Care",   unit:"bottle", emoji:"🧴"},
  {keywords:["sunscreen","sunblock","spf","sun protection","coppertone"],                                      name:"Sunscreen",          category:"Personal Care",   unit:"bottle", emoji:"☀️"},
  {keywords:["cotton buds","q-tips","cotton swabs","ear buds","cotton tips"],                                  name:"Cotton Buds",        category:"Personal Care",   unit:"box",    emoji:"🌿"},
  {keywords:["sanitary pad","napkin","always","kotex","whisper","feminine"],                                   name:"Sanitary Pads",      category:"Personal Care",   unit:"pack",   emoji:"🩹"},
  {keywords:["razor","shaver","gillette","shaving","venus"],                                                   name:"Razor",              category:"Personal Care",   unit:"piece",  emoji:"🪒"},
  {keywords:["cotton balls","cosmetic cotton"],                                                                name:"Cotton Balls",       category:"Personal Care",   unit:"pack",   emoji:"🌸"},
  // Cleaning
  {keywords:["laundry","detergent","ariel","tide","surf","gain","persil","powder","washing powder","liquid detergent"],name:"Laundry Detergent",category:"Cleaning",unit:"box",emoji:"🧺"},
  {keywords:["fabric softener","downy","comfort","soflan","snuggle","fabric conditioner"],                     name:"Fabric Softener",    category:"Cleaning",        unit:"bottle", emoji:"🧺"},
  {keywords:["dish soap","dishwashing","joy","dawn","ajax dish","sunlight","fairy"],                           name:"Dish Soap",          category:"Cleaning",        unit:"bottle", emoji:"🍽️"},
  {keywords:["floor cleaner","mop","domex","lysol floor","mr clean floor","zucker"],                           name:"Floor Cleaner",      category:"Cleaning",        unit:"bottle", emoji:"🪣"},
  {keywords:["bleach","clorox","zonrox","chlorox","domestos"],                                                 name:"Bleach",             category:"Cleaning",        unit:"bottle", emoji:"🧹"},
  {keywords:["toilet bowl","toilet cleaner","harpic","lysol toilet","duck"],                                   name:"Toilet Cleaner",     category:"Cleaning",        unit:"bottle", emoji:"🚽"},
  {keywords:["glass cleaner","windex","mirror cleaner"],                                                       name:"Glass Cleaner",      category:"Cleaning",        unit:"bottle", emoji:"🪟"},
  {keywords:["all purpose","multipurpose","lysol spray","dettol spray","mr clean","pine-sol"],                 name:"All-Purpose Cleaner",category:"Cleaning",        unit:"bottle", emoji:"🧹"},
  {keywords:["trash bag","garbage bag","bin liner","rubbish bag"],                                             name:"Trash Bags",         category:"Cleaning",        unit:"pack",   emoji:"🗑️"},
  {keywords:["sponge","scrubber","scotch brite","steel wool"],                                                 name:"Sponge/Scrubber",    category:"Cleaning",        unit:"piece",  emoji:"🧽"},
  {keywords:["disinfectant","dettol","lysol disinfect","sanitize surface"],                                    name:"Disinfectant",       category:"Cleaning",        unit:"bottle", emoji:"🧹"},
  // Food & Beverage
  {keywords:["rice","jasmine rice","white rice","brown rice","basmati"],                                       name:"Rice",               category:"Food & Beverage", unit:"bag",    emoji:"🍚"},
  {keywords:["cooking oil","vegetable oil","olive oil","canola","sunflower oil","palm oil"],                   name:"Cooking Oil",        category:"Food & Beverage", unit:"bottle", emoji:"🫙"},
  {keywords:["salt","table salt","iodized","sea salt","rock salt"],                                            name:"Salt",               category:"Food & Beverage", unit:"box",    emoji:"🧂"},
  {keywords:["sugar","white sugar","brown sugar","cane sugar"],                                                name:"Sugar",              category:"Food & Beverage", unit:"bag",    emoji:"🍬"},
  {keywords:["coffee","nescafe","starbucks","espresso","instant coffee","barako","kopiko"],                    name:"Coffee",             category:"Food & Beverage", unit:"pack",   emoji:"☕"},
  {keywords:["milk","fresh milk","uht","bear brand","alaska milk","magnolia milk"],                            name:"Milk",               category:"Food & Beverage", unit:"bottle", emoji:"🥛"},
  {keywords:["canned","sardines","tuna","corned beef","spam","ligo","century"],                                name:"Canned Goods",       category:"Food & Beverage", unit:"can",    emoji:"🥫"},
  {keywords:["beef jerky","jerky","jack link","teriyaki jerky","dried beef","meat snack"],                     name:"Beef Jerky",         category:"Food & Beverage", unit:"bag",    emoji:"🥩"},
  {keywords:["chips","crisps","pringles","doritos","lays","snacks","crackers","cheetos"],                      name:"Chips/Snacks",       category:"Food & Beverage", unit:"bag",    emoji:"🍟"},
  {keywords:["noodles","ramen","instant noodles","lucky me","nissin","indomie","maggi"],                       name:"Instant Noodles",    category:"Food & Beverage", unit:"pack",   emoji:"🍜"},
  {keywords:["soy sauce","vinegar","fish sauce","condiment","ketchup","patis"],                                name:"Condiment",          category:"Food & Beverage", unit:"bottle", emoji:"🫙"},
  {keywords:["bread","loaf","sandwich bread","pandesal","gardenia","rebisco"],                                 name:"Bread",              category:"Food & Beverage", unit:"pack",   emoji:"🍞"},
  {keywords:["eggs","egg","dozen"],                                                                            name:"Eggs",               category:"Food & Beverage", unit:"pack",   emoji:"🥚"},
  {keywords:["water","mineral water","distilled","drinking water","absolute"],                                 name:"Bottled Water",      category:"Food & Beverage", unit:"bottle", emoji:"💧"},
  // Medicine
  {keywords:["paracetamol","tylenol","panadol","biogesic","acetaminophen","tempra"],                          name:"Paracetamol",        category:"Medicine",        unit:"box",    emoji:"💊"},
  {keywords:["ibuprofen","advil","nurofen","mefenamic","ponstan","dolfenal"],                                  name:"Ibuprofen",          category:"Medicine",        unit:"box",    emoji:"💊"},
  {keywords:["vitamins","vitamin c","multivitamin","supplement","ascorbic","berocca","centrum"],               name:"Vitamins",           category:"Medicine",        unit:"bottle", emoji:"💊"},
  {keywords:["antihistamine","allergy","cetirizine","loratadine","benadryl","zyrtec","claritin"],              name:"Antihistamine",      category:"Medicine",        unit:"box",    emoji:"💊"},
  {keywords:["antacid","tums","maalox","gaviscon","kremil","stomach","ulcer"],                                 name:"Antacid",            category:"Medicine",        unit:"box",    emoji:"💊"},
  {keywords:["cough","robitussin","dextromethorphan","piriton","benadryl cough","cough syrup"],                name:"Cough Medicine",     category:"Medicine",        unit:"bottle", emoji:"🍶"},
  {keywords:["plaster","band-aid","bandage","wound","bandaid","elastoplast"],                                  name:"Plasters/Band-Aid",  category:"Medicine",        unit:"box",    emoji:"🩹"},
  {keywords:["alcohol","sanitizer","hand sanitizer","isopropyl","rubbing alcohol","ethyl"],                   name:"Alcohol/Sanitizer",  category:"Medicine",        unit:"bottle", emoji:"🧴"},
  {keywords:["thermometer","temperature"],                                                                     name:"Thermometer",        category:"Medicine",        unit:"piece",  emoji:"🌡️"},
  {keywords:["diapers","diaper","pampers","huggies","nappy"],                                                  name:"Diapers",            category:"Personal Care",   unit:"pack",   emoji:"👶"},
];

// Smart local detector — scans ALL text in image via canvas pixel color + filename
function localDetect(filename, canvas) {
  const text = (filename || "").toLowerCase().replace(/[_\-\.]/g, " ");
  let best = null, bestScore = 0;
  for (const p of PRODUCT_DB) {
    for (const kw of p.keywords) {
      if (text.includes(kw)) {
        if (kw.length > bestScore) { bestScore = kw.length; best = p; }
      }
    }
  }
  if (best) return { name: best.name, brand: "", category: best.category, unit: best.unit, emoji: best.emoji, notes: "" };
  return null;
}

// Dominant color analysis to help guess product category
function analyzeColors(canvas) {
  const ctx = canvas.getContext("2d");
  const d = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
  let r=0,g=0,b=0,count=0;
  for (let i=0; i<d.length; i+=16) { r+=d[i]; g+=d[i+1]; b+=d[i+2]; count++; }
  r/=count; g/=count; b/=count;
  // White/light = personal care or oral care; Green = cleaning or food; Orange/red = food; Blue = medicine
  if (r>200&&g>200&&b>200) return "Personal Care";
  if (g>r&&g>b) return "Cleaning";
  if (r>150&&g<100&&b<100) return "Food & Beverage";
  if (b>r&&b>g) return "Medicine";
  return null;
}
const QUICK_LIST = [
  {name:"Toothpaste",       category:"Oral Care",       unit:"tube",   emoji:"🦷"},
  {name:"Toilet Paper",     category:"Toilet Paper",    unit:"roll",   emoji:"🧻"},
  {name:"Shampoo",          category:"Personal Care",   unit:"bottle", emoji:"🧴"},
  {name:"Hand Soap",        category:"Personal Care",   unit:"bottle", emoji:"🧼"},
  {name:"Body Wash",        category:"Personal Care",   unit:"bottle", emoji:"🚿"},
  {name:"Dish Soap",        category:"Cleaning",        unit:"bottle", emoji:"🍽️"},
  {name:"Laundry Detergent",category:"Cleaning",        unit:"box",    emoji:"🧺"},
  {name:"Paracetamol",      category:"Medicine",        unit:"box",    emoji:"💊"},
  {name:"Vitamins",         category:"Medicine",        unit:"bottle", emoji:"💊"},
  {name:"Tissue Paper",     category:"Toilet Paper",    unit:"pack",   emoji:"🧻"},
  {name:"Deodorant",        category:"Personal Care",   unit:"piece",  emoji:"✨"},
  {name:"Facial Wash",      category:"Personal Care",   unit:"bottle", emoji:"🫧"},
  {name:"Cooking Oil",      category:"Food & Beverage", unit:"bottle", emoji:"🫙"},
  {name:"Rice",             category:"Food & Beverage", unit:"bag",    emoji:"🍚"},
  {name:"Coffee",           category:"Food & Beverage", unit:"pack",   emoji:"☕"},
  {name:"Bleach",           category:"Cleaning",        unit:"bottle", emoji:"🧹"},
  {name:"Floor Cleaner",    category:"Cleaning",        unit:"bottle", emoji:"🪣"},
  {name:"Alcohol/Sanitizer",category:"Medicine",        unit:"bottle", emoji:"🧴"},
  {name:"Toothbrush",       category:"Oral Care",       unit:"piece",  emoji:"🪥"},
  {name:"Conditioner",      category:"Personal Care",   unit:"bottle", emoji:"🧴"},
];

// ─── Image compression ────────────────────────────────────────────────────────
async function compressImage(dataUrl, maxPx = 800, quality = 0.85) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxPx / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve({ dataUrl: c.toDataURL("image/jpeg", quality), canvas: c });
    };
    img.onerror = () => resolve({ dataUrl, canvas: null });
    img.src = dataUrl;
  });
}

// ─── AI scan — calls /api/scan serverless function ────────────────────────────
async function aiScan(dataUrl) {
  const { dataUrl: compressed } = await compressImage(dataUrl);
  const b64 = compressed.split(",")[1];
  const response = await apiFetch("/api/scan", { method: "POST", body: JSON.stringify({ image: b64 }) });
  if (!response.ok) return null;
  const obj = await response.json();
  if (obj.error || !obj.name) return null;
  return obj;
}

// ─── Full scan pipeline: AI → smart local → manual ────────────────────────────
async function scanPipeline(dataUrl, filename) {
  // 1. Try AI
  try {
    const aiResult = await aiScan(dataUrl);
    if (aiResult) return { result: aiResult, source: "ai" };
  } catch { /* AI unavailable, fall through */ }

  // 2. Smart local detection from filename
  const { canvas } = await compressImage(dataUrl, 200);
  const localResult = localDetect(filename, canvas);
  if (localResult) return { result: localResult, source: "local" };

  // 3. Color hint — at least guess the category
  const colorCat = canvas ? analyzeColors(canvas) : null;
  return { result: colorCat ? { name: "", brand: "", category: colorCat, unit: "piece", emoji: C_ICO[colorCat]||"📦", notes: "" } : null, source: "none" };
}

async function aiChat(messages, inventory) {
  const res = await apiFetch("/api/chat", { method: "POST", body: JSON.stringify({ messages, inventory }) });
  if (!res.ok) throw new Error("chat " + res.status);          // → caller falls back to the offline answer
  const data = await res.json();
  if (!data.reply && !(data.actions || []).length) throw new Error("empty reply");
  return { reply: data.reply || "", actions: data.actions || [] };
}


// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // All state at top level — no hooks inside JSX
  const [items,    setItems]    = useState([]);
  const [shopList, setShopList] = useState([]);
  const [tomb,     setTomb]     = useState([]);          // deleted-item markers for multi-device merge
  const [shopU,    setShopU]    = useState(0);           // shopping list last-modified
  const [loaded,   setLoaded]   = useState(false);
  const [tab,      setTab]      = useState("home");
  const [syncStatus,   setSyncStatus]   = useState("loading");
  const [syncDetail,   setSyncDetail]   = useState("");
  const [locked,       setLocked]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Chat
  const [msgs,      setMsgs]      = useState([{ role:"assistant", id:0, text:"Hi, I'm your inventory assistant. Tell me what you used or bought and I'll update your stock.\n\nTry: **remove 2 water**, **add 3 rolls of toilet paper**, or **what's running low?**" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy,  setChatBusy]  = useState(false);
  const chatEnd = useRef(null);

  // Scan
  const [scanStep, setScanStep] = useState("idle"); // idle | scanning | confirm | manual | done
  const [scanImg,  setScanImg]  = useState(null);
  const [scanData, setScanData] = useState(null);
  const [scanSource, setScanSource] = useState(""); // "ai" | "local" | "none"
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const [showQuick, setShowQuick] = useState(false);

  // Items tab
  const [search,   setSearch]   = useState("");
  const [catF,     setCatF]     = useState("All");
  const [sortBy,   setSortBy]   = useState("Name A-Z");
  const [showSort, setShowSort] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem,  setDelItem]  = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const toast = useCallback((msg, type="ok") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const importRef = useRef(null);

  // Persist: local cache + versioned cloud sync (see sync.js)
  const syncRef     = useRef(null);
  const skipSave    = useRef(true);     // don't echo data that just arrived from the server back to it
  const itemsRef    = useRef(items);    itemsRef.current = items;
  const shopRef     = useRef(shopList); shopRef.current = shopList;
  const tombRef     = useRef(tomb);     tombRef.current = tomb;

  const applyRemote = useCallback((d) => {
    skipSave.current = true;
    setItems(d.items||[]); setShopList(d.shop||[]); setTomb(d.tomb||[]); setShopU(d.shopU||0);
  }, []);

  useEffect(() => {
    const sync = createSync({ onRemote: applyRemote, onStatus: (s, d) => { setSyncStatus(s); setSyncDetail(d || ""); } });
    syncRef.current = sync;
    const onLocked = () => setLocked(true);
    window.addEventListener(LOCKED_EVENT, onLocked);
    sync.init().finally(() => setLoaded(true));
    return () => { window.removeEventListener(LOCKED_EVENT, onLocked); sync.destroy(); };
  }, [applyRemote]);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    syncRef.current?.save({ items, shop:shopList, tomb, shopU });
  }, [items, shopList, tomb, shopU, loaded]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const unlock = (code) => { setAccessCode(code); setLocked(false); syncRef.current?.init(); };

  const alertLow = useCallback((arr) => {
    arr.forEach(i => {
      if (i.qty === 0)                   toast(`${i.name} is out of stock`, "danger");
      else if (i.qty <= (i.minQty||1))   toast(`Only ${i.qty} ${i.name} left`, "warn");
    });
  }, [toast]);

  // All item mutations go through here so every change is time-stamped (`u`) for merging.
  const stamp = x => ({ ...x, u: Date.now() });

  const updateItem = useCallback((id, patch) => {
    const prev = itemsRef.current;
    const next = prev.map(x => x.id === id ? stamp({ ...x, ...(typeof patch === "function" ? patch(x) : patch) }) : x);
    itemsRef.current = next; setItems(next);
    return next.find(x => x.id === id);
  }, []);

  const removeItem = useCallback((id) => {
    setItems(itemsRef.current = itemsRef.current.filter(x => x.id !== id));
    setTomb(tombRef.current = [...tombRef.current.filter(t => t.id !== id), { id, u: Date.now() }]);
  }, []);

  const updateShop = useCallback((list) => { setShopList(list); setShopU(Date.now()); }, []);

  const addItem = useCallback((p) => {
    const prev = itemsRef.current;
    const idx = prev.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase());
    let next, touched;
    if (idx >= 0) {
      touched = stamp({ ...prev[idx], qty: prev[idx].qty + (p.qty||1) });
      next = prev.map((x,i) => i===idx ? touched : x);
      toast(`Added ${p.qty||1} ${p.name} (now ${touched.qty})`, "ok");
    } else {
      touched = stamp({ ...p, id: nid(), added: new Date().toLocaleDateString() });
      next = [...prev, touched];
      toast(`${p.name} added`, "ok");
    }
    itemsRef.current = next; setItems(next);
    alertLow([touched]);
  }, [toast, alertLow]);

  // Scan
  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const filename = file.name;
    e.target.value = "";
    setScanImg(null); setScanData(null); setScanSource("");
    setScanStep("scanning");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target.result;
      setScanImg(url);
      try {
        const { result, source } = await scanPipeline(url, filename);
        setScanSource(source);
        if (result && result.name) {
          setScanData(result);
          setScanStep("confirm");
        } else if (result && result.category) {
          // Color hint only — go to manual with category pre-filled
          setScanData(result);
          setScanStep("manual");
        } else {
          setScanStep("manual");
        }
      } catch {
        setScanStep("manual");
      }
    };
    reader.readAsDataURL(file);
  };

  const finishScan = (p) => { addItem(p); setScanStep("done"); setTimeout(()=>{ setScanStep("idle"); setScanImg(null); setScanData(null); setScanSource(""); }, 1800); };
  const resetScan  = () => { setScanStep("idle"); setScanImg(null); setScanData(null); setScanSource(""); };

  // Chat
  const offlineReply = useCallback((text) => {
    const q = text.toLowerCase();
    const low = items.filter(i => i.qty <= (i.minQty||1));
    if (q.match(/low|running out|restock/))
      return low.length ? `**Running low:**\n${low.map(i=>`• ${i.name}: ${i.qty===0?"out of stock":`${i.qty} left`}`).join("\n")}` : "Everything is well stocked.";
    if (q.match(/inventory|show|list|what.*have|all items|what do/))
      return items.length ? `**Inventory (${items.length}):**\n${items.map(i=>`• ${i.name}: ${i.qty} ${i.unit}`).join("\n")}` : "Your inventory is empty. Add products from the Scan tab.";
    if (q.match(/shop|buy|shopping/))
      return shopList.length ? `**Shopping list:**\n${shopList.map(i=>`• ${i.name} ×${i.qty}`).join("\n")}` : "Your shopping list is empty.";
    if (q.match(/expir/)) {
      const wk = localISO(7);
      const e = items.filter(i=>i.expiry&&i.expiry<=wk);
      return e.length ? `**Expiring soon:**\n${e.map(i=>`• ${i.name}, ${i.expiry}`).join("\n")}` : "Nothing is expiring soon.";
    }
    if (q.match(/\b(hi|hello|hey)\b/)) return low.length ? `Hi. **${low.length} items** are running low. What would you like to do?` : "Hi. Your inventory looks good. How can I help?";
    return items.length ? `You're tracking **${items.length} products**. ${low.length ? `${low.length} need restocking.` : "All are well stocked."}\n\nAsk "what's low?" or "show inventory".` : "Your inventory is empty. Use Scan to add products.";
  }, [items, shopList]);

  // Apply changes the chat assistant asked for. Returns one human-readable line per action.
  const findItem = (name) => {
    const q = name.trim().toLowerCase(), list = itemsRef.current;
    const exact = list.find(i => i.name.toLowerCase() === q);
    if (exact) return exact;
    const near = list.filter(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase()));
    return near.length === 1 ? near[0] : null;     // ambiguous → don't guess
  };
  const applyActions = (actions) => {
    const lines = [];
    for (const a of actions || []) {
      if (a.type === "adjust_quantity") {
        const it = findItem(a.name);
        if (!it) { lines.push(`I couldn't find "${a.name}" in your inventory, so nothing changed.`); continue; }
        const next = Math.max(0, it.qty + a.delta);
        const saved = updateItem(it.id, { qty: next });
        lines.push(`**${it.name}**: ${it.qty} → ${next}`);
        if (saved) alertLow([saved]);
      } else if (a.type === "add_item") {
        addItem({ name:a.name, qty:a.quantity, category:a.category, unit:a.unit, emoji:C_ICO[a.category] || "📦", minQty:1, expiry:"", notes:"", brand:"" });
        lines.push(`Added ${a.quantity} × **${a.name}**`);
      } else if (a.type === "add_to_shopping_list") {
        const list = shopRef.current, idx = list.findIndex(l => l.name.toLowerCase() === a.name.toLowerCase());
        const nextList = idx >= 0 ? list.map((l, i) => i === idx ? { ...l, qty: l.qty + a.quantity } : l) : [...list, { name:a.name, qty:a.quantity }];
        shopRef.current = nextList; updateShop(nextList);
        lines.push(`**${a.name}** ×${a.quantity} added to your shopping list`);
      }
    }
    return lines;
  };

  const sendChat = async (txt) => {
    const text = (txt ?? chatInput).trim(); if (!text || chatBusy) return;
    setChatInput("");
    const um = { role:"user", text, id:Date.now() };
    setMsgs(p => [...p, um]);
    setChatBusy(true);
    try {
      const { reply, actions } = await aiChat([...msgs, um], items);
      const done = applyActions(actions);
      const out = [reply, done.join("\n")].filter(Boolean).join("\n\n");
      setMsgs(p => [...p, { role:"assistant", text:out, id:Date.now() }]);
    } catch {
      // Never let a failed AI call look like a successful edit.
      const wantsChange = /\b(remove|add|use[ds]?|bought|buy|took|finished|consumed|minus|deduct|restock|got)\b/i.test(text);
      const msg = wantsChange
        ? "I couldn't reach the assistant, so **nothing was changed**. Use the − and + buttons in Items, or try again in a moment."
        : offlineReply(text);
      setMsgs(p => [...p, { role:"assistant", text:msg, id:Date.now() }]);
    } finally { setChatBusy(false); }
  };

  // Items display
  const displayed = useMemo(() => {
    let xs = [...items];
    if (search.trim()) { const q=search.toLowerCase(); xs=xs.filter(i=>i.name.toLowerCase().includes(q)||(i.brand||"").toLowerCase().includes(q)); }
    if (catF!=="All") xs=xs.filter(i=>i.category===catF);
    if (sortBy==="Name A-Z")       xs.sort((a,b)=>a.name.localeCompare(b.name));
    if (sortBy==="Name Z-A")       xs.sort((a,b)=>b.name.localeCompare(a.name));
    if (sortBy==="Qty: Low→High")  xs.sort((a,b)=>a.qty-b.qty);
    if (sortBy==="Qty: High→Low")  xs.sort((a,b)=>b.qty-a.qty);
    if (sortBy==="Recently Added") xs.sort((a,b)=>b.id-a.id);
    if (sortBy==="Category")       xs.sort((a,b)=>(a.category||"").localeCompare(b.category||""));
    return xs;
  }, [items, search, catF, sortBy]);

  const activeCats = ["All", ...CATS.filter(c=>items.some(i=>i.category===c))];
  const lowCount   = items.filter(i=>i.qty<=(i.minQty||1)).length;
  const week       = localISO(7);
  // Escape first (item names and AI text are untrusted), then allow only **bold**.
  const md = t => String(t ?? "").split("\n").map((l,i,a)=><span key={i} dangerouslySetInnerHTML={{ __html: esc(l).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")+(i<a.length-1?"<br/>":"") }}/>);

  const doExport = async () => {
    const text = JSON.stringify({ items, shop:shopList }, null, 2);
    const name = `consumables-${localISO()}.json`;
    try {   // phones: native share sheet (Save to Files, AirDrop, Drive…)
      const file = new File([text], name, { type:"application/json" });
      if (navigator.canShare?.({ files:[file] })) { await navigator.share({ files:[file], title:"Consumables backup" }); return toast("Backup exported","ok"); }
    } catch (e) { if (e?.name === "AbortError") return; }
    const url = URL.createObjectURL(new Blob([text], { type:"application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup exported","ok");
  };
  const doImport = e => {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result);
        if (!Array.isArray(d.items)) return toast("That isn't a valid backup file","danger");
        const now=Date.now();
        // Merge by item id: newer edit wins, so importing an older backup can't clobber newer changes.
        const have=new Map(itemsRef.current.map(x=>[x.id,x]));
        const incoming=d.items.filter(x=>x&&typeof x.name==="string"&&x.name.trim()).map(x=>({ ...x, id:x.id??nid(), u:Math.max(x.u||0,now) }));
        incoming.forEach(x=>have.set(x.id,x));
        const next=[...have.values()];
        itemsRef.current=next; setItems(next);
        setTomb(tombRef.current=tombRef.current.filter(t=>!have.has(t.id)));
        if (Array.isArray(d.shop) && d.shop.length) updateShop(d.shop);
        toast(`Imported ${incoming.length} items`,"ok");
      } catch { toast("Couldn't read that file","danger"); }
    };
    r.readAsText(f); e.target.value="";
  };


  // ── Render ─────────────────────────────────────────────────────────────────
  if (locked) return <LockScreen onUnlock={unlock}/>;

  const state = items.reduce((m, i) => { m[stockState(i)]++; return m; }, { ok: 0, low: 0, out: 0 });
  const mood = state.out ? "bad" : state.low ? "warn" : "ok";
  const needs = items.filter(i => stockState(i) !== "ok").sort((a, b) => a.qty - b.qty);
  const expiring = items.filter(i => i.expiry && i.expiry <= week).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const syncColor = { synced:"var(--ok)", saving:"var(--accent)", loading:"var(--accent)", offline:"var(--warn)", error:"var(--bad)", locked:"var(--bad)" }[syncStatus] || "var(--ink-3)";
  const SUGGEST = ["What's running low?", "Remove 1 water", "Add 2 toilet paper", "Show shopping list"];
  const TITLES = {
    home:  ["Overview", items.length ? `${items.length} products tracked` : "Nothing tracked yet"],
    chat:  ["Assistant", ""],
    scan:  ["Add a product", "Photograph it or pick from a list"],
    items: ["Inventory", `${items.length} products`],
    shop:  ["Shopping list", shopList.length ? `${shopList.filter(i => !i.checked).length} to buy` : ""],
  };
  const expLabel = (d) => d < localISO() ? "Expired" : d === localISO() ? "Expires today" : `Expires ${d}`;

  const Row = ({ i, children, onClick }) => (
    <div className="item">
      <button className="item-main" onClick={onClick} aria-label={`${i.name}, ${i.qty} ${i.unit}`}>
        <div className="tile" aria-hidden="true">{i.emoji}</div>
        <div style={{ minWidth: 0 }}>
          <div className="item-name">{i.name}</div>
          <div className="item-meta">{i.brand ? `${i.brand} · ` : ""}{i.category}</div>
          <StatusLine i={i}/>
        </div>
      </button>
      {children}
    </div>
  );
  const StatusLine = ({ i }) => {
    const s = stockState(i);
    if (i.expiry && i.expiry <= week) return <div className="status soon"><Icon name="clock" size={15}/>{expLabel(i.expiry)}</div>;
    if (s === "out") return <div className="status out"><Icon name="alert" size={15}/>Out of stock</div>;
    if (s === "low") return <div className="status low"><Icon name="alert" size={15}/>Running low</div>;
    return null;
  };

  const tabs = [
    ["home","home","Home", 0], ["chat","chat","Chat", 0], ["scan","scan","Scan", 0],
    ["items","box","Items", state.out + state.low ? 0 : 0], ["shop","cart","Shop", shopList.filter(i => !i.checked).length],
  ];

  return (
    <div className="app" data-mood={mood}>
      <Toast list={toasts}/>

      {showSettings && (
        <SettingsModal syncStatus={syncStatus} syncDetail={syncDetail} toast={toast} onClose={()=>setShowSettings(false)}
          onExport={doExport} onImport={()=>importRef.current?.click()} onRestore={()=>window.location.reload()} />
      )}
      <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={doImport}/>

      {delItem && (
        <Sheet onClose={()=>setDelItem(null)} title={`Remove ${delItem.name}?`}>
          <p className="muted" style={{ marginBottom: 18 }}>This takes it off your inventory on all your devices.</p>
          <div className="row">
            <button className="btn btn-danger" style={{ flex:1 }} onClick={()=>{ removeItem(delItem.id); setDelItem(null); setEditItem(null); toast("Item removed","info"); }}>Remove</button>
            <button className="btn btn-glass" style={{ flex:1 }} onClick={()=>setDelItem(null)}>Keep it</button>
          </div>
        </Sheet>
      )}

      {editItem && !delItem && (
        <Sheet onClose={()=>setEditItem(null)} title="Edit item">
          <EditForm item={editItem}
            onSave={u=>{ const saved=updateItem(u.id, u); setEditItem(null); toast("Changes saved","ok"); if(saved) alertLow([saved]); }}
            onCancel={()=>setEditItem(null)} onDelete={()=>setDelItem(editItem)} />
        </Sheet>
      )}

      {showQuick && (
        <Sheet onClose={()=>setShowQuick(false)} title="Quick add">
          <p className="muted" style={{ marginBottom: 14 }}>Tap a product to add one.</p>
          <div className="quick" style={{ maxHeight: "52vh", overflowY: "auto" }}>
            {QUICK_LIST.map(p => (
              <button key={p.name} className="glass" onClick={()=>{ addItem({...p,qty:1,minQty:1,expiry:"",notes:"",brand:""}); setShowQuick(false); }}>
                <span aria-hidden="true">{p.emoji}</span>{p.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {showSort && (
        <Sheet onClose={()=>setShowSort(false)} title="Sort by">
          {["Name A-Z","Name Z-A","Qty: Low→High","Qty: High→Low","Recently Added","Category"].map(o => (
            <button key={o} className="opt" role="radio" aria-checked={sortBy===o} onClick={()=>{ setSortBy(o); setShowSort(false); }}>
              {o.replace("→"," to ")}{sortBy===o && <Icon name="check" size={20}/>}
            </button>
          ))}
        </Sheet>
      )}

      <header className={`top ${tab==="chat" ? "compact" : ""}`}>
        <div>
          <h1>{TITLES[tab][0]}</h1>
          {TITLES[tab][1] && <p>{TITLES[tab][1]}</p>}
        </div>
        <button className="icon-btn glass" aria-label="Settings and sync" onClick={()=>setShowSettings(true)}>
          <Icon name="sliders" size={22}/>
          <span className="sync-dot" style={{ background: syncColor }}/>
        </button>
      </header>

      <main className={`main ${tab==="chat" ? "flush" : ""}`}>

        {/* ── HOME ── */}
        {tab==="home" && (<>
          <section className="glass health" aria-label="Stock health">
            {items.length === 0 ? (<>
              <h2>Start your inventory</h2>
              <p>Scan a product, or ask the assistant to add one.</p>
              <button className="btn btn-primary block" style={{ marginTop: 16 }} onClick={()=>setTab("scan")}><Icon name="scan" size={20}/>Add first product</button>
            </>) : (<>
              <h2>{state.out ? `${state.out} out of stock` : state.low ? `${state.low} running low` : "Everything is stocked"}</h2>
              <p>{state.out || state.low ? "These need restocking soon." : `All ${items.length} products are above their warning level.`}</p>
              <div className="meter" role="img" aria-label={`${state.ok} stocked, ${state.low} low, ${state.out} out`}>
                {state.ok > 0 && <span style={{ flex: state.ok, background: "var(--ok)" }}/>}
                {state.low > 0 && <span style={{ flex: state.low, background: "var(--warn)" }}/>}
                {state.out > 0 && <span style={{ flex: state.out, background: "var(--bad)" }}/>}
              </div>
              <div className="legend">
                <span><i style={{ background:"var(--ok)" }}/><b>{state.ok}</b>stocked</span>
                <span><i style={{ background:"var(--warn)" }}/><b>{state.low}</b>low</span>
                <span><i style={{ background:"var(--bad)" }}/><b>{state.out}</b>out</span>
              </div>
            </>)}
          </section>

          {needs.length > 0 && (<>
            <h2 className="h2">Restock soon</h2>
            <div className="glass group">
              {needs.slice(0, 6).map(i => {
                const listed = shopList.some(l => l.name.toLowerCase() === i.name.toLowerCase());
                return (
                  <Row key={i.id} i={i} onClick={()=>setEditItem(i)}>
                    <button className="btn btn-glass btn-sm" disabled={listed} aria-label={listed ? `${i.name} is on your list` : `Add ${i.name} to shopping list`}
                      onClick={()=>{ updateShop([...shopList, { name:i.name, qty:Math.max(1, i.minQty||2) }]); toast(`${i.name} added to your list`,"ok"); }}>
                      <Icon name={listed ? "check" : "cartplus"} size={19}/>{listed ? "Listed" : "Buy"}
                    </button>
                  </Row>
                );
              })}
            </div>
            {needs.length > 6 && <button className="btn btn-text" style={{ marginTop: 4 }} onClick={()=>{ setSortBy("Qty: Low→High"); setTab("items"); }}>See all {needs.length}</button>}
          </>)}

          {expiring.length > 0 && (<>
            <h2 className="h2">Expiring within a week</h2>
            <div className="glass group">
              {expiring.slice(0, 5).map(i => <Row key={i.id} i={i} onClick={()=>setEditItem(i)}/>)}
            </div>
          </>)}

          {items.length > 0 && (<>
            <h2 className="h2">By category</h2>
            <div className="glass group">
              {CATS.filter(c => items.some(i => i.category === c)).map(c => {
                const xs = items.filter(i => i.category === c);
                const n = xs.length, okN = xs.filter(i => stockState(i) === "ok").length;
                return (
                  <button key={c} className="item" style={{ width:"100%", textAlign:"left" }} onClick={()=>{ setCatF(c); setTab("items"); }}>
                    <div className="tile" aria-hidden="true">{C_ICO[c]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="item-name">{c}</div>
                      <div className="item-meta">{n} {n===1?"product":"products"}{okN < n ? `, ${n-okN} need attention` : ""}</div>
                      <div className="bar"><div style={{ width:`${Math.round(okN/n*100)}%`, background:C_CLR[c] }}/></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>)}
        </>)}

        {/* ── ITEMS ── */}
        {tab==="items" && (<>
          <div className="row" style={{ marginBottom: 12 }}>
            <label className="search">
              <Icon name="search" size={20}/>
              <input className="input" aria-label="Search products" placeholder="Search products" value={search} onChange={e=>setSearch(e.target.value)} />
            </label>
            <button className="icon-btn glass" aria-label="Sort" onClick={()=>setShowSort(true)}><Icon name="sort" size={22}/></button>
            <button className="icon-btn glass" aria-label="Add a product" onClick={()=>setTab("scan")}><Icon name="plus" size={24}/></button>
          </div>
          <div className="chips" role="group" aria-label="Filter by category">
            {activeCats.map(c => (
              <button key={c} className="chip glass" aria-pressed={catF===c} onClick={()=>setCatF(c)}>
                {c!=="All" && <i style={{ background:C_CLR[c] }}/>}{c}
              </button>
            ))}
          </div>
          {displayed.length === 0 ? (
            <div className="empty">
              <Icon name="box" size={42}/>
              <h3>{items.length ? "No matches" : "No products yet"}</h3>
              <p>{items.length ? "Try a different search or category." : "Scan a product or use Quick add to get started."}</p>
            </div>
          ) : (
            <div className="glass group" style={{ marginTop: 12 }}>
              {displayed.map(i => (
                <Row key={i.id} i={i} onClick={()=>setEditItem(i)}>
                  <Stepper value={i.qty} unit={i.unit} label={`${i.name} quantity`}
                    onChange={q=>{ const saved=updateItem(i.id,{qty:q}); if(saved && q<i.qty) alertLow([saved]); }} />
                </Row>
              ))}
            </div>
          )}
        </>)}

        {/* ── SCAN ── */}
        {tab==="scan" && (<>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleFile}/>
          <input ref={galleryRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>

          {scanStep==="idle" && (<>
            <section className="glass hero">
              <div className="ring"><Icon name="scan" size={38}/></div>
              <h2>Scan a product</h2>
              <p>Take a photo and the assistant fills in the name, category and unit for you.</p>
              <button className="btn btn-primary block" onClick={()=>fileRef.current?.click()}><Icon name="scan" size={22}/>Take photo</button>
              <div className="row" style={{ width:"100%" }}>
                <button className="btn btn-glass" style={{ flex:1 }} onClick={()=>galleryRef.current?.click()}><Icon name="image" size={20}/>Gallery</button>
                <button className="btn btn-glass" style={{ flex:1 }} onClick={()=>setShowQuick(true)}><Icon name="bolt" size={20}/>Quick add</button>
              </div>
              <button className="btn btn-text" onClick={()=>{ setScanData(null); setScanSource("none"); setScanStep("manual"); }}>Enter details by hand</button>
            </section>
          </>)}

          {scanStep==="scanning" && (
            <section className="glass hero" aria-live="polite">
              {scanImg && <img className="preview" src={scanImg} alt="Your photo"/>}
              <div className="spinner"/>
              <h2>Reading your photo</h2>
              <p>This usually takes a few seconds.</p>
              <button className="btn btn-text" onClick={resetScan}>Cancel</button>
            </section>
          )}

          {scanStep==="confirm" && scanData && (
            <ItemForm title="Confirm product" image={scanImg} prefill={scanData} isAI={scanSource==="ai"} onSave={finishScan} onCancel={resetScan}/>
          )}

          {scanStep==="manual" && (<>
            {scanSource==="none" && scanImg && <div className="notice hint">We couldn't identify this photo. Enter the details below.</div>}
            <ItemForm title="Add product" image={scanImg} prefill={scanData} onSave={finishScan} onCancel={resetScan}/>
          </>)}

          {scanStep==="done" && (
            <section className="glass hero" aria-live="polite">
              <div className="ring" style={{ color:"var(--ok)", borderColor:"rgba(91,227,168,.4)", background:"rgba(91,227,168,.12)" }}><Icon name="check" size={40} stroke={2.4}/></div>
              <h2>Added to inventory</h2>
            </section>
          )}
        </>)}

        {/* ── SHOP ── */}
        {tab==="shop" && <ShopTab items={items} shopList={shopList} setShopList={updateShop}/>}

        {/* ── CHAT ── */}
        {tab==="chat" && (
          <div className="chat">
            <div className="chat-scroll" aria-live="polite">
              {msgs.map(m => (
                <div key={m.id} className={`bubble ${m.role==="user" ? "u" : "a glass"}`}>{md(m.text)}</div>
              ))}
              {chatBusy && <div className="bubble a glass" aria-label="Assistant is typing"><span className="typing"><span/><span/><span/></span></div>}
              <div ref={chatEnd}/>
            </div>
            <div className="composer-wrap">
              <div className="chips" role="group" aria-label="Suggested messages">
                {SUGGEST.map(q => <button key={q} className="chip glass" disabled={chatBusy} onClick={()=>sendChat(q)}>{q}</button>)}
              </div>
              <form className="composer glass-strong" onSubmit={e=>{ e.preventDefault(); sendChat(); }}>
                <input aria-label="Message the assistant" placeholder="Message the assistant" value={chatInput}
                  onChange={e=>setChatInput(e.target.value)} enterKeyHint="send" autoComplete="off"/>
                <button className="send" type="submit" aria-label="Send" disabled={!chatInput.trim() || chatBusy}><Icon name="send" size={24} stroke={2.4}/></button>
              </form>
            </div>
          </div>
        )}
      </main>

      <nav className="dock glass-strong" aria-label="Main">
        {tabs.map(([id, ico, label, badge]) => (
          <button key={id} aria-current={tab===id ? "page" : undefined} onClick={()=>setTab(id)}>
            <Icon name={ico} size={24}/>{label}
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
