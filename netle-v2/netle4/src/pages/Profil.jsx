import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { TEMALAR } from "../themes";
import BottomNav from "../components/BottomNav";

export default function Profil({ T, tema, temaGuncelle, bildir, setEkran }) {
  const { kullanici, profil, cikisYap, profilGuncelle } = useAuth();
  const [aktKod, setAK] = useState("");
  const [aktMsg, setAM] = useState("");
  const [soru, setSoru] = useState({ soru: "", a: "", b: "", c: "", d: "", e: "", dogru: "a", konu: "" });
  const [soruMsg, setSoruMsg] = useState("");

  async function aktivasyonUygula() {
    // Basit kod kontrolü - gerçekte Firestore'dan kontrol edilmeli
    if (aktKod.trim().length >= 6) {
      await profilGuncelle({ premium: true, aktivasyonKodu: aktKod });
      setAM("✅ Premium aktif! Sınırsız erişim kazandınız.");
    } else {
      setAM("❌ Geçersiz kod.");
    }
  }

  async function kullaniciSoruEkle() {
    if (!soru.soru || !soru.a || !soru.b || !soru.c || !soru.d) {
      setSoruMsg("Soru, A, B, C, D şıkları zorunlu!"); return;
    }
    try {
      const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      await addDoc(collection(db, "kullanici_sorular"), {
        ...soru,
        ekleyenUid: kullanici.uid,
        ekleyenAd: profil?.ad || "?",
        ekleyenUnvan: profil?.unvan || "",
        durum: "bekliyor",
        olusturuldu: serverTimestamp(),
      });
      setSoruMsg("✅ Sorunuz admin onayına gönderildi!");
      setSoru({ soru: "", a: "", b: "", c: "", d: "", e: "", dogru: "a", konu: "" });
    } catch (e) {
      setSoruMsg("❌ Hata: " + e.message);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setEkran("ana")} style={{ background: T.bg2, border: "none", borderRadius: 9, padding: "8px 14px", color: T.text, fontSize: 16 }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>👤 Profil</h2>
      </div>

      {/* PROFİL KARTI */}
      <div style={{ margin: "0 14px 14px", background: T.bg2, borderRadius: 20, padding: 22, textAlign: "center" }}>
        <div style={{
          width: 68, height: 68, borderRadius: "50%", background: T.gradient,
          fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 10px", color: "white",
        }}>{(profil?.ad || "?")[0].toUpperCase()}</div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>{profil?.ad}</div>
        {profil?.unvan && <div style={{ fontSize: 12, color: T.accent, marginBottom: 3 }}>{profil.unvan}</div>}
        <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>{kullanici?.email}</div>
        {profil?.premium
          ? <div style={{ display: "inline-block", background: T.gradient, color: "white", padding: "4px 14px", borderRadius: 100, fontWeight: 800, fontSize: 11 }}>⭐ Premium — Sınırsız</div>
          : <div style={{ display: "inline-block", background: T.bg3, color: T.text2, padding: "4px 14px", borderRadius: 100, fontSize: 11 }}>🔒 Ücretsiz · 10 soru/gün</div>
        }
      </div>

      {/* TEMA */}
      <div style={{ margin: "0 14px 14px", background: T.bg2, borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🎨 Tema Seç</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(TEMALAR).map(([k, v]) => (
            <button key={k} onClick={() => { temaGuncelle(k); profilGuncelle({ tema: k }); }} style={{
              background: v.bg, border: `2px solid ${tema === k ? v.accent : v.border}`,
              borderRadius: 12, padding: "12px", color: v.text, fontWeight: 700, fontSize: 13,
            }}>
              {v.isim} {tema === k && "✓"}
            </button>
          ))}
        </div>
      </div>

      {/* PREMIUM AKTİVASYON */}
      {!profil?.premium && (
        <div style={{ margin: "0 14px 14px", background: T.bg2, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>🔑 Premium Aktivasyon</div>
          <div style={{ background: T.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>IBAN</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>TR12 3456 7890 1234 5678 9012 34</div>
            <div style={{ fontSize: 9, color: T.text3, marginTop: 4 }}>Açıklama: NETLE {kullanici?.email}</div>
          </div>
          <input style={{
            width: "100%", padding: "11px 14px", background: T.bg,
            border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 14,
            outline: "none", marginBottom: 8,
          }} placeholder="Aktivasyon kodunuzu girin" value={aktKod} onChange={e => setAK(e.target.value)} />
          <button onClick={aktivasyonUygula} style={{
            width: "100%", padding: "12px", background: T.gradient, border: "none",
            borderRadius: 10, color: "white", fontWeight: 800, fontSize: 14,
          }}>Kodu Uygula</button>
          {aktMsg && <div style={{ textAlign: "center", fontSize: 12, marginTop: 6, color: aktMsg.startsWith("✅") ? "#10b981" : "#ef4444" }}>{aktMsg}</div>}
        </div>
      )}

      {/* SORU EKLE */}
      <div style={{ margin: "0 14px 14px", background: T.bg2, borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>➕ Soru Ekle</div>
        <div style={{ fontSize: 11, color: T.text2, marginBottom: 10 }}>Kendi alanınızdan soru ekleyin, admin onayından sonra havuza katılır.</div>

        {[
          ["konu", "Konu / Ders"],
          ["soru", "Soru metni *"],
          ["a", "A şıkkı *"],
          ["b", "B şıkkı *"],
          ["c", "C şıkkı *"],
          ["d", "D şıkkı *"],
          ["e", "E şıkkı (opsiyonel)"],
        ].map(([k, l]) => (
          <div key={k}>
            <label style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>{l}</label>
            <input style={{
              width: "100%", padding: "10px 12px", background: T.bg,
              border: `1px solid ${T.border}`, borderRadius: 9, color: T.text,
              fontSize: 13, outline: "none", marginBottom: 8,
            }} value={soru[k]} onChange={e => setSoru(s => ({ ...s, [k]: e.target.value }))} />
          </div>
        ))}

        <label style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>Doğru Cevap</label>
        <select style={{
          width: "100%", padding: "10px 12px", background: T.bg,
          border: `1px solid ${T.border}`, borderRadius: 9, color: T.text,
          fontSize: 13, outline: "none", marginBottom: 10,
        }} value={soru.dogru} onChange={e => setSoru(s => ({ ...s, dogru: e.target.value }))}>
          {["a", "b", "c", "d", "e"].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
        </select>

        <button onClick={kullaniciSoruEkle} style={{
          width: "100%", padding: "12px", background: T.gradient, border: "none",
          borderRadius: 10, color: "white", fontWeight: 800, fontSize: 14,
        }}>Soruyu Gönder</button>
        {soruMsg && <div style={{ textAlign: "center", fontSize: 12, marginTop: 6, color: soruMsg.startsWith("✅") ? "#10b981" : "#ef4444" }}>{soruMsg}</div>}
      </div>

      {/* AKSIYONLAR */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px" }}>
        <button onClick={() => { localStorage.removeItem("netle_istat"); bildir("İstatistikler sıfırlandı.", "basari"); }} style={{
          padding: "12px", background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 11, color: T.text2, fontSize: 13, fontWeight: 600,
        }}>🔄 İstatistikleri Sıfırla</button>
        <button onClick={() => { localStorage.removeItem("netle_hata"); bildir("Hata kutusu temizlendi.", "basari"); }} style={{
          padding: "12px", background: "transparent", border: "1px solid #7f1d1d",
          borderRadius: 11, color: "#f87171", fontSize: 13, fontWeight: 600,
        }}>🗑️ Hata Kutusunu Temizle</button>
        <button onClick={cikisYap} style={{
          padding: "12px", background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 11, color: T.text3, fontSize: 13,
        }}>🚪 Çıkış Yap</button>
      </div>

      <BottomNav ekran="profil" setEkran={setEkran} T={T} />
    </div>
  );
}
