import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { TEMALAR } from "../themes";

const UNVANLAR = [
  "Mübaşir",
  "Zabıt Katibi",
  "Yazı İşleri Müdürü",
  "İdari İşler Müdürü",
  "Müdür Yardımcısı",
  "Şef",
  "İcra Müdürü",
  "İcra Müdür Yardımcısı",
];

export default function Giris({ T, bildir }) {
  const { girisYap, kayitOl } = useAuth();
  const [mod, setMod] = useState("giris");
  const [yukleniyor, setY] = useState(false);
  const [form, setForm] = useState({ email: "", sifre: "", ad: "", tel: "", unvan: "", sinav: "" });

  const inp = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setY(true);
    try {
      if (mod === "giris") {
        await girisYap(form.email, form.sifre);
      } else {
        if (!form.ad || !form.email || !form.sifre) {
          bildir("Ad, e-posta ve şifre zorunlu!", "hata");
          return;
        }
        await kayitOl(form.email, form.sifre, {
          ad: form.ad, tel: form.tel, unvan: form.unvan, sinav: form.unvan,
        });
        bildir("Hoş geldiniz! 🎉", "basari");
      }
    } catch (e) {
      const mesajlar = {
        "auth/invalid-email": "Geçersiz e-posta!",
        "auth/user-not-found": "Kullanıcı bulunamadı!",
        "auth/wrong-password": "Şifre hatalı!",
        "auth/invalid-credential": "E-posta veya şifre hatalı!",
        "auth/email-already-in-use": "Bu e-posta zaten kayıtlı!",
        "auth/weak-password": "Şifre en az 6 karakter olmalı!",
      };
      bildir(mesajlar[e.code] || "Hata: " + e.message, "hata");
    } finally {
      setY(false);
    }
  }

  const S = {
    wrap: { width: "100%", maxWidth: 420, padding: "48px 20px 40px", display: "flex", flexDirection: "column", gap: 14 },
    tabs: { display: "flex", background: T.bg2, borderRadius: 12, padding: 4, gap: 4 },
    tab: (aktif) => ({
      flex: 1, padding: "10px", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600,
      background: aktif ? T.accent : "transparent", color: aktif ? "white" : T.text2,
      transition: "all 0.2s",
    }),
    form: { display: "flex", flexDirection: "column", gap: 10 },
    lbl: { fontSize: 11, color: T.text2, fontWeight: 600, marginBottom: -6 },
    inp: {
      width: "100%", padding: "13px 14px", background: T.bg2,
      border: `1px solid ${T.border}`, borderRadius: 11,
      color: T.text, fontSize: 14, outline: "none",
    },
    btn: {
      padding: "14px", background: T.gradient, color: "white",
      border: "none", borderRadius: 11, fontSize: 14, fontWeight: 800,
      opacity: yukleniyor ? 0.6 : 1,
    },
  };

  return (
    <div style={S.wrap}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 52, fontWeight: 900, letterSpacing: "0.1em",
          background: T.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>NETLE</div>
        <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
          Adalet Bakanlığı Görevde Yükselme Sınavı
        </div>
      </div>

      <div style={S.tabs}>
        <button style={S.tab(mod === "giris")} onClick={() => setMod("giris")}>Giriş Yap</button>
        <button style={S.tab(mod === "kayit")} onClick={() => setMod("kayit")}>Kayıt Ol</button>
      </div>

      <div style={S.form}>
        {mod === "kayit" && (
          <>
            <label style={S.lbl}>Ad Soyad *</label>
            <input style={S.inp} placeholder="Ahmet Yılmaz" value={form.ad} onChange={inp("ad")} />
          </>
        )}

        <label style={S.lbl}>E-posta *</label>
        <input style={S.inp} type="email" placeholder="mail@ornek.com" value={form.email} onChange={inp("email")} />

        <label style={S.lbl}>Şifre *</label>
        <input style={S.inp} type="password" placeholder="••••••••" value={form.sifre} onChange={inp("sifre")}
          onKeyDown={(e) => e.key === "Enter" && submit()} />

        {mod === "kayit" && (
          <>
            <label style={S.lbl}>Telefon</label>
            <input style={S.inp} placeholder="05XX XXX XX XX" value={form.tel} onChange={inp("tel")} />

            <label style={S.lbl}>Ünvanınız *</label>
            <select style={S.inp} value={form.unvan} onChange={inp("unvan")}>
              <option value="">Ünvan seçin</option>
              {UNVANLAR.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>

            <div style={{
              background: T.bg2, borderRadius: 10, padding: "10px 14px",
              fontSize: 11, color: T.text2, lineHeight: 1.6,
            }}>
              ℹ️ Sınav soruları seçtiğiniz ünvana göre filtrelenir
            </div>
          </>
        )}

        <button style={S.btn} onClick={submit} disabled={yukleniyor}>
          {yukleniyor ? "⏳ Bekleyin…" : mod === "giris" ? "Giriş Yap" : "Kayıt Ol"}
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: T.text3, marginTop: 4 }}>
        Admin: admin@netle.app / admin123
      </div>

      {/* Tema seçici */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {Object.entries(TEMALAR).map(([k, v]) => (
          <button key={k} title={v.isim} onClick={() => localStorage.setItem("netle_tema", k)}
            style={{
              width: 24, height: 24, borderRadius: "50%",
              background: v.gradient, border: "2px solid rgba(255,255,255,0.2)",
              fontSize: 10,
            }}>
          </button>
        ))}
      </div>
    </div>
  );
}
