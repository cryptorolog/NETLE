import { useState, useEffect } from "react";

export default function Soru({ T, bildir, setEkran, params }) {
  const [idx, setIdx] = useState(0);
  const [secilen, setSec] = useState(null);
  const [anim, setAnim] = useState(null);
  const [istat, setIstat] = useState(() => {
    try { return JSON.parse(localStorage.getItem("netle_istat") || '{"dogru":0,"yanlis":0,"konular":{}}'); }
    catch { return { dogru: 0, yanlis: 0, konular: {} }; }
  });

  const sorular = params?.sorular || [];
  const soru = sorular[idx];

  function kaydet(yeniIstat) {
    localStorage.setItem("netle_istat", JSON.stringify(yeniIstat));
  }

  function gunlukArttir() {
    const bugun = new Date().toDateString();
    const g = JSON.parse(localStorage.getItem("netle_gunluk") || '{"tarih":"","sayi":0}');
    if (g.tarih !== bugun) localStorage.setItem("netle_gunluk", JSON.stringify({ tarih: bugun, sayi: 1 }));
    else localStorage.setItem("netle_gunluk", JSON.stringify({ tarih: bugun, sayi: g.sayi + 1 }));
  }

  function cevapVer(sik) {
    if (secilen) return;
    setSec(sik);
    const dogru = sik === soru.dogru;

    setTimeout(() => {
      setAnim(dogru ? "r" : "l");

      // İstatistik güncelle
      const konu = soru.ders || soru.konu || "Genel";
      const yeni = { ...istat };
      if (dogru) yeni.dogru = (yeni.dogru || 0) + 1;
      else yeni.yanlis = (yeni.yanlis || 0) + 1;
      if (!yeni.konular) yeni.konular = {};
      if (!yeni.konular[konu]) yeni.konular[konu] = { d: 0, y: 0 };
      if (dogru) yeni.konular[konu].d++;
      else yeni.konular[konu].y++;
      setIstat(yeni);
      kaydet(yeni);
      gunlukArttir();

      // Hata kutusu
      const hata = JSON.parse(localStorage.getItem("netle_hata") || "[]");
      if (dogru) {
        const yeniHata = hata.filter(id => id !== soru.id);
        localStorage.setItem("netle_hata", JSON.stringify(yeniHata));
      } else if (!hata.includes(soru.id)) {
        localStorage.setItem("netle_hata", JSON.stringify([...hata, soru.id]));
      }

      // Çözülenler
      const cozulen = JSON.parse(localStorage.getItem("netle_cozulen") || "[]");
      if (!cozulen.includes(soru.id)) {
        localStorage.setItem("netle_cozulen", JSON.stringify([...cozulen, soru.id]));
      }

      setTimeout(() => {
        setAnim(null);
        setSec(null);
        if (idx + 1 < sorular.length) setIdx(i => i + 1);
        else {
          bildir("Tüm sorular tamamlandı! 🎉", "basari");
          setEkran("ana");
        }
      }, 380);
    }, 900);
  }

  if (!soru) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <div style={{ fontSize: 32 }}>📭</div>
        <div style={{ color: T.text2 }}>Soru bulunamadı</div>
        <button onClick={() => setEkran("ana")} style={{ background: T.gradient, border: "none", borderRadius: 11, padding: "12px 24px", color: "white", fontWeight: 700 }}>Ana Sayfa</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 14px 20px" }}>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
        <button onClick={() => setEkran("ana")} style={{ background: T.bg2, border: "none", borderRadius: 9, padding: "8px 14px", color: T.text, fontSize: 16 }}>←</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.text3, fontWeight: 600, marginBottom: 3 }}>
            {params?.baslik} · {idx + 1} / {sorular.length}
          </div>
          <div style={{ height: 3, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", background: T.gradient, borderRadius: 100, width: `${((idx + 1) / sorular.length) * 100}%`, transition: "width .3s" }} />
          </div>
        </div>
        {params?.mod === "hata" && <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>📦</span>}
      </div>

      {/* KART */}
      <div style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 22,
        padding: "22px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 16,
        transition: "transform 0.3s ease, opacity 0.3s ease",
        ...(anim === "r" ? { transform: "translateX(115%) rotate(7deg)", opacity: 0 } : {}),
        ...(anim === "l" ? { transform: "translateX(-115%) rotate(-7deg)", opacity: 0 } : {}),
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {soru.sinav && <span style={{ color: T.text3 }}>{soru.sinav} · </span>}
          {soru.ders || soru.konu}
        </div>

        {soru.gorsel_url && (
          <img src={soru.gorsel_url} alt="soru görseli" style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "contain" }} />
        )}

        <div style={{ fontSize: 15, lineHeight: 1.7, color: T.text, fontWeight: 500 }}>{soru.soru}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["a", "b", "c", "d", "e"].filter(s => soru[s]).map(sik => {
            let extra = {};
            if (secilen) {
              if (sik === soru.dogru) extra = { background: "#022c22", border: "1px solid #10b981" };
              else if (sik === secilen) extra = { background: "#2d0a0a", border: "1px solid #ef4444" };
              else extra = { opacity: 0.3 };
            }
            return (
              <button key={sik} onClick={() => cevapVer(sik)} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "11px 13px", background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 11, color: T.text, textAlign: "left", transition: "all .15s",
                ...extra,
              }}>
                <span style={{
                  background: T.bg2, borderRadius: 6, padding: "2px 7px",
                  fontWeight: 800, fontSize: 10, color: T.accent,
                  minWidth: 24, textAlign: "center", marginTop: 2,
                }}>{sik.toUpperCase()}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>{soru[sik]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!secilen && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 2px", fontSize: 11 }}>
          <span style={{ color: "#ef4444" }}>← Yanlış</span>
          <span style={{ color: T.text3 }}>şık seçerek yanıtla</span>
          <span style={{ color: "#10b981" }}>Doğru →</span>
        </div>
      )}
      {secilen && (
        <div style={{
          margin: "8px 0", borderRadius: 13, padding: "12px 16px",
          fontSize: 13, fontWeight: 700, textAlign: "center",
          background: secilen === soru.dogru ? "#022c22" : "#2d0a0a",
          border: `1px solid ${secilen === soru.dogru ? "#10b981" : "#ef4444"}`,
        }}>
          {secilen === soru.dogru
            ? "✅ Doğru Bildiniz!"
            : `❌ Doğru: ${soru.dogru?.toUpperCase()}) ${soru[soru.dogru]}`}
        </div>
      )}
    </div>
  );
}
