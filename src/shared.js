// Constants and small helpers shared by the app and its UI components.

export const nid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);   // collision-safe numeric id

export const localISO = (daysAhead = 0) => {                                      // YYYY-MM-DD in the phone's local time
  const d = new Date(Date.now() + daysAhead * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

export const CATS  = ["Oral Care","Toilet Paper","Personal Care","Cleaning","Food & Beverage","Medicine","Other"];
export const UNITS = ["piece","pack","bottle","tube","roll","bar","box","can","bag","sachet","set","pair"];
export const C_ICO = {"Oral Care":"🦷","Toilet Paper":"🧻","Personal Care":"🧴","Cleaning":"🧹","Food & Beverage":"🥫","Medicine":"💊","Other":"📦"};
// Category colours are tuned to read on dark glass.
export const C_CLR = {"Oral Care":"#7CC4FF","Toilet Paper":"#B8A1FF","Personal Care":"#FF92C8","Cleaning":"#5BE3B0","Food & Beverage":"#FFC56B","Medicine":"#FF8F86","Other":"#AEB9C7"};

/** "out" | "low" | "ok" — one definition of stock state for the whole UI. */
export const stockState = (i) => (i.qty === 0 ? "out" : i.qty <= (i.minQty || 1) ? "low" : "ok");
