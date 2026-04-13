export default function Splash({ T }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 16,
    }}>
      <div style={{
        fontSize: 64, fontWeight: 900, letterSpacing: "0.1em",
        background: T.gradient, WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent", animation: "pulse 2s infinite",
      }}>NETLE</div>
      <div style={{ fontSize: 13, color: T.text2 }}>⚖️ Adalet Bakanlığı · Görevde Yükselme</div>
      <div style={{
        width: 32, height: 32, border: `3px solid ${T.bg3}`,
        borderTop: `3px solid ${T.accent}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite", marginTop: 8,
      }} />
    </div>
  );
}
