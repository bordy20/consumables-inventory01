import { useState, useEffect } from "react";
import { CATS, UNITS, C_ICO, C_CLR } from "./shared.js";
import { getUserId, setUserId, getAccessCode, setAccessCode } from "./sync.js";

// ─── Icons (24×24, 1.8 stroke, drawn for this app) ─────────────────────────────
const ICONS = {
  home:   <path d="M3 10.5 12 3l9 7.5V19a2 2 0 0 1-2 2h-4.5v-6h-5v6H5a2 2 0 0 1-2-2z" />,
  chat:   <path d="M20.5 11.5a8 7.5 0 0 1-11.7 6.6L3.5 19.5l1.5-4.4A7.5 7.5 0 0 1 4 11.5a8 7.5 0 0 1 16.5 0z" />,
  scan:   <><path d="M4 8h3l1.7-2.5h6.6L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.2" r="3.6" /></>,
  box:    <><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  cart:   <><path d="M3 4h2.4l2.1 10.3a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6" /><circle cx="9.6" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></>,
  sliders:<><path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" /><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  plus:   <path d="M12 5v14M5 12h14" />,
  minus:  <path d="M5 12h14" />,
  sort:   <path d="M8 4v16m0 0-3-3m3 3 3-3M16 20V4m0 0-3 3m3-3 3 3" />,
  send:   <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  close:  <path d="M6 6l12 12M18 6 6 18" />,
  check:  <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert:  <><path d="M12 4 3 19.5h18z" /><path d="M12 10v4.4M12 17.2v.1" /></>,
  clock:  <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  image:  <><rect x="3" y="4.5" width="18" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></>,
  edit:   <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  trash:  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4h6v3" />,
  share:  <path d="M12 15V4m0 0L8 8m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />,
  copy:   <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" /></>,
  lock:   <><rect x="5" y="11" width="14" height="9.5" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  bolt:   <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  cartplus: <><path d="M3 4h2.4l2.1 10.3a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6" /><circle cx="9.6" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /><path d="M13 9v4M11 11h4" /></>,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19.5h14" />,
  upload:   <path d="M12 15V4m0 0L8 8m4-4 4 4M5 19.5h14" />,
};

export function Icon({ name, size = 24, stroke = 1.8, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {ICONS[name]}
    </svg>
  );
}

// ─── Building blocks ───────────────────────────────────────────────────────────
export function Toast({ list }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => <div key={t.id} className={`toast glass-strong ${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

/** Bottom sheet. Closes on backdrop tap or Escape. */
export function Sheet({ onClose, title, children }) {
  useEffect(() => {
    const f = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet glass-strong" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return <div className="field"><div className="field-label">{label}</div>{children}</div>;
}

export function Stepper({ value, onChange, min = 0, unit, label = "Quantity" }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="step" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" size={20} /></button>
      <div className="step-val" aria-live="polite"><span>{value}</span>{unit && <small>{unit}</small>}</div>
      <button className="step" aria-label="Increase" onClick={() => onChange(value + 1)}><Icon name="plus" size={20} /></button>
    </div>
  );
}

const Select = ({ label, value, onChange, options }) => (
  <select className="select" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(o => <option key={o}>{o}</option>)}
  </select>
);

// ─── Add / confirm product ─────────────────────────────────────────────────────
export function ItemForm({ image, prefill, isAI, title, onSave, onCancel }) {
  const [name,     setName]     = useState(prefill?.name     || "");
  const [brand,    setBrand]    = useState(prefill?.brand    || "");
  const [category, setCategory] = useState(prefill?.category || "Personal Care");
  const [unit,     setUnit]     = useState(prefill?.unit     || "piece");
  const [qty,      setQty]      = useState(prefill?.qty      || 1);
  const [minQty,   setMinQty]   = useState(prefill?.minQty   || 1);
  const [expiry,   setExpiry]   = useState(prefill?.expiry   || "");
  const [notes]                 = useState(prefill?.notes    || "");

  const ok = name.trim().length > 0;
  const save = () => onSave({ name: name.trim(), brand, category, unit, qty, minQty, expiry, notes, emoji: C_ICO[category] || "📦" });

  return (
    <div className="glass" style={{ borderRadius: "var(--r-xl)", padding: 20 }}>
      <h2 className="sheet-title" style={{ marginBottom: 14 }}>{title}</h2>
      {image && <img className="preview" src={image} alt="Photo of the product" style={{ marginBottom: 14 }} />}
      {isAI && <div className="notice ai">The assistant filled this in from your photo. Check it before you add.</div>}
      <Field label="Product name">
        <input className="input" aria-label="Product name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Colgate toothpaste" />
      </Field>
      <Field label="Brand (optional)">
        <input className="input" aria-label="Brand" value={brand} onChange={e => setBrand(e.target.value)} />
      </Field>
      <Field label="Category"><Select label="Category" value={category} onChange={setCategory} options={CATS} /></Field>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="Quantity"><Stepper value={qty} onChange={setQty} min={1} /></Field>
        <Field label="Unit"><Select label="Unit" value={unit} onChange={setUnit} options={UNITS} /></Field>
      </div>
      <div className="row">
        <Field label="Warn me at or below">
          <input className="input" aria-label="Low stock level" type="number" inputMode="numeric" min="0" value={minQty} onChange={e => setMinQty(+e.target.value || 1)} />
        </Field>
        <Field label="Expiry date">
          <input className="input" aria-label="Expiry date" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!ok} onClick={save}>Add to inventory</button>
        <button className="btn btn-glass" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Edit an existing product (opens in a sheet) ───────────────────────────────
export function EditForm({ item, onSave, onCancel, onDelete }) {
  const [name,     setName]     = useState(item.name);
  const [brand,    setBrand]    = useState(item.brand    || "");
  const [category, setCategory] = useState(item.category || "Personal Care");
  const [unit,     setUnit]     = useState(item.unit     || "piece");
  const [minQty,   setMinQty]   = useState(item.minQty   || 1);
  const [expiry,   setExpiry]   = useState(item.expiry   || "");
  const ok = name.trim().length > 0;
  const save = () => onSave({ ...item, name: name.trim(), brand, category, unit, minQty, expiry, emoji: C_ICO[category] || "📦" });
  return (
    <>
      <Field label="Name"><input className="input" aria-label="Name" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Brand (optional)"><input className="input" aria-label="Brand" value={brand} onChange={e => setBrand(e.target.value)} /></Field>
      <Field label="Category"><Select label="Category" value={category} onChange={setCategory} options={CATS} /></Field>
      <div className="row">
        <Field label="Unit"><Select label="Unit" value={unit} onChange={setUnit} options={UNITS} /></Field>
        <Field label="Warn me at or below">
          <input className="input" aria-label="Low stock level" type="number" inputMode="numeric" min="0" value={minQty} onChange={e => setMinQty(+e.target.value || 1)} />
        </Field>
      </div>
      <Field label="Expiry date"><input className="input" aria-label="Expiry date" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></Field>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!ok} onClick={save}>Save changes</button>
        <button className="btn btn-glass" onClick={onCancel}>Cancel</button>
      </div>
      <button className="btn btn-danger block" style={{ marginTop: 12 }} onClick={onDelete}><Icon name="trash" size={20} />Remove item</button>
    </>
  );
}

// ─── Shopping list ─────────────────────────────────────────────────────────────
export function ShopTab({ items, shopList, setShopList }) {
  const [sName, setSName] = useState("");
  const [sQty,  setSQty]  = useState(1);

  const suggested = items.filter(i => i.qty <= (i.minQty || 1) && !shopList.find(l => l.name.toLowerCase() === i.name.toLowerCase()));

  const addShop = (n, q = 1) => {
    if (!n.trim()) return;
    const idx = shopList.findIndex(l => l.name.toLowerCase() === n.toLowerCase());
    setShopList(idx >= 0
      ? shopList.map((l, i) => i === idx ? { ...l, qty: l.qty + q } : l)
      : [...shopList, { name: n.trim(), qty: q }]);
    setSName(""); setSQty(1);
  };

  const exportList = async () => {
    const text = "Shopping list\n" + new Date().toLocaleDateString() + "\n\n" + shopList.map(i => `${i.checked ? "✓" : "○"} ${i.name}  ×${i.qty}`).join("\n");
    try { if (navigator.share) { await navigator.share({ title: "Shopping list", text }); return; } }
    catch (e) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); alert("Shopping list copied"); return; } catch {}
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "shopping-list.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="glass" style={{ borderRadius: "var(--r-lg)", padding: 14 }}>
        <div className="row" style={{ alignItems: "center" }}>
          <input className="input" style={{ flex: 1 }} aria-label="Item to buy" placeholder="Add an item to buy" value={sName}
            onChange={e => setSName(e.target.value)} onKeyDown={e => e.key === "Enter" && addShop(sName, sQty)} />
        </div>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <Stepper value={sQty} onChange={setSQty} min={1} />
          <button className="btn btn-primary" disabled={!sName.trim()} onClick={() => addShop(sName, sQty)}><Icon name="plus" size={20} />Add</button>
        </div>
      </div>

      {suggested.length > 0 && (<>
        <h2 className="h2">Running low</h2>
        <div className="glass group">
          {suggested.map(i => (
            <div className="item" key={i.id}>
              <div className="tile" aria-hidden="true">{i.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-name">{i.name}</div>
                <div className="item-meta">{i.qty === 0 ? "Out of stock" : `${i.qty} left`}</div>
              </div>
              <button className="btn btn-glass btn-sm" onClick={() => addShop(i.name, Math.max(1, i.minQty || 2))}><Icon name="plus" size={18} />Add</button>
            </div>
          ))}
        </div>
      </>)}

      {shopList.length > 0 ? (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 4px 10px" }}>
          <h2 className="h2" style={{ margin: 0 }}>To buy ({shopList.length})</h2>
          <div style={{ display: "flex", gap: 4 }}>
            {shopList.some(i => i.checked) && <button className="btn btn-text btn-sm" onClick={() => setShopList(shopList.filter(i => !i.checked))}>Clear ticked</button>}
            <button className="btn btn-text btn-sm" onClick={exportList}><Icon name="share" size={19} />Share</button>
          </div>
        </div>
        <div className="glass group">
          {shopList.map((item, idx) => (
            <div className="item" key={idx}>
              <button className={`check-row ${item.checked ? "done" : ""}`} role="checkbox" aria-checked={!!item.checked}
                onClick={() => setShopList(shopList.map((l, i) => i === idx ? { ...l, checked: !l.checked } : l))}>
                <span className="check" aria-checked={!!item.checked}><Icon name="check" size={18} stroke={2.6} /></span>
                <span style={{ flex: 1 }}>{item.name}</span>
                <span className="muted num">×{item.qty}</span>
              </button>
              <button className="icon-btn" style={{ width: 44, height: 44 }} aria-label={`Remove ${item.name}`} onClick={() => setShopList(shopList.filter((_, i) => i !== idx))}>
                <Icon name="close" size={20} />
              </button>
            </div>
          ))}
        </div>
      </>) : (
        <div className="empty">
          <Icon name="cart" size={42} />
          <h3>Your list is empty</h3>
          <p>Add what you need above. Items that run low appear here automatically.</p>
        </div>
      )}
    </div>
  );
}

// ─── Lock screen (shown when the server has APP_ACCESS_CODE set) ───────────────
export function LockScreen({ onUnlock }) {
  const [code, setCode] = useState("");
  return (
    <div className="app" data-mood="ok" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div className="glass" style={{ borderRadius: "var(--r-xl)", padding: "30px 24px", width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="ring"><Icon name="lock" size={36} /></div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.015em" }}>Consumables</h1>
        <p className="muted">Enter your access code to continue.</p>
        <input className="input" type="password" autoComplete="current-password" autoFocus aria-label="Access code" placeholder="Access code"
          value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && code && onUnlock(code)} />
        <button className="btn btn-primary block" disabled={!code} onClick={() => onUnlock(code)}>Unlock</button>
      </div>
    </div>
  );
}

// ─── Settings: sync key backup/restore, access code, status ───────────────────
const SYNC_LABEL = { loading: "Loading…", synced: "Synced", saving: "Saving…", offline: "Offline. Changes will upload when you're back online.", error: "Can't reach the server. Retrying.", locked: "Locked" };
const SYNC_TONE  = { synced: "ok", saving: "ok", loading: "ok", offline: "low", error: "out", locked: "out" };

export function SettingsModal({ syncStatus, syncDetail, onClose, onRestore, onExport, onImport, toast }) {
  const myKey = getUserId();
  const [other, setOther] = useState("");
  const [code, setCode] = useState(getAccessCode());
  const copy = async () => {
    try { await navigator.clipboard.writeText(myKey); toast("Sync key copied", "ok"); }
    catch { toast("Press and hold the key to copy it", "info"); }
  };
  return (
    <Sheet onClose={onClose} title="Settings">
      <Field label="Sync status">
        <div className={`status ${SYNC_TONE[syncStatus] || "ok"}`} style={{ fontSize: 16, marginTop: 0 }}>{SYNC_LABEL[syncStatus] || syncStatus}</div>
        {syncDetail && syncStatus !== "synced" && (
          <div className="small muted" style={{ marginTop: 6 }}>{syncDetail}. Your changes are saved on this phone and will upload when it works again.</div>
        )}
      </Field>

      <Field label="Your sync key. Keep it private.">
        <div className="input" style={{ display: "flex", alignItems: "center", height: "auto", padding: "12px 14px", wordBreak: "break-all", userSelect: "all", WebkitUserSelect: "all", fontSize: 15 }}>{myKey}</div>
        <button className="btn btn-glass block" style={{ marginTop: 8 }} onClick={copy}><Icon name="copy" size={20} />Copy key</button>
        <p className="cap" style={{ marginTop: 8 }}>Your inventory is stored under this key. A home-screen install or a new phone starts empty: paste the key there to get your data back.</p>
      </Field>

      <Field label="Use a different sync key (replaces this device's data)">
        <input className="input" aria-label="Sync key to use" value={other} onChange={e => setOther(e.target.value.trim())} placeholder="Paste sync key" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <button className="btn btn-primary block" style={{ marginTop: 8 }} disabled={other.length < 8}
          onClick={() => { if (setUserId(other)) onRestore(); else toast("That key isn't valid", "danger"); }}>Switch to this key</button>
      </Field>

      <Field label="Backup file">
        <div className="row">
          <button className="btn btn-glass" style={{ flex: 1 }} onClick={onExport}><Icon name="download" size={20} />Export</button>
          <button className="btn btn-glass" style={{ flex: 1 }} onClick={onImport}><Icon name="upload" size={20} />Import</button>
        </div>
      </Field>

      <Field label="Access code (if your server requires one)">
        <input className="input" aria-label="Access code" type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Not set" autoComplete="off" />
        <button className="btn btn-glass block" style={{ marginTop: 8 }} onClick={() => { setAccessCode(code); toast("Access code saved", "ok"); }}>Save access code</button>
      </Field>

      <button className="btn btn-glass block" style={{ marginTop: 6 }} onClick={onClose}>Done</button>
      <div className="cap" style={{ textAlign: "center", marginTop: 12 }}>Version {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}</div>
    </Sheet>
  );
}

export { C_CLR };
