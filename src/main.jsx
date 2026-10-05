import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";

// Keep the installed app current: when a new build is deployed the service worker
// updates and the page reloads itself (data is already saved locally + in the cloud).
// Also look for a new build every time the app comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60 * 1000);
  },
});

// A render error should never leave a blank screen on a phone — show a recovery
// screen instead. Data is safe: it lives in local storage and in the cloud.
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:24, color:"#e2eaf5", textAlign:"center", fontFamily:"system-ui,sans-serif" }}>
        <div style={{ fontSize:44 }}>😵</div>
        <div style={{ fontSize:17, fontWeight:700 }}>Something went wrong</div>
        <div style={{ fontSize:13, color:"#5a7898", maxWidth:260 }}>Your inventory is safe. Reload to continue.</div>
        <button onClick={() => window.location.reload()} style={{ padding:"12px 24px", borderRadius:12, border:"none", background:"#2563eb", color:"#fff", fontSize:15, fontWeight:600 }}>Reload</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
);
