import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createSync, apiFetch, getUserId, setUserId, getAccessCode, setAccessCode, LOCKED_EVENT } from "./sync.js";

// ─── Config ────────────────────────────────────────────────────────────────────
const nid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);   // collision-safe numeric id
const localISO = (daysAhead = 0) => {                                      // YYYY-MM-DD in the phone's local time
  const d = new Date(Date.now() + daysAhead * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const CATS = ["Oral Care","Toilet Paper","Personal Care","Cleaning","Food & Beverage","Medicine","Other"];
const UNITS = ["piece","pack","bottle","tube","roll","bar","box","can","bag","sachet","set","pair"];
const C_ICO = {"Oral Care":"🦷","Toilet Paper":"🧻","Personal Care":"🧴","Cleaning":"🧹","Food & Beverage":"🥫","Medicine":"💊","Other":"📦"};
const C_CLR = {"Oral Care":"#3b82f6","Toilet Paper":"#8b5cf6","Personal Care":"#ec4899","Cleaning":"#10b981","Food & Beverage":"#f59e0b","Medicine":"#ef4444","Other":"#6b7280"};

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

// ─── Reusable UI ───────────────────────────────────────────────────────────────
function Toast({ list }) {
  return (
    <div style={{ position:"fixed", top:8, left:8, right:8, zIndex:9999, display:"flex", flexDirection:"column", gap:6, pointerEvents:"none" }}>
      {list.map(t => (
        <div key={t.id} style={{ padding:"8px 13px", borderRadius:10, fontSize:12, fontWeight:600, backdropFilter:"blur(10px)", boxShadow:"0 4px 18px rgba(0,0,0,.5)", animation:"slideIn .3s ease", border:"1px solid rgba(255,255,255,0.07)",
          background: t.type==="danger"?"rgba(239,68,68,.92)":t.type==="warn"?"rgba(245,158,11,.92)":t.type==="info"?"rgba(59,130,246,.92)":"rgba(16,185,129,.92)",
          color: t.type==="danger"||t.type==="info"?"#fff":t.type==="warn"?"#1a0f00":"#001a0e"
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", zIndex:8888, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#0c1828", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:22, width:"100%", maxWidth:340, maxHeight:"90vh", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom:10 }}><div style={{ fontSize:11, color:"#5a7898", marginBottom:3 }}>{label}</div>{children}</div>;
}

function Stepper({ value, onChange, min = 0 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <button style={st.sb} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span style={{ fontSize:18, fontWeight:700, minWidth:30, textAlign:"center" }}>{value}</span>
      <button style={st.sb} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// ─── ItemForm — used for scan confirm + manual add + edit ──────────────────────
function ItemForm({ image, prefill, isAI, title, onSave, onCancel }) {
  const [name,     setName]     = useState(prefill?.name     || "");
  const [brand,    setBrand]    = useState(prefill?.brand    || "");
  const [category, setCategory] = useState(prefill?.category || "Personal Care");
  const [unit,     setUnit]     = useState(prefill?.unit     || "piece");
  const [qty,      setQty]      = useState(prefill?.qty      || 1);
  const [minQty,   setMinQty]   = useState(prefill?.minQty   || 1);
  const [expiry,   setExpiry]   = useState(prefill?.expiry   || "");
  const [notes,    setNotes]    = useState(prefill?.notes    || "");

  const ok = name.trim().length > 0;
  const save = () => onSave({ name:name.trim(), brand, category, unit, qty, minQty, expiry, notes, emoji: C_ICO[category]||"📦" });

  return (
    <div style={{ width:"100%", paddingBottom:8 }}>
      <div style={{ fontSize:15, fontWeight:700, textAlign:"center", marginBottom:12 }}>{title}</div>
      {image && <img src={image} alt="" style={{ width:"100%", maxHeight:150, objectFit:"contain", borderRadius:10, marginBottom:10, background:"rgba(0,0,0,.25)" }} />}
      {isAI && <div style={{ fontSize:12, color:"#6ee7b7", background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)", borderRadius:8, padding:"7px 11px", marginBottom:12, textAlign:"center" }}>🤖 AI detected — review and confirm</div>}
      <Field label="Product Name *">
        <input style={st.inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Colgate Toothpaste" />
      </Field>
      <Field label="Brand">
        <input style={st.inp} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Category">
        <select style={st.inp} value={category} onChange={e=>{ setCategory(e.target.value); }}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display:"flex", gap:10 }}>
        <Field label="Quantity"><Stepper value={qty} onChange={setQty} min={1} /></Field>
        <Field label="Unit">
          <select style={st.inp} value={unit} onChange={e=>setUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Field label="Alert when ≤">
          <input style={st.inp} type="number" min="0" value={minQty} onChange={e=>setMinQty(+e.target.value||1)} />
        </Field>
        <Field label="Expiry Date">
          <input style={st.inp} type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} />
        </Field>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button style={{ ...st.btnGreen, flex:1, opacity:ok?1:0.4 }} disabled={!ok} onClick={save}>
          ✅ Add to Inventory
        </button>
        <button style={{ ...st.btnGhost, flex:"none", padding:"0 16px" }} onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}

// ─── EditForm — separate component so hooks are always called ──────────────────
function EditForm({ item, onSave, onCancel }) {
  const [name,     setName]     = useState(item.name);
  const [brand,    setBrand]    = useState(item.brand    || "");
  const [category, setCategory] = useState(item.category || "Personal Care");
  const [unit,     setUnit]     = useState(item.unit     || "piece");
  const [minQty,   setMinQty]   = useState(item.minQty   || 1);
  const [expiry,   setExpiry]   = useState(item.expiry   || "");
  const save = () => onSave({ ...item, name, brand, category, unit, minQty, expiry, emoji: C_ICO[category]||"📦" });
  return (
    <>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>✏️ Edit — {item.name}</div>
      <Field label="Name"><input style={st.inp} value={name} onChange={e=>setName(e.target.value)} /></Field>
      <Field label="Brand"><input style={st.inp} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Optional" /></Field>
      <Field label="Category">
        <select style={st.inp} value={category} onChange={e=>setCategory(e.target.value)}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display:"flex", gap:10 }}>
        <Field label="Unit"><select style={st.inp} value={unit} onChange={e=>setUnit(e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></Field>
        <Field label="Alert ≤"><input style={st.inp} type="number" min="0" value={minQty} onChange={e=>setMinQty(+e.target.value||1)} /></Field>
      </div>
      <Field label="Expiry"><input style={st.inp} type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} /></Field>
      <div style={{ display:"flex", gap:8, marginTop:14 }}>
        <button style={{ ...st.btnGreen, flex:1 }} onClick={save}>💾 Save</button>
        <button style={{ ...st.btnGhost, flex:1 }} onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ─── ShopTab — separate component so hooks are always called ──────────────────
function ShopTab({ items, shopList, setShopList }) {
  const [sName, setSName] = useState("");
  const [sQty,  setSQty]  = useState(1);

  const suggested = items.filter(i => i.qty <= (i.minQty||1) && !shopList.find(l => l.name.toLowerCase() === i.name.toLowerCase()));

  const addShop = (n, q=1) => {
    if (!n.trim()) return;
    const idx = shopList.findIndex(l => l.name.toLowerCase() === n.toLowerCase());
    setShopList(idx >= 0
      ? shopList.map((l, i) => i===idx ? { ...l, qty: l.qty+q } : l)
      : [...shopList, { name: n.trim(), qty: q }]
    );
    setSName(""); setSQty(1);
  };

  const exportList = async () => {
    const text = "SHOPPING LIST\n" + new Date().toLocaleDateString() + "\n\n" + shopList.map(i=>`${i.checked?"✓":"○"} ${i.name}  ×${i.qty}`).join("\n");
    try {   // phones: share sheet (Messages, Notes, WhatsApp…)
      if (navigator.share) { await navigator.share({ title:"Shopping list", text }); return; }
    } catch (e) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); alert("Shopping list copied to clipboard"); return; } catch {}
    const url = URL.createObjectURL(new Blob([text], { type:"text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "shopping-list.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ padding:14 }}>
      {suggested.length > 0 && (
        <div style={st.card}>
          <div style={st.cardHd}>⚡ Suggested (low stock)</div>
          {suggested.map(i => (
            <div key={i.id} style={st.row}>
              <span>{i.emoji} {i.name} — {i.qty} left</span>
              <button style={st.chipBtn} onClick={() => addShop(i.name, Math.max(1, i.minQty||2))}>+ Add</button>
            </div>
          ))}
        </div>
      )}
      <div style={st.card}>
        <div style={st.cardHd}>➕ Add Item</div>
        <div style={{ display:"flex", gap:7 }}>
          <input style={{ ...st.inp, flex:1 }} placeholder="Item name…" value={sName} onChange={e=>setSName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addShop(sName,sQty)} />
          <Stepper value={sQty} onChange={setSQty} min={1} />
          <button style={{ ...st.btnBlue, padding:"0 14px", flexShrink:0 }} onClick={()=>addShop(sName,sQty)}>+</button>
        </div>
      </div>
      {shopList.length > 0 ? (
        <div style={st.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={st.cardHd}>🛒 List ({shopList.length})</div>
            <div style={{ display:"flex", gap:6 }}>
              {shopList.some(i=>i.checked) && <button style={st.tinyBtn} onClick={()=>setShopList(shopList.filter(i=>!i.checked))}>Clear ✓</button>}
              <button style={st.tinyBtn} onClick={exportList}>Export 📤</button>
            </div>
          </div>
          {shopList.map((item, idx) => (
            <div key={idx} style={{ ...st.row, opacity: item.checked?0.4:1 }}>
              <button style={st.mb} onClick={()=>setShopList(shopList.map((l,i)=>i===idx?{...l,checked:!l.checked}:l))}>
                {item.checked?"✅":"⬜"}
              </button>
              <span style={{ flex:1, textDecoration:item.checked?"line-through":"none", fontSize:13 }}>{item.name}</span>
              <span style={{ color:"#60a5fa", fontSize:12, marginRight:8 }}>×{item.qty}</span>
              <button style={st.mb} onClick={()=>setShopList(shopList.filter((_,i)=>i!==idx))}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"#5a7898" }}>
          <div style={{ fontSize:40 }}>🛒</div>
          <p style={{ marginTop:10, fontSize:13 }}>Shopping list is empty</p>
        </div>
      )}
    </div>
  );
}

// ─── Lock screen (shown when the server has APP_ACCESS_CODE set) ───────────────
function LockScreen({ onUnlock }) {
  const [code, setCode] = useState("");
  return (
    <div style={{ ...st.root, alignItems:"center", justifyContent:"center", padding:24, textAlign:"center" }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <h2 style={{ fontSize:18, fontWeight:700, margin:"12px 0 6px" }}>Consumables</h2>
      <p style={{ fontSize:13, color:MUT, marginBottom:16, maxWidth:260 }}>Enter your access code to continue.</p>
      <input style={{ ...st.inp, maxWidth:260, textAlign:"center" }} type="password" autoComplete="current-password" autoFocus
        value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&code&&onUnlock(code)} placeholder="Access code" />
      <button style={{ ...st.bigBtn, marginTop:12, maxWidth:260, opacity:code?1:.4 }} disabled={!code} onClick={()=>onUnlock(code)}>Unlock</button>
    </div>
  );
}

// ─── Settings: sync key backup/restore, access code, status ───────────────────
const SYNC_LABEL = { loading:"Loading…", synced:"✅ Synced", saving:"⏳ Saving…", offline:"📴 Offline — will sync when back online", error:"⚠️ Can't reach server — retrying", locked:"🔒 Locked" };
function SettingsModal({ syncStatus, syncDetail, onClose, onRestore, onExport, onImport, toast }) {
  const myKey = getUserId();
  const [other, setOther] = useState("");
  const [code, setCode] = useState(getAccessCode());
  const copy = async () => {
    try { await navigator.clipboard.writeText(myKey); toast("📋 Sync key copied", "ok"); }
    catch { toast("Press and hold the key to copy it", "info"); }
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>⚙️ Settings</div>
      <Field label="Sync status">
        <div style={{ fontSize:13 }}>{SYNC_LABEL[syncStatus] || syncStatus}</div>
        {syncDetail && syncStatus !== "synced" && <div style={{ fontSize:12, color:"#fbbf24", marginTop:4, lineHeight:1.5 }}>{syncDetail}. Your changes are saved on this phone and will upload when it works again.</div>}
      </Field>
      <Field label="Your sync key — keep it private">
        <div style={{ ...st.inp, wordBreak:"break-all", userSelect:"all", WebkitUserSelect:"all", fontSize:13 }}>{myKey}</div>
        <button style={{ ...st.btnGhost, width:"100%", marginTop:6 }} onClick={copy}>📋 Copy key</button>
        <div style={{ fontSize:11, color:MUT, marginTop:6, lineHeight:1.5 }}>
          Your inventory is stored under this key. Installing to the home screen (iPhone) or switching phones starts with an empty
          app — paste this key there to get your data back.
        </div>
      </Field>
      <Field label="Use a different sync key (replaces this device's data)">
        <input style={st.inp} value={other} onChange={e=>setOther(e.target.value.trim())} placeholder="Paste sync key" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <button style={{ ...st.btnBlue, width:"100%", marginTop:6, opacity:other.length>=8?1:.4 }} disabled={other.length<8}
          onClick={()=>{ if (setUserId(other)) onRestore(); else toast("❌ Invalid key", "danger"); }}>Switch to this key</button>
      </Field>
      <Field label="Backup file">
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...st.btnGhost, flex:1 }} onClick={onExport}>📤 Export</button>
          <button style={{ ...st.btnGhost, flex:1 }} onClick={onImport}>📥 Import</button>
        </div>
      </Field>
      <Field label="Access code (if your server requires one)">
        <input style={st.inp} type="password" value={code} onChange={e=>setCode(e.target.value)} placeholder="Not set" autoComplete="off" />
        <button style={{ ...st.btnGhost, width:"100%", marginTop:6 }} onClick={()=>{ setAccessCode(code); toast("Saved", "ok"); }}>Save access code</button>
      </Field>
      <button style={{ ...st.btnGhost, width:"100%", marginTop:6 }} onClick={onClose}>Close</button>
    </Modal>
  );
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
  const [msgs,      setMsgs]      = useState([{ role:"assistant", id:0, text:"👋 Hi! I'm **Consumables AI**.\n\n📷 **Scan** — photo a product to auto-identify it\n⚡ **Quick Add** — tap common items instantly\n📦 **Items** — manage your inventory\n🛒 **Shop** — shopping list\n📊 **Home** — stock overview\n\nWhat would you like to do?" }]);
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
      if (i.qty === 0)                   toast(`🚨 ${i.name} OUT OF STOCK!`, "danger");
      else if (i.qty <= (i.minQty||1))   toast(`⚠️ Only ${i.qty} ${i.name} left!`, "warn");
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
      toast(`✅ +${p.qty||1} ${p.name} (total ${touched.qty})`, "ok");
    } else {
      touched = stamp({ ...p, id: nid(), added: new Date().toLocaleDateString() });
      next = [...prev, touched];
      toast(`🆕 ${p.name} added!`, "ok");
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
      return low.length ? `⚠️ **Low stock:**\n${low.map(i=>`• ${i.emoji} ${i.name}: ${i.qty===0?"OUT 🚨":`${i.qty} left`}`).join("\n")}` : "✅ Everything is well stocked!";
    if (q.match(/inventory|show|list|what.*have|all items|what do/))
      return items.length ? `📦 **Inventory (${items.length}):**\n${items.map(i=>`• ${i.emoji} ${i.name}: ${i.qty} ${i.unit}`).join("\n")}` : "📦 Inventory is empty. Add products in Scan tab!";
    if (q.match(/shop|buy|shopping/))
      return shopList.length ? `🛒 **Shopping list:**\n${shopList.map(i=>`• ${i.name} ×${i.qty}`).join("\n")}` : "🛒 Shopping list is empty.";
    if (q.match(/expir/)) {
      const week = localISO(7);
      const e = items.filter(i=>i.expiry&&i.expiry<=week);
      return e.length ? `⏰ **Expiring soon:**\n${e.map(i=>`• ${i.emoji} ${i.name} — ${i.expiry}`).join("\n")}` : "✅ Nothing expiring soon!";
    }
    if (q.match(/hi|hello|hey/)) return items.filter(i=>i.qty<=(i.minQty||1)).length > 0 ? `👋 Hi! You have **${items.filter(i=>i.qty<=(i.minQty||1)).length} items** running low. What would you like to do?` : "👋 Hi! Your inventory looks good. How can I help?";
    return items.length ? `📊 **${items.length} products** tracked.\n${items.filter(i=>i.qty<=(i.minQty||1)).length > 0 ? `⚠️ ${items.filter(i=>i.qty<=(i.minQty||1)).length} items need restocking.` : "✅ All stocked up!"}\n\nAsk me *"what's low?"* or *"show inventory"*` : "📦 Inventory empty! Go to **Scan** to add products.";
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
        if (!it) { lines.push(`❓ I couldn't find "${a.name}" in your inventory — nothing changed.`); continue; }
        const next = Math.max(0, it.qty + a.delta);
        const saved = updateItem(it.id, { qty: next });
        lines.push(`${it.emoji || "📦"} **${it.name}**: ${it.qty} → ${next}`);
        if (saved) alertLow([saved]);
      } else if (a.type === "add_item") {
        addItem({ name:a.name, qty:a.quantity, category:a.category, unit:a.unit, emoji:C_ICO[a.category] || "📦", minQty:1, expiry:"", notes:"", brand:"" });
        lines.push(`🆕 Added ${a.quantity} × **${a.name}**`);
      } else if (a.type === "add_to_shopping_list") {
        const list = shopRef.current, idx = list.findIndex(l => l.name.toLowerCase() === a.name.toLowerCase());
        const nextList = idx >= 0 ? list.map((l, i) => i === idx ? { ...l, qty: l.qty + a.quantity } : l) : [...list, { name:a.name, qty:a.quantity }];
        shopRef.current = nextList; updateShop(nextList);
        lines.push(`🛒 **${a.name}** ×${a.quantity} added to your shopping list`);
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
        ? "⚠️ I couldn't reach the AI, so **nothing was changed**. Use the − / + buttons on the Items tab, or try again in a moment."
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
      if (navigator.canShare?.({ files:[file] })) { await navigator.share({ files:[file], title:"Consumables backup" }); return toast("📤 Exported","ok"); }
    } catch (e) { if (e?.name === "AbortError") return; }
    const url = URL.createObjectURL(new Blob([text], { type:"application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("📤 Exported","ok");
  };
  const doImport = e => {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result);
        if (!Array.isArray(d.items)) return toast("❌ Invalid backup file","danger");
        const now=Date.now();
        // Merge by item id: newer edit wins, so importing an older backup can't clobber newer changes.
        const have=new Map(itemsRef.current.map(x=>[x.id,x]));
        const incoming=d.items.filter(x=>x&&typeof x.name==="string"&&x.name.trim()).map(x=>({ ...x, id:x.id??nid(), u:Math.max(x.u||0,now) }));
        incoming.forEach(x=>have.set(x.id,x));
        const next=[...have.values()];
        itemsRef.current=next; setItems(next);
        setTomb(tombRef.current=tombRef.current.filter(t=>!have.has(t.id)));
        if (Array.isArray(d.shop) && d.shop.length) updateShop(d.shop);
        toast(`📥 Imported ${incoming.length} items`,"ok");
      } catch { toast("❌ Couldn't read that file","danger"); }
    };
    r.readAsText(f); e.target.value="";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (locked) return <LockScreen onUnlock={unlock}/>;
  const syncDot = { synced:"#10b981", saving:"#60a5fa", loading:"#60a5fa", offline:"#f59e0b", error:"#ef4444", locked:"#ef4444" }[syncStatus] || "#5a7898";

  return (
    <div style={st.root}>
      <div style={st.grain}/>
      <Toast list={toasts}/>

      {showSettings && (
        <SettingsModal syncStatus={syncStatus} syncDetail={syncDetail} toast={toast} onClose={()=>setShowSettings(false)}
          onExport={doExport} onImport={()=>importRef.current?.click()}
          onRestore={()=>window.location.reload()} />
      )}
      <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={doImport}/>

      {/* Delete confirm */}
      {delItem && (
        <Modal onClose={()=>setDelItem(null)}>
          <p style={{ fontSize:14, color:"#c8d8ee", marginBottom:18 }}>Remove <b>{delItem.name}</b>?</p>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...st.btnRed, flex:1 }} onClick={()=>{ removeItem(delItem.id); setDelItem(null); toast("🗑 Removed","info"); }}>Yes, remove</button>
            <button style={{ ...st.btnGhost, flex:1 }} onClick={()=>setDelItem(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editItem && (
        <Modal onClose={()=>setEditItem(null)}>
          <EditForm item={editItem} onSave={updated=>{ const saved=updateItem(updated.id, updated); setEditItem(null); toast("✏️ Updated","info"); if(saved) alertLow([saved]); }} onCancel={()=>setEditItem(null)} />
        </Modal>
      )}

      {/* Quick add modal */}
      {showQuick && (
        <Modal onClose={()=>setShowQuick(false)}>
          <div style={{ fontSize:15, fontWeight:700, textAlign:"center", marginBottom:4 }}>⚡ Quick Add</div>
          <p style={{ fontSize:12, color:"#5a7898", marginBottom:12, textAlign:"center" }}>Tap to add 1 unit instantly:</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, maxHeight:"60vh", overflowY:"auto" }}>
            {QUICK_LIST.map(p => (
              <button key={p.name} style={st.qbtn} onClick={()=>{ addItem({...p,qty:1,minQty:1,expiry:"",notes:"",brand:""}); setShowQuick(false); }}>
                <div style={{ fontSize:22 }}>{p.emoji}</div>
                <div style={{ fontSize:11, fontWeight:600, marginTop:3, lineHeight:1.3 }}>{p.name}</div>
              </button>
            ))}
          </div>
          <button style={{ ...st.btnGhost, width:"100%", marginTop:12 }} onClick={()=>setShowQuick(false)}>Close</button>
        </Modal>
      )}

      {/* Header */}
      <header style={st.hdr}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={st.logo}>🛒</div>
          <div>
            <div style={st.appName}>Consumables</div>
            <div style={st.appSub}>AI Inventory Agent</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <div style={st.pill}><b style={st.pN}>{items.length}</b><span style={st.pL}>items</span></div>
          {lowCount>0 && <div style={{ ...st.pill, background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.25)" }}><b style={st.pN}>{lowCount}</b><span style={st.pL}>low⚠️</span></div>}
          <button style={{ ...st.hbtn, position:"relative" }} aria-label="Settings and sync" onClick={()=>setShowSettings(true)}>
            ⚙️<span style={{ position:"absolute", top:5, right:5, width:9, height:9, borderRadius:"50%", background:syncDot, border:"1.5px solid #07101e" }}/>
          </button>
        </div>
      </header>

      <main style={st.main}>

        {/* ── HOME ── */}
        {tab==="home" && (() => {
          const total=items.length, low=items.filter(i=>i.qty<=(i.minQty||1)), out=items.filter(i=>i.qty===0), exp=items.filter(i=>i.expiry&&i.expiry<=week), byCat=CATS.map(c=>({c,n:items.filter(i=>i.category===c).length})).filter(x=>x.n>0);
          if (!total) return (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 20px", textAlign:"center" }}>
              <div style={{ fontSize:60 }}>🛒</div>
              <h2 style={{ fontSize:18, fontWeight:700, marginTop:14 }}>Welcome!</h2>
              <p style={{ fontSize:13, color:"#5a7898", marginTop:10, lineHeight:1.7, maxWidth:270 }}>Track your household consumables and get alerts when you're running low.</p>
              <button style={{ ...st.bigBtn, marginTop:24 }} onClick={()=>setTab("scan")}>📷 Scan Your First Product</button>
              <button style={{ ...st.outBtn, marginTop:10 }} onClick={()=>setShowQuick(true)}>⚡ Quick Add Common Items</button>
            </div>
          );
          return (
            <div style={{ padding:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                {[{n:total,l:"Products"},{n:items.reduce((s,i)=>s+i.qty,0),l:"Total Units"},{n:low.length,l:"Low Stock ⚠️",w:low.length>0},{n:out.length,l:"Out of Stock",d:out.length>0}].map(({n,l,w,d})=>(
                  <div key={l} style={{ ...st.scard, ...(d&&n>0?{border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.05)"}:w&&n>0?{border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.05)"}:{}) }}>
                    <div style={{ fontSize:26, fontWeight:700, lineHeight:1 }}>{n}</div>
                    <div style={{ fontSize:11, color:"#5a7898", marginTop:4 }}>{l}</div>
                  </div>
                ))}
              </div>
              {exp.length>0 && <div style={st.alertR}>⏰ <b>Expiring soon:</b> {exp.map(i=>i.name).join(", ")}</div>}
              {low.length>0 && (
                <div style={st.card}>
                  <div style={st.cardHd}>🔴 Needs Restocking</div>
                  {low.map(i=><div key={i.id} style={st.row}><span>{i.emoji} {i.name}</span><span style={{ color:i.qty===0?"#f87171":"#fbbf24", fontWeight:700 }}>{i.qty===0?"OUT":`${i.qty} left`}</span></div>)}
                  <button style={st.lbtn} onClick={()=>setTab("shop")}>🛒 Open Shopping List →</button>
                </div>
              )}
              {byCat.length>0 && (
                <div style={st.card}>
                  <div style={st.cardHd}>📊 By Category</div>
                  {byCat.map(({c,n})=>(
                    <div key={c} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0" }}>
                      <span style={{ fontSize:11, width:130, flexShrink:0 }}>{C_ICO[c]} {c}</span>
                      <div style={{ flex:1, height:5, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, width:`${Math.max(8,(n/total)*100)}%`, background:C_CLR[c] }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, width:18, textAlign:"right" }}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── CHAT ── */}
        {tab==="chat" && (
          <div style={st.chatWrap}>
            <div style={st.chatScroll}>
              {msgs.length<=1 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
                  {["What's running low?","Show my inventory","What should I restock?","Expiring soon?","Stock summary"].map(q=>(
                    <button key={q} style={st.qchip} onClick={()=>sendChat(q)}>{q}</button>
                  ))}
                </div>
              )}
              {msgs.map(m=>(
                <div key={m.id} style={{ ...st.bubble, ...(m.role==="user"?st.bubU:st.bubA) }}>
                  {m.role==="assistant" && <div style={st.avatar}>🤖</div>}
                  <div style={{ ...st.bubText, ...(m.role==="user"?st.bubTextU:{}) }}>{md(m.text)}</div>
                </div>
              ))}
              {chatBusy && <div style={{ ...st.bubble, ...st.bubA }}><div style={st.avatar}>🤖</div><div style={st.bubText}><span className="dots"><span/><span/><span/></span></div></div>}
              <div ref={chatEnd}/>
            </div>
            <div style={st.chatBar}>
              <input style={st.chatIn} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Ask about your inventory…" disabled={chatBusy}/>
              <button style={{ ...st.sendBtn, opacity:chatBusy||!chatInput.trim()?0.4:1 }} onClick={()=>sendChat()} disabled={chatBusy||!chatInput.trim()}>➤</button>
            </div>
          </div>
        )}

        {/* ── SCAN ── */}
        {tab==="scan" && (
          <div style={st.scanWrap}>
            {scanStep==="idle" && (<>
              <div style={st.scanRing}>📷</div>
              <h2 style={{ fontSize:19, fontWeight:700 }}>Scan a Product</h2>
              <p style={{ fontSize:12, color:"#5a7898", textAlign:"center", maxWidth:270, lineHeight:1.7 }}>
                Point your camera at a <b style={{ color:"#93c5fd" }}>product label or packaging</b>. AI will automatically read and categorize it.
              </p>
              <button style={st.bigBtn} onClick={()=>fileRef.current?.click()}>
                📷 Take Photo
              </button>
              <button style={st.outBtn} onClick={()=>galleryRef.current?.click()}>
                🖼️ Choose from Library
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleFile}/>
              <input ref={galleryRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
                {["✅ Product labels","✅ Packaging","✅ Bottles","✅ Boxes & bags"].map(h=>(
                  <span key={h} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:7, padding:"4px 9px", fontSize:10, color:"#5a7898" }}>{h}</span>
                ))}
              </div>
              <div style={{ color:"#2a3a55", fontSize:11 }}>— or —</div>
              <button style={st.outBtn} onClick={()=>setScanStep("manual")}>✏️ Enter Manually</button>
              <button style={{ ...st.outBtn, color:"#fbbf24", borderColor:"rgba(245,158,11,0.3)" }} onClick={()=>setShowQuick(true)}>⚡ Quick Add Common Items</button>
            </>)}

            {scanStep==="scanning" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, padding:"24px 0", width:"100%" }}>
                {scanImg && <img src={scanImg} alt="" style={{ width:"100%", maxHeight:220, objectFit:"contain", borderRadius:12, background:"rgba(0,0,0,.2)", border:"1px solid rgba(255,255,255,.08)" }}/>}
                <div style={st.spinner}/>
                <p style={{ fontSize:13, color:"#93c5fd", fontWeight:600 }}>🤖 Analyzing product…</p>
                <p style={{ fontSize:11, color:"#5a7898" }}>Reading label and identifying category</p>
              </div>
            )}

            {scanStep==="confirm" && scanData && (
              <>
                {scanSource==="ai" && (
                  <div style={{ width:"100%", background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)", borderRadius:10, padding:"8px 14px", fontSize:12, color:"#6ee7b7", textAlign:"center", marginBottom:8 }}>
                    ✅ AI successfully identified this product
                  </div>
                )}
                {scanSource==="local" && (
                  <div style={{ width:"100%", background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.2)", borderRadius:10, padding:"8px 14px", fontSize:12, color:"#93c5fd", textAlign:"center", marginBottom:8 }}>
                    🔍 Detected from product name — please verify
                  </div>
                )}
                <ItemForm image={scanImg} prefill={scanData} isAI={scanSource==="ai"} title="✅ Confirm Product" onSave={finishScan} onCancel={resetScan}/>
              </>
            )}
            {scanStep==="manual" && (
              <ItemForm image={scanImg} prefill={scanData} isAI={false} title="✏️ Add Product" onSave={finishScan} onCancel={resetScan}/>
            )}
            {scanStep==="done" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"40px 0" }}>
                <div style={{ fontSize:64 }}>✅</div>
                <p style={{ fontSize:17, fontWeight:700, color:"#10b981" }}>Added to Inventory!</p>
                <button style={st.outBtn} onClick={resetScan}>Scan Another</button>
              </div>
            )}
          </div>
        )}

        {/* ── ITEMS ── */}
        {tab==="items" && (
          <div style={{ padding:12 }}>
            <div style={{ display:"flex", gap:7, marginBottom:10 }}>
              <input style={{ ...st.inp, flex:1 }} placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
              <div style={{ position:"relative" }}>
                <button style={st.hbtn} onClick={()=>setShowSort(v=>!v)}>⇅</button>
                {showSort && (
                  <div style={st.sortDrop}>
                    {["Name A-Z","Name Z-A","Qty: Low→High","Qty: High→Low","Recently Added","Category"].map(o=>(
                      <button key={o} style={{ ...st.sortOpt, ...(sortBy===o?{background:"rgba(37,99,235,.15)",color:"#60a5fa"}:{}) }} onClick={()=>{setSortBy(o);setShowSort(false);}}>{o}</button>
                    ))}
                  </div>
                )}
              </div>
              <button style={{ ...st.hbtn, background:"rgba(16,185,129,0.1)", borderColor:"rgba(16,185,129,0.2)" }} onClick={()=>{ setScanStep("manual"); setTab("scan"); }}>＋</button>
            </div>
            <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:8, marginBottom:8 }}>
              {activeCats.map(c=>(
                <button key={c} style={{ ...st.fchip, ...(catF===c?{background:"rgba(37,99,235,.18)",border:"1px solid rgba(96,165,250,.3)",color:"#60a5fa"}:{}) }} onClick={()=>setCatF(c)}>
                  {c==="All" ? c : `${C_ICO[c]} ${c}`}
                </button>
              ))}
            </div>
            <div style={{ fontSize:10, color:"#374a60", marginBottom:8 }}>{displayed.length} of {items.length} · {sortBy}</div>
            {displayed.length===0 ? (
              <div style={{ textAlign:"center", padding:"48px 20px", color:"#5a7898" }}>
                <div style={{ fontSize:44 }}>{search?"🔍":"📦"}</div>
                <p style={{ marginTop:10, fontSize:13 }}>{search?`No results for "${search}"`:"No items yet"}</p>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {displayed.map(item => {
                  const isLow=item.qty<=(item.minQty||1), isOut=item.qty===0, isExp=item.expiry&&item.expiry<=week;
                  return (
                    <div key={item.id} style={{ ...st.icard, ...(isOut?{border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.04)"}:isLow?{border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.04)"}:{}), ...(isExp?{borderTop:"2px solid #ef444466"}:{}) }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:26 }}>{item.emoji||"📦"}</span>
                        <div style={{ display:"flex", gap:3 }}>
                          <button style={st.mb} onClick={()=>setEditItem(item)}>✏️</button>
                          <button style={st.mb} onClick={()=>setDelItem(item)}>🗑</button>
                        </div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3, marginBottom:2 }}>{item.name}</div>
                      {item.brand && <div style={{ fontSize:10, color:"#3a5070", marginBottom:4 }}>{item.brand}</div>}
                      <div style={{ display:"inline-block", borderRadius:5, padding:"1px 6px", fontSize:9, fontWeight:500, marginBottom:4, background:C_CLR[item.category]+"22", color:C_CLR[item.category] }}>{item.category}</div>
                      {isOut && <div style={{ fontSize:9, fontWeight:700, color:"#f87171", background:"rgba(239,68,68,.12)", borderRadius:5, padding:"2px 6px", display:"inline-block", marginBottom:4 }}>🚨 OUT</div>}
                      {!isOut&&isLow && <div style={{ fontSize:9, fontWeight:700, color:"#fbbf24", background:"rgba(245,158,11,.12)", borderRadius:5, padding:"2px 6px", display:"inline-block", marginBottom:4 }}>⚠️ LOW</div>}
                      {isExp && <div style={{ fontSize:9, color:"#fca5a5", marginBottom:4 }}>⏰ Exp {item.expiry}</div>}
                      <Stepper value={item.qty} onChange={v=>{ const saved=updateItem(item.id, { qty:v }); if(saved) alertLow([saved]); }}/>
                      <div style={{ textAlign:"center", fontSize:10, color:"#4a6585", marginTop:3 }}>{item.unit}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SHOP ── */}
        {tab==="shop" && <ShopTab items={items} shopList={shopList} setShopList={updateShop} />}

      </main>

      {/* Tabs — bottom bar so they sit under the thumb */}
      <nav style={st.nav} aria-label="Main">
        {[{id:"home",icon:"📊",label:"Home"},{id:"chat",icon:"💬",label:"Chat"},{id:"scan",icon:"📷",label:"Scan"},{id:"items",icon:"📦",label:"Items"},{id:"shop",icon:"🛒",label:"Shop"}].map(t=>(
          <button key={t.id} style={{ ...st.tab, ...(tab===t.id?st.tabOn:{}) }} aria-current={tab===t.id?"page":undefined} onClick={()=>setTab(t.id)}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={st.tabLbl}>{t.label}</span>
            {t.id==="items" && lowCount>0 && <span style={{ ...st.dot, background:"#f59e0b" }}>{lowCount}</span>}
            {t.id==="shop"  && shopList.length>0 && <span style={st.dot}>{shopList.length}</span>}
          </button>
        ))}
      </nav>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%}
        body{font-family:'Sora',system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;overscroll-behavior-y:none;background:#07101e;-webkit-text-size-adjust:100%}
        button{touch-action:manipulation}
        input,select,button{font-family:inherit}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2e4a;border-radius:4px}
        input[type=date]{color-scheme:dark}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        select option{background:#0a1628}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,80%,100%{opacity:.1}40%{opacity:1}}
        .dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#60a5fa;margin:0 2px;animation:blink 1.2s infinite}
        .dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
      `}</style>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const BG="#07101e", PANEL="#0c1828", BORD="rgba(255,255,255,0.07)", TXT="#e2eaf5", MUT="#5a7898";
const st = {
  root:{ fontFamily:"'Sora',system-ui,-apple-system,sans-serif", background:`linear-gradient(155deg,${BG} 0%,#0d1a2e 55%,${BG} 100%)`, height:"100%", color:TXT, display:"flex", flexDirection:"column", maxWidth:500, margin:"0 auto", position:"relative", overflow:"hidden", paddingLeft:"env(safe-area-inset-left)", paddingRight:"env(safe-area-inset-right)" },
  grain:{ position:"fixed", inset:0, opacity:.015, backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", pointerEvents:"none", zIndex:0 },
  main:{ flex:1, minHeight:0, overflowY:"auto", WebkitOverflowScrolling:"touch", overscrollBehavior:"contain", position:"relative", zIndex:1 },
  hdr:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"calc(13px + env(safe-area-inset-top)) 13px 10px", borderBottom:`1px solid ${BORD}`, position:"relative", zIndex:1, flexShrink:0 },
  logo:{ width:38, height:38, borderRadius:11, background:"linear-gradient(135deg,#1a3a62,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, boxShadow:"0 0 14px rgba(37,99,235,.3)" },
  appName:{ fontSize:17, fontWeight:700, letterSpacing:"-.4px" },
  appSub:{ fontSize:9, color:MUT, textTransform:"uppercase", letterSpacing:".8px" },
  hbtn:{ width:40, height:40, background:"rgba(255,255,255,.05)", border:`1px solid ${BORD}`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, cursor:"pointer", flexShrink:0 },
  pill:{ background:"rgba(255,255,255,.04)", border:`1px solid ${BORD}`, borderRadius:8, padding:"3px 9px", textAlign:"center" },
  pN:{ display:"block", fontSize:14, fontWeight:700, lineHeight:1 },
  pL:{ display:"block", fontSize:8, color:MUT, marginTop:1 },
  nav:{ display:"flex", borderTop:`1px solid ${BORD}`, background:"rgba(7,16,30,.96)", zIndex:2, flexShrink:0, paddingBottom:"env(safe-area-inset-bottom)" },
  tab:{ flex:1, minHeight:56, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"6px 2px", background:"transparent", border:"none", borderTop:"2px solid transparent", color:"#6b87a8", cursor:"pointer", position:"relative" },
  tabOn:{ color:"#60a5fa", borderTop:"2px solid #60a5fa" },
  tabLbl:{ fontSize:10, fontWeight:500 },
  dot:{ position:"absolute", top:4, right:"calc(50% - 24px)", background:"#ef4444", color:"#fff", fontSize:8, fontWeight:700, borderRadius:999, padding:"1px 4px", minWidth:13, textAlign:"center" },
  btnGreen:{ padding:"11px 16px", background:"linear-gradient(135deg,#059669,#10b981)", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" },
  btnBlue:{ padding:"11px 16px", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" },
  btnRed:{ padding:"11px 16px", background:"linear-gradient(135deg,#b91c1c,#ef4444)", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" },
  btnGhost:{ padding:"11px 16px", background:"rgba(255,255,255,.05)", color:TXT, border:`1px solid ${BORD}`, borderRadius:10, fontSize:13, cursor:"pointer" },
  bigBtn:{ background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", color:"#fff", border:"none", borderRadius:13, padding:"13px 0", fontSize:14, fontWeight:600, cursor:"pointer", boxShadow:"0 5px 18px rgba(37,99,235,.4)", width:"100%", maxWidth:280 },
  outBtn:{ background:"rgba(255,255,255,.04)", color:"#a0b8d0", border:`1px solid ${BORD}`, borderRadius:13, padding:"11px 0", fontSize:13, cursor:"pointer", width:"100%", maxWidth:280, textAlign:"center" },
  lbtn:{ background:"none", border:"none", color:"#60a5fa", fontSize:12, cursor:"pointer", padding:0, marginTop:8 },
  tinyBtn:{ background:"rgba(255,255,255,.04)", border:`1px solid ${BORD}`, borderRadius:7, padding:"4px 8px", fontSize:10, color:MUT, cursor:"pointer" },
  chipBtn:{ background:"rgba(37,99,235,.12)", border:"1px solid rgba(96,165,250,.2)", borderRadius:7, padding:"3px 8px", fontSize:11, color:"#60a5fa", cursor:"pointer", flexShrink:0 },
  mb:{ background:"none", border:"none", fontSize:16, cursor:"pointer", opacity:.7, padding:"8px 9px", minWidth:36, minHeight:36 },
  inp:{ width:"100%", background:"rgba(255,255,255,.05)", border:`1px solid rgba(255,255,255,.1)`, borderRadius:9, padding:"10px 12px", color:TXT, fontSize:16, outline:"none" },
  sb:{ width:38, height:38, borderRadius:7, background:"rgba(255,255,255,.07)", border:`1px solid ${BORD}`, color:TXT, fontSize:17, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  chatWrap:{ display:"flex", flexDirection:"column", height:"100%" },
  chatScroll:{ flex:1, overflowY:"auto", padding:"12px 12px 6px" },
  qchip:{ background:"rgba(37,99,235,.1)", border:"1px solid rgba(96,165,250,.2)", borderRadius:20, padding:"5px 11px", fontSize:11, color:"#93c5fd", cursor:"pointer" },
  bubble:{ display:"flex", gap:7, marginBottom:10, animation:"fadeUp .3s ease" },
  bubA:{ alignItems:"flex-start" },
  bubU:{ flexDirection:"row-reverse" },
  avatar:{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#1a3a62,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 },
  bubText:{ background:"rgba(255,255,255,.04)", border:`1px solid ${BORD}`, borderRadius:"4px 11px 11px 11px", padding:"8px 12px", fontSize:13, lineHeight:1.65, maxWidth:"82%" },
  bubTextU:{ background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", border:"none", borderRadius:"11px 4px 11px 11px", color:"#ddeeff" },
  chatBar:{ display:"flex", gap:7, padding:"9px 12px", borderTop:`1px solid ${BORD}`, background:"rgba(0,0,0,.3)" },
  chatIn:{ flex:1, background:"rgba(255,255,255,.05)", border:`1px solid rgba(255,255,255,.09)`, borderRadius:10, padding:"10px 12px", color:TXT, fontSize:16, outline:"none" },
  sendBtn:{ width:44, height:44, borderRadius:10, background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", border:"none", color:"#fff", fontSize:14, cursor:"pointer", flexShrink:0, fontWeight:700 },
  scanWrap:{ padding:22, display:"flex", flexDirection:"column", alignItems:"center", gap:14, minHeight:"70vh", overflowY:"auto" },
  scanRing:{ width:80, height:80, borderRadius:"50%", background:"rgba(37,99,235,.1)", border:"2px solid rgba(96,165,250,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 },
  spinner:{ width:40, height:40, border:"3px solid rgba(255,255,255,.07)", borderTop:"3px solid #60a5fa", borderRadius:"50%", animation:"spin .8s linear infinite" },
  scard:{ background:"rgba(255,255,255,.03)", border:`1px solid ${BORD}`, borderRadius:13, padding:"13px 10px", textAlign:"center" },
  alertR:{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.2)", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#fca5a5", marginBottom:12 },
  card:{ background:"rgba(255,255,255,.02)", border:`1px solid ${BORD}`, borderRadius:12, padding:12, marginBottom:12 },
  cardHd:{ fontSize:11, fontWeight:700, color:"#6090b0", marginBottom:8, textTransform:"uppercase", letterSpacing:".5px" },
  row:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:`1px solid rgba(255,255,255,.03)`, fontSize:13 },
  icard:{ background:"rgba(255,255,255,.025)", border:`1px solid ${BORD}`, borderRadius:13, padding:11, animation:"fadeUp .3s ease" },
  fchip:{ background:"rgba(255,255,255,.03)", border:`1px solid ${BORD}`, borderRadius:8, padding:"4px 10px", color:MUT, fontSize:11, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 },
  sortDrop:{ position:"absolute", right:0, top:36, background:PANEL, border:`1px solid ${BORD}`, borderRadius:11, zIndex:100, minWidth:150, boxShadow:"0 8px 28px rgba(0,0,0,.6)", overflow:"hidden" },
  sortOpt:{ display:"block", width:"100%", background:"none", border:"none", borderBottom:`1px solid ${BORD}`, padding:"9px 13px", color:"#ccd9ee", fontSize:12, cursor:"pointer", textAlign:"left" },
  qbtn:{ background:"rgba(255,255,255,.04)", border:`1px solid ${BORD}`, borderRadius:12, padding:"12px 8px", cursor:"pointer", textAlign:"center", color:TXT },
};
