import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { TEMALAR } from "../themes";
import BottomNav from "../components/BottomNav";

const SINAV_TARIHI = "2025-10-15";
const DEMO_LIMIT = 10;

function gunFarki(d) {
  return Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000));
}

const HABERLER_RSS = [
  { baslik: "Adalet Bakanlığı 2025 GYS sınav takvimi açıklandı", url: "#", tarih: "2 saat önce" },
  { baslik: "Zabıt katibi sınav konuları güncellendi", url: "#", tarih: "1 gün önce" },
  { baslik: "GYS başvuru tarihleri belli oldu", url: "#", tarih: "3 gün önce" },
  { baslik: "Yazı işleri müdürlüğü sınav ilanı yayımlandı", url: "#", tarih: "5 gün önce" },
  { baslik: "2025 yılı mübaşir sınavı hakkında duyuru", url: "#", tarih: "1 hafta önce" },
];

export default function Ana({ T, tema, temaGuncelle, bildir, setEkran, soruBaslat }) {
  const { profil } = useAuth();
  const [sorular, setSorular] = useState([]);
  const [konular, setKonular] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [istat] = useState(() => {
    try { return JSON.parse(localStorage.getItem("netle_istat") || '{"dogru":0,"yanlis":0,"konular":{}}'); }
    catch { return { dogru: 0, yanlis: 0, konular: {} }; }
  });
  const [gunluk] = useState(() => {
    const bugun = new Date().toDateString();
    const kayit = JSON.parse(localStorage.getItem("netle_gunluk") || '{"tarih":"","sayi":0}');
    if (kayit.tarih !== bugun) { localStorage.setItem("netle_gunluk", JSON.stringify({ tarih: bugun, sayi: 0 })); return 0; }
    return kayit.sayi;
  });
  const [acilModal, setAcilModal] = useState(false);
  const [temaModal, setTemaModal] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const gun = gunFarki(SINAV_TARIHI);
  const toplam = istat.dogru + istat.yanlis;
  const oran = toplam > 0 ? Math.round((istat.dogru / toplam) * 100) : 0;

  useEffect(() => {
    async function yukle() {
      try {
        const q = query(collection(db, "sorular"),
          where("sinav", "==", profil?.sinav || profil?.unvan || ""),
          limit(500));
        const snap = await getDocs(q);
        const data = snap.docs.map((d, i) => ({ id: d.id, ...d.data(), idx: i }));

        // Eğer ünvana özel soru yoksa tümünü getir
        if (data.length === 0) {
          const q2 = query(collection(db, "sorular"), limit(500));
          const snap2 = await getDocs(q2);
          const data2 = snap2.docs.map((d, i) => ({ id: d.id, ...d.data(), idx: i }));
          setSorular(data2);
          setKonular([...new Set(data2.map(s => s.ders || s.konu).filter(Boolean))]);
        } else {
          setSorular(data);
          setKonular([...new Set(data.map(s => s.ders || s.konu).filter(Boolean))]);
        }
      } catch (e) {
        console.log("Soru yükleme hatası:", e);
      }
      setYukleniyor(false);
    }
    if (profil) yukle();
  }, [profil]);

  useEffect(() => {
    const onlineRef = ref(rtdb, "online");
    return onValue(onlineRef, (snap) => {
      setOnlineCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
  }, []);

  function konuBaslat(konu) {
    if (!profil?.premium && gunluk >= DEMO_LIMIT) {
      bildir("Günlük 10 soru limitine ulaştınız! Premium'a geçin.", "hata");
      return;
    }
    const liste = sorular.filter(s => (s.ders || s.konu) === konu);
    const cozulenIds = JSON.parse(localStorage.getItem("netle_cozulen") || "[]");
    const cozulmemis = liste.filter(s => !cozulenIds.includes(s.id));
    const hedef = [...(cozulmemis.length ? cozulmemis : liste)].sort(() => Math.random() - 0.5);
    soruBaslat({ sorular: hedef, mod: "normal", baslik: konu });
  }

  function rastgeleCoz() {
    if (!profil?.premium && gunluk >= DEMO_LIMIT) {
      bildir("Günlük limit doldu!", "hata"); return;
    }
    const hedef = [...sorular].sort(() => Math.random() - 0.5)
      .slice(0, profil?.premium ? 50 : DEMO_LIMIT - gunluk);
    soruBaslat({ sorular: hedef, mod: "normal", baslik: "Rastgele" });
  }

  function hataKutusunuCoz() {
    const hataIds = JSON.parse(localStorage.getItem("netle_hata") || "[]");
    if (!hataIds.length) { bildir("Hata kutunuz boş! 🎉", "info"); return; }
    const liste = sorular.filter(s => hataIds.includes(s.id));
    if (!liste.length) { bildir("Sorular yüklenirken hata kutusu kontrol edildi.", "info"); return; }
    soruBaslat({ sorular: [...liste].sort(() => Math.random() - 0.5), mod: "hata", baslik: "Hata Kutusu" });
  }

  const hataKutusu = JSON.parse(localStorage.getItem("netle_hata") || "[]");

  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", paddingBottom: 90 }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 10px" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.1em", background: T.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NETLE</div>
          <div style={{ fontSize: 9, color: T.text3, marginTop: 1 }}>{profil?.unvan || "Adalet Bakanlığı GYS"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, color: T.text3, background: T.bg2, padding: "4px 8px", borderRadius: 100 }}>
            🟢 {onlineCount} çevrimiçi
          </div>
          {profil?.admin && (
            <button onClick={() => setEkran("admin")} style={{ background: "#4c1d95", border: "none", borderRadius: 8, padding: "5px 10px", color: "#c4b5fd", fontSize: 11, fontWeight: 700 }}>
              ⚙️ Admin
            </button>
          )}
          {profil?.premium && <span style={{ fontSize: 9, background: T.gradient, color: "white", padding: "3px 8px", borderRadius: 100, fontWeight: 800 }}>⭐ PRO</span>}
          <button onClick={() => setTemaModal(true)} style={{ background: T.bg2, border: "none", borderRadius: 8, padding: "6px 8px", fontSize: 16 }}>🎨</button>
          <button onClick={() => setEkran("profil")} style={{ background: T.accent, border: "none", borderRadius: "50%", width: 32, height: 32, color: "white", fontWeight: 800, fontSize: 13 }}>
            {(profil?.ad || "?")[0].toUpperCase()}
          </button>
        </div>
      </div>

      {/* SINAV SAYACI */}
      <div style={{
        margin: "0 14px 12px",
        background: `linear-gradient(135deg, ${T.accent}22, ${T.bg2})`,
        border: `1px solid ${T.accent}44`,
        borderRadius: 20, padding: "18px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 42, fontWeight: 900, color: T.accent, lineHeight: 1 }}>{gun}</div>
          <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>Sınava kalan gün</div>
          <div style={{ fontSize: 9, color: T.text3, marginTop: 2 }}>15 Ekim 2025</div>
        </div>
        <div style={{ position: "relative", width: 60, height: 60 }}>
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="24" fill="none" stroke={T.bg3} strokeWidth="5" />
            <circle cx="30" cy="30" r="24" fill="none" stroke={T.accent} strokeWidth="5"
              strokeDasharray={`${Math.min(gun / 400, 1) * 150.8} 150.8`}
              strokeLinecap="round" transform="rotate(-90 30 30)" />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 20 }}>⚖️</div>
        </div>
      </div>

      {/* STAT */}
      <div style={{ display: "flex", gap: 8, margin: "0 14px 12px" }}>
        {[["✅", istat.dogru, "Doğru"], ["❌", istat.yanlis, "Yanlış"], ["📊", `%${oran}`, "Başarı"]].map(([ic, v, l]) => (
          <div key={l} style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 18 }}>{ic}</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "2px 0" }}>{v}</div>
            <div style={{ fontSize: 9, color: T.text3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* GÜNLÜK LİMİT */}
      {!profil?.premium && (
        <div style={{ margin: "0 14px 10px", background: T.bg2, borderRadius: 11, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: T.text2, marginBottom: 6 }}>📅 Günlük: {gunluk} / {DEMO_LIMIT}</div>
          <div style={{ height: 4, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", background: T.gradient, borderRadius: 100, width: `${(gunluk / DEMO_LIMIT) * 100}%`, transition: "width .3s" }} />
          </div>
        </div>
      )}

      {/* HIZLI BUTONLAR */}
      <div style={{ display: "flex", gap: 8, margin: "0 14px 10px" }}>
        <button onClick={hataKutusunuCoz} style={{
          flex: 1, background: `linear-gradient(135deg, #7f1d1d, ${T.bg2})`,
          border: "1px solid #991b1b", borderRadius: 14, padding: "12px",
          color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          📦 Hata Kutusu
          {hataKutusu.length > 0 && <span style={{ background: "#ef4444", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{hataKutusu.length}</span>}
        </button>
        <button onClick={rastgeleCoz} style={{
          flex: 1, background: T.gradient, border: "none",
          borderRadius: 14, padding: "12px", color: "white", fontSize: 13, fontWeight: 700,
        }}>
          🎲 Rastgele
        </button>
      </div>

      {/* YARIŞA GİT */}
      <button onClick={() => setEkran("yaris")} style={{
        margin: "0 14px 10px", width: "calc(100% - 28px)",
        background: `linear-gradient(135deg, #1d4ed8, ${T.bg2})`,
        border: "1px solid #2563eb", borderRadius: 14, padding: "12px",
        color: "white", fontSize: 13, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        ⚡ Online Yarışa Katıl · Beşli Masa
      </button>

      {/* ACİL YARDIM */}
      <button onClick={() => setAcilModal(true)} style={{
        margin: "0 14px 12px", width: "calc(100% - 28px)",
        background: "linear-gradient(135deg, #dc2626, #991b1b)",
        border: "none", borderRadius: 14, padding: "11px",
        color: "white", fontSize: 13, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        animation: "pulse 3s infinite",
      }}>
        🆘 Acil Yardım Hattı
      </button>

      {/* RSS HABERLER */}
      <div style={{ padding: "0 14px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          📰 Son Haberler
        </div>
        {HABERLER_RSS.map((h, i) => (
          <div key={i} style={{
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 11,
            padding: "10px 12px", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{h.baslik}</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{h.tarih}</div>
            </div>
            <span style={{ color: T.accent, fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>

      {/* KONULAR */}
      <div style={{ padding: "0 14px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          📚 Konu Bazlı Çalış · {sorular.length} soru
        </div>
        {yukleniyor && <div style={{ textAlign: "center", color: T.text3, padding: 20, fontSize: 12 }}>⏳ Yükleniyor…</div>}
        {!yukleniyor && sorular.length === 0 && (
          <div style={{ textAlign: "center", color: T.text3, padding: 20, fontSize: 12 }}>
            📭 Henüz soru eklenmemiş.<br />
            <span style={{ fontSize: 10 }}>Admin panelinden PDF yükleyerek ekleyin.</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {konular.map((k, i) => {
            const ks = istat.konular?.[k];
            const kt = ks ? ks.d + ks.y : 0;
            const ko = ks && kt > 0 ? Math.round((ks.d / kt) * 100) : null;
            const cnt = sorular.filter(s => (s.ders || s.konu) === k).length;
            return (
              <button key={k} onClick={() => konuBaslat(k)} style={{
                background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
                padding: "13px 11px", textAlign: "left", position: "relative",
                animation: `fadeUp 0.4s ease ${i * 40}ms both`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.4, marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 9, color: T.text3 }}>{cnt} soru</div>
                {ko !== null && (
                  <div style={{
                    position: "absolute", top: 8, right: 9, fontSize: 10, fontWeight: 800,
                    color: ko >= 70 ? "#10b981" : ko >= 40 ? "#f59e0b" : "#ef4444",
                  }}>%{ko}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <BottomNav ekran="ana" setEkran={setEkran} T={T} />

      {/* ACİL YARDIM MODALİ */}
      {acilModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={() => setAcilModal(false)}>
          <div style={{ background: T.bg2, borderRadius: 20, padding: 24, maxWidth: 340, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#ef4444" }}>🆘 Acil Yardım</div>
            {[
              { isim: "ALO 182 - Adalet Bakanlığı", tel: "182" },
              { isim: "ALO 170 - Personel Şikayeti", tel: "170" },
              { isim: "TBMM İnsan Hakları Komisyonu", tel: "0312 420 64 96" },
              { isim: "Türkiye Barolar Birliği", tel: "0312 416 72 00" },
            ].map(({ isim, tel }) => (
              <a key={tel} href={`tel:${tel}`} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: T.bg3, borderRadius: 11, padding: "12px 14px", marginBottom: 8,
                color: T.text, textDecoration: "none",
              }}>
                <span style={{ fontSize: 13 }}>{isim}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>📞 {tel}</span>
              </a>
            ))}
            <button onClick={() => setAcilModal(false)} style={{
              width: "100%", padding: "12px", background: T.bg3, border: "none",
              borderRadius: 11, color: T.text2, fontSize: 14, marginTop: 4,
            }}>Kapat</button>
          </div>
        </div>
      )}

      {/* TEMA MODALİ */}
      {temaModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setTemaModal(false)}>
          <div style={{
            background: T.bg2, borderRadius: "20px 20px 0 0", padding: 24,
            width: "100%", maxWidth: 480,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>🎨 Tema Seç</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(TEMALAR).map(([k, v]) => (
                <button key={k} onClick={() => { temaGuncelle(k); setTemaModal(false); }} style={{
                  background: v.bg, border: `2px solid ${tema === k ? v.accent : v.border}`,
                  borderRadius: 14, padding: "14px", color: v.text,
                  fontWeight: 700, fontSize: 14,
                }}>
                  {v.isim}
                  {tema === k && <span style={{ marginLeft: 6, color: v.accent }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setTemaModal(false)} style={{
              width: "100%", marginTop: 12, padding: "12px", background: T.bg3,
              border: "none", borderRadius: 11, color: T.text2, fontSize: 14,
            }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}
