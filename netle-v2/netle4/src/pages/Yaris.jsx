import { useState, useEffect, useRef } from "react";
import { ref, onValue, set, push, update, get } from "firebase/database";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { rtdb, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import BottomNav from "../components/BottomNav";

export default function Yaris({ T, bildir, setEkran, soruBaslat }) {
  const { kullanici, profil } = useAuth();
  const [tab, setTab] = useState("lobi"); // lobi | yaris | besli
  const [odalar, setOdalar] = useState([]);
  const [besliOdalar, setBesliOdalar] = useState([]);
  const [odaAdi, setOdaAdi] = useState("");
  const [yukleniyor, setYuk] = useState(false);
  const [sorular, setSorular] = useState([]);

  // Canlı soru yarışı
  const [aktifOda, setAktifOda] = useState(null);
  const [oyunDurumu, setOyunDurumu] = useState(null);
  const [soruIdx, setSoruIdx] = useState(0);
  const [secilen, setSec] = useState(null);
  const [sonuclar, setSonuclar] = useState({});
  const [sure, setSure] = useState(15);
  const sureRef = useRef(null);

  useEffect(() => {
    // Soruları yükle
    async function yukle() {
      const q = query(collection(db, "sorular"), limit(200));
      const snap = await getDocs(q);
      setSorular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    yukle();

    // Odaları dinle
    const yarisRef = ref(rtdb, "yarislar");
    const besliRef = ref(rtdb, "besliMasa");

    const u1 = onValue(yarisRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setOdalar(Object.entries(data).map(([id, v]) => ({ id, ...v })).filter(o => o.durum === "bekliyor"));
      } else setOdalar([]);
    });

    const u2 = onValue(besliRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setBesliOdalar(Object.entries(data).map(([id, v]) => ({ id, ...v })).filter(o => o.durum === "bekliyor"));
      } else setBesliOdalar([]);
    });

    return () => { u1(); u2(); };
  }, []);

  // Aktif oda dinle
  useEffect(() => {
    if (!aktifOda) return;
    const tip = aktifOda.tip || "yaris";
    const odaRef = ref(rtdb, `${tip === "besli" ? "besliMasa" : "yarislar"}/${aktifOda.id}`);
    return onValue(odaRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setOyunDurumu(data);
        if (data.soruIdx !== undefined) setSoruIdx(data.soruIdx);
        if (data.sonuclar) setSonuclar(data.sonuclar);
        if (data.durum === "bitti") {
          clearInterval(sureRef.current);
        }
      }
    });
  }, [aktifOda]);

  // Süre sayacı
  useEffect(() => {
    if (!oyunDurumu || oyunDurumu.durum !== "oynuyor") return;
    setSure(15);
    clearInterval(sureRef.current);
    sureRef.current = setInterval(() => {
      setSure(s => {
        if (s <= 1) {
          clearInterval(sureRef.current);
          // Süre doldu, boş cevap
          if (!secilen) cevapVer(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(sureRef.current);
  }, [soruIdx, oyunDurumu?.durum]);

  async function odaOlustur(tip) {
    if (!odaAdi.trim()) { bildir("Oda adı girin!", "hata"); return; }
    if (sorular.length === 0) { bildir("Sorular yükleniyor...", "hata"); return; }
    setYuk(true);
    try {
      const karisik = [...sorular].sort(() => Math.random() - 0.5).slice(0, 10);
      const dbRef = ref(rtdb, tip === "besli" ? "besliMasa" : "yarislar");
      const yeniRef = await push(dbRef, {
        ad: odaAdi,
        tip,
        kurucu: kullanici.uid,
        kurucuAd: profil?.ad || "?",
        durum: "bekliyor",
        sorular: karisik.map(s => ({ id: s.id, soru: s.soru, a: s.a, b: s.b, c: s.c, d: s.d, e: s.e || "", dogru: s.dogru })),
        oyuncular: { [kullanici.uid]: { ad: profil?.ad || "?", puan: 0, hazir: false } },
        soruIdx: 0,
        olusturuldu: Date.now(),
        maxOyuncu: tip === "besli" ? 5 : 2,
      });
      setOdaAdi("");
      setAktifOda({ id: yeniRef.key, tip });
      bildir("Oda oluşturuldu! Rakip bekleniyor...", "basari");
    } catch (e) {
      bildir("Hata: " + e.message, "hata");
    }
    setYuk(false);
  }

  async function odaKatil(oda) {
    const tip = oda.tip || "yaris";
    const dbPath = tip === "besli" ? "besliMasa" : "yarislar";
    const oyuncular = oda.oyuncular || {};
    const max = oda.maxOyuncu || 2;

    if (Object.keys(oyuncular).length >= max) {
      bildir("Oda dolu!", "hata"); return;
    }

    await update(ref(rtdb, `${dbPath}/${oda.id}/oyuncular/${kullanici.uid}`), {
      ad: profil?.ad || "?", puan: 0, hazir: false,
    });
    setAktifOda({ id: oda.id, tip });
  }

  async function hazirOl() {
    if (!aktifOda || !oyunDurumu) return;
    const tip = aktifOda.tip || "yaris";
    const dbPath = tip === "besli" ? "besliMasa" : "yarislar";
    await update(ref(rtdb, `${dbPath}/${aktifOda.id}/oyuncular/${kullanici.uid}`), { hazir: true });

    // Tüm oyuncular hazır mı?
    const snap = await get(ref(rtdb, `${dbPath}/${aktifOda.id}/oyuncular`));
    if (snap.exists()) {
      const oyuncular = snap.val();
      const hepsiHazir = Object.values(oyuncular).every(o => o.hazir);
      const yeterli = Object.keys(oyuncular).length >= (tip === "besli" ? 2 : 2);
      if (hepsiHazir && yeterli) {
        await update(ref(rtdb, `${dbPath}/${aktifOda.id}`), { durum: "oynuyor" });
      }
    }
  }

  async function cevapVer(sik) {
    if (secilen || !aktifOda || !oyunDurumu) return;
    setSec(sik);
    clearInterval(sureRef.current);
    const tip = aktifOda.tip || "yaris";
    const dbPath = tip === "besli" ? "besliMasa" : "yarislar";
    const mevcutSoru = oyunDurumu.sorular?.[soruIdx];
    const dogru = sik && sik === mevcutSoru?.dogru;

    await update(ref(rtdb, `${dbPath}/${aktifOda.id}/sonuclar/${soruIdx}`), {
      [kullanici.uid]: { cevap: sik, dogru, zaman: Date.now() },
    });

    if (dogru) {
      const puan = (oyunDurumu.oyuncular?.[kullanici.uid]?.puan || 0) + (sure * 10);
      await update(ref(rtdb, `${dbPath}/${aktifOda.id}/oyuncular/${kullanici.uid}`), { puan });
    }

    // Tüm cevaplar geldi mi kontrol
    setTimeout(async () => {
      const snap = await get(ref(rtdb, `${dbPath}/${aktifOda.id}`));
      if (!snap.exists()) return;
      const data = snap.val();
      const oyuncuSayisi = Object.keys(data.oyuncular || {}).length;
      const cevapSayisi = Object.keys(data.sonuclar?.[soruIdx] || {}).length;

      if (cevapSayisi >= oyuncuSayisi) {
        const sonrakiIdx = soruIdx + 1;
        if (sonrakiIdx >= (data.sorular?.length || 10)) {
          await update(ref(rtdb, `${dbPath}/${aktifOda.id}`), { durum: "bitti" });
        } else {
          setTimeout(async () => {
            setSec(null);
            await update(ref(rtdb, `${dbPath}/${aktifOda.id}`), { soruIdx: sonrakiIdx });
          }, 1500);
        }
      }
    }, 2000);
  }

  function odayCik() {
    setAktifOda(null);
    setOyunDurumu(null);
    setSec(null);
    setSoruIdx(0);
    setSonuclar({});
  }

  // === OYUN EKRANI ===
  if (aktifOda && oyunDurumu) {
    const mevcutSoru = oyunDurumu.sorular?.[soruIdx];
    const oyuncular = oyunDurumu.oyuncular || {};
    const tip = aktifOda.tip || "yaris";

    if (oyunDurumu.durum === "bekliyor") {
      const hazirSayisi = Object.values(oyuncular).filter(o => o.hazir).length;
      const toplamOyuncu = Object.keys(oyuncular).length;
      const benHazir = oyuncular[kullanici.uid]?.hazir;
      const max = tip === "besli" ? 5 : 2;

      return (
        <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 20 }}>
          <button onClick={odayCik} style={{ alignSelf: "flex-start", background: T.bg2, border: "none", borderRadius: 9, padding: "8px 14px", color: T.text, marginBottom: 20 }}>← Çık</button>

          <div style={{ background: T.bg2, borderRadius: 20, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{oyunDurumu.ad}</div>
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 20 }}>
              {tip === "besli" ? "🃏 Beşli Masa" : "⚡ Hızlı Yarış"} · {toplamOyuncu}/{max} oyuncu
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Object.entries(oyuncular).map(([uid, o]) => (
                <div key={uid} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: T.bg3, borderRadius: 10, padding: "10px 14px",
                }}>
                  <span style={{ fontWeight: 600 }}>{o.ad}</span>
                  <span style={{ fontSize: 12 }}>{o.hazir ? "✅ Hazır" : "⏳ Bekliyor"}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>
              {toplamOyuncu < max
                ? `${max - toplamOyuncu} oyuncu daha bekleniyor...`
                : `${hazirSayisi}/${toplamOyuncu} hazır`}
            </div>

            {!benHazir && (
              <button onClick={hazirOl} style={{
                width: "100%", padding: "14px", background: T.gradient,
                border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 15,
              }}>
                ✅ Hazırım!
              </button>
            )}
            {benHazir && <div style={{ color: "#10b981", fontWeight: 700 }}>Diğer oyuncular bekleniyor...</div>}
          </div>
        </div>
      );
    }

    if (oyunDurumu.durum === "bitti") {
      const sirali = Object.entries(oyuncular).sort((a, b) => (b[1].puan || 0) - (a[1].puan || 0));
      return (
        <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 20, alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>Yarış Bitti!</div>
          <div style={{ width: "100%", background: T.bg2, borderRadius: 20, padding: 20, marginBottom: 20 }}>
            {sirali.map(([uid, o], i) => (
              <div key={uid} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < sirali.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : T.bg3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14,
                }}>{i + 1}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>{o.ad}</div>
                <div style={{ fontWeight: 800, color: T.accent }}>{o.puan || 0} puan</div>
              </div>
            ))}
          </div>
          <button onClick={odayCik} style={{
            padding: "14px 32px", background: T.gradient, border: "none",
            borderRadius: 12, color: "white", fontWeight: 800, fontSize: 15,
          }}>Ana Sayfa</button>
        </div>
      );
    }

    if (oyunDurumu.durum === "oynuyor" && mevcutSoru) {
      const benimCevap = sonuclar[soruIdx]?.[kullanici.uid];
      return (
        <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "14px" }}>

          {/* SKOR */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
            {Object.entries(oyuncular).sort((a, b) => (b[1].puan || 0) - (a[1].puan || 0)).map(([uid, o]) => (
              <div key={uid} style={{
                flex: 1, background: uid === kullanici.uid ? T.accent + "33" : T.bg2,
                border: `1px solid ${uid === kullanici.uid ? T.accent : T.border}`,
                borderRadius: 10, padding: "8px", textAlign: "center", minWidth: 70,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{o.ad.split(" ")[0]}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>{o.puan || 0}</div>
              </div>
            ))}
          </div>

          {/* SÜRE */}
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{
              display: "inline-block", fontSize: 28, fontWeight: 900,
              color: sure <= 5 ? "#ef4444" : T.accent,
              animation: sure <= 5 ? "bounce 0.5s infinite" : "none",
            }}>{sure}</div>
            <div style={{ height: 4, background: T.bg3, borderRadius: 100, marginTop: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: sure <= 5 ? "#ef4444" : T.gradient, borderRadius: 100, width: `${(sure / 15) * 100}%`, transition: "width 1s linear" }} />
            </div>
          </div>

          {/* SORU */}
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, padding: "20px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>
              Soru {soruIdx + 1} / {oyunDurumu.sorular?.length}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.65, fontWeight: 500 }}>{mevcutSoru.soru}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["a", "b", "c", "d", "e"].filter(s => mevcutSoru[s]).map(sik => {
                let extra = {};
                if (benimCevap) {
                  if (sik === mevcutSoru.dogru) extra = { background: "#022c22", border: "1px solid #10b981" };
                  else if (sik === benimCevap.cevap) extra = { background: "#2d0a0a", border: "1px solid #ef4444" };
                  else extra = { opacity: 0.3 };
                }
                return (
                  <button key={sik} onClick={() => !benimCevap && cevapVer(sik)} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "11px 13px", background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 11, color: T.text, textAlign: "left",
                    opacity: benimCevap && !extra.background ? 0.3 : 1,
                    ...extra,
                  }}>
                    <span style={{ background: T.bg2, borderRadius: 6, padding: "2px 7px", fontWeight: 800, fontSize: 10, color: T.accent, minWidth: 24, textAlign: "center" }}>{sik.toUpperCase()}</span>
                    <span style={{ fontSize: 14 }}>{mevcutSoru[sik]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
  }

  // === LOBİ EKRANI ===
  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>⚡ Online Yarış</h2>
      </div>

      {/* TAB */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 14px" }}>
        {[["yaris", "⚡ Hızlı Yarış"], ["besli", "🃏 Beşli Masa"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px", background: tab === t ? T.gradient : T.bg2,
            border: `1px solid ${tab === t ? "transparent" : T.border}`,
            borderRadius: 10, color: "white", fontWeight: 700, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>

      {/* ODA OLUŞTUR */}
      <div style={{ margin: "0 14px 14px", background: T.bg2, borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {tab === "yaris" ? "⚡ Yeni Yarış Odası Oluştur (2 kişi)" : "🃏 Beşli Masa Oluştur (2-5 kişi)"}
        </div>
        <input
          style={{ width: "100%", padding: "11px 14px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 14, outline: "none", marginBottom: 10 }}
          placeholder="Oda adı..."
          value={odaAdi}
          onChange={e => setOdaAdi(e.target.value)}
        />
        <button onClick={() => odaOlustur(tab)} disabled={yukleniyor} style={{
          width: "100%", padding: "12px", background: T.gradient, border: "none",
          borderRadius: 10, color: "white", fontWeight: 800, fontSize: 14,
          opacity: yukleniyor ? 0.6 : 1,
        }}>
          {yukleniyor ? "⏳ Oluşturuluyor…" : "Oda Oluştur"}
        </button>
      </div>

      {/* MEVCUT ODALAR */}
      <div style={{ padding: "0 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          {tab === "yaris" ? "Açık Odalar" : "Beşli Masa Odaları"}
        </div>
        {(tab === "yaris" ? odalar : besliOdalar).length === 0 && (
          <div style={{ textAlign: "center", color: T.text3, padding: "20px 0", fontSize: 12 }}>
            Açık oda yok. Yeni oda oluşturun!
          </div>
        )}
        {(tab === "yaris" ? odalar : besliOdalar).map(oda => {
          const oyuncuSayisi = Object.keys(oda.oyuncular || {}).length;
          const max = oda.maxOyuncu || 2;
          return (
            <div key={oda.id} style={{
              background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
              padding: "14px 16px", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{oda.ad}</div>
                <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>
                  {oda.kurucuAd} · {oyuncuSayisi}/{max} oyuncu
                </div>
              </div>
              <button onClick={() => odaKatil(oda)} disabled={oyuncuSayisi >= max} style={{
                padding: "8px 16px", background: oyuncuSayisi >= max ? T.bg3 : T.gradient,
                border: "none", borderRadius: 9, color: "white", fontWeight: 700, fontSize: 12,
              }}>
                {oyuncuSayisi >= max ? "Dolu" : "Katıl"}
              </button>
            </div>
          );
        })}
      </div>

      <BottomNav ekran="yaris" setEkran={setEkran} T={T} />
    </div>
  );
}
