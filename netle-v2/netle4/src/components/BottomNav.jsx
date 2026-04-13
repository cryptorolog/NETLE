import { useAuth } from "../contexts/AuthContext";

export default function BottomNav({ ekran, setEkran, T }) {
  const { profil } = useAuth();

  const items = [
    { id: "ana", icon: "🏠", label: "Ana" },
    { id: "yaris", icon: "⚡", label: "Yarış" },
    { id: "besli", icon: "🃏", label: "Beşli Masa" },
    { id: "istat", icon: "📊", label: "İstatistik" },
    { id: "profil", icon: "👤", label: "Profil" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480,
      background: T.bg2, borderTop: `1px solid ${T.border}`,
      display: "flex", justifyContent: "space-around",
      padding: "8px 0", paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
      zIndex: 100, backdropFilter: "blur(10px)",
    }}>
      {items.map(item => (
        <button key={item.id}
          onClick={() => setEkran(item.id)}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            background: "none", border: "none",
            color: ekran === item.id ? T.accent : T.text3,
            fontSize: 18, padding: "2px 8px",
            transition: "color 0.2s",
          }}>
          <span>{item.icon}</span>
          <span style={{ fontSize: 9, fontWeight: ekran === item.id ? 700 : 400 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
