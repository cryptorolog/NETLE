import BottomNav from "../components/BottomNav";

export default function Istatistik({ T, setEkran }) {
  const istat = (() => {
    try { return JSON.parse(localStorage.getItem("netle_istat") || '{"dogru":0,"yanlis":0,"konular":{}}'); }
    catch { return { dogru: 0, yanlis: 0, konular: {} }; }
  })();

  const toplam = istat.dogru + istat.yanlis;
  const oran = toplam > 0 ? Math.round((istat.dogru / toplam) * 100) : 0;
  const konular = Object.entries(istat.konular || {});

  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setEkran("ana")} style={{ background: T.bg2, border: "none", borderRadius: 9, padding: "8px 14px", color: T.text, fontSize: 16 }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📊 İstatistikler</h2>
      </div>

      {/* GENEL */}
      <div style={{
        margin: "0 14px 14px",
        background: `linear-gradient(135deg, ${T.accent}22, ${T.bg2})`,
        border: `1px solid ${T.accent}44`,
        borderRadius: 20, padding: "20px",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" width="110" height="110">
            <circle cx="50" cy="50" r="40" fill="none" stroke={T.bg3} strokeWidth="12" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={T.accent} strokeWidth="12"
              strokeDasharray={`${oran * 2.51} 251`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, fontWeight: 900, color: T.accent }}>
            %{oran}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Genel Başarı</div>
          <div style={{ fontSize: 13, color: T.text2 }}>{toplam} soru çözüldü</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 4 }}>✅ {istat.dogru} · ❌ {istat.yanlis}</div>
        </div>
      </div>

      {/* KONULAR */}
      <div style={{ padding: "0 14px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          Konulara Göre
        </div>
        {konular.length === 0 && (
          <div style={{ textAlign: "center", color: T.text3, padding: 20, fontSize: 12 }}>Henüz soru çözmediniz.</div>
        )}
        {konular.map(([k, ks]) => {
          const kt = (ks.d || 0) + (ks.y || 0);
          const ko = kt > 0 ? Math.round(((ks.d || 0) / kt) * 100) : 0;
          const col = ko >= 70 ? "#10b981" : ko >= 40 ? "#f59e0b" : "#ef4444";
          return (
            <div key={k} style={{ background: T.bg2, borderRadius: 13, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>%{ko}</span>
              </div>
              <div style={{ height: 5, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", background: col, borderRadius: 100, width: ko + "%", transition: "width .6s" }} />
              </div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>
                {ks.d || 0} doğru · {ks.y || 0} yanlış · {kt} toplam
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav ekran="istat" setEkran={setEkran} T={T} />
    </div>
  );
}
