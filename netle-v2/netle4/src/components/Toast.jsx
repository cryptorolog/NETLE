export default function Toast({ toast, T }) {
  const bg = toast.tip === "hata" ? "#ef4444" : toast.tip === "basari" ? "#10b981" : T.accent;
  return (
    <div style={{
      position: "fixed", top: "max(16px, env(safe-area-inset-top))",
      left: "50%", transform: "translateX(-50%)",
      background: bg, color: "white", padding: "10px 22px",
      borderRadius: 100, fontSize: 13, fontWeight: 600,
      zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,.4)",
      whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      {toast.msg}
    </div>
  );
}
