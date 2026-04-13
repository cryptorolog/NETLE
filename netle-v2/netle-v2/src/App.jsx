import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, rtdb } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  orderBy, limit, onSnapshot, addDoc, serverTimestamp,
  getDocs, updateDoc, deleteDoc
} from "firebase/firestore";
import {
  ref, set, onValue, push, remove, onDisconnect, serverTimestamp as rtServerTimestamp
} from "firebase/database";
import { TEMALAR } from "./themes.js";

const UNVANLAR = ["Mübaşir", "Zabıt Katibi", "Müdür", "Şef", "İdari İşler Müdürü", "Yazı İşleri Müdürü", "İcra Müdürü", "İcra Müdür Yrd.", "Diğer"];
const KONULAR = ["Anayasa Hukuku", "İdare Hukuku", "Ceza Hukuku", "Medeni Hukuk", "İş Hukuku", "657 Sayılı DMK", "Ceza Muhakemesi Hukuku", "Hukuk Muhakemeleri Usulü", "İcra ve İflas Hukuku", "Borçlar Hukuku", "Ticaret Hukuku", "Genel Kültür", "Türkçe", "Atatürk İlkeleri"];
const SINAV_TARIHI = "2025-10-15";
const DEMO_LIMIT = 10;
const ADMIN_EMAILS = ["admin@netle.app"];

const gunFarki = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000));
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const ld = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export default function App() {
  const [tema, setTema] = useState(() => ld("netle_tema", "gece"));
  const T = TEMALAR[tema] || TEMALAR.gece;

  const [user, setUser] = useState(null);
  const [profil, setProfil] = useState(null);
  const [ekran, setE] = useState("splash");
  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(true);

  // Soru çözme
  const [aktif, setAktif] = useState([]);
  const [idx, setIdx] = useState(0);
  const [secilen, setSec] = useState(null);
  const [anim, setAnim] = useState(null);
  const [mod, setMod] = useState("normal");

  // Yerel stats
  const [stats, setStats] = useState(() => ld("netle_stats", { dogru: 0, yanlis: 0, konular: {}, hataKutusu: [], cozulenIds: [], gunlukCozulen: 0, gunlukTarih: "" }));

  // Formlar
  const [gF, setGF] = useState({ mail: "", sifre: "" });
  const [kF, setKF] = useState({ ad: "", mail: "", sifre: "", tel: "", unvan: "", sinav: "" });
  const [bildiri, setB] = useState(null);

  // Admin
  const [adminTab, setAdminTab] = useState("pdf");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfB64, setPdfB64] = useState(null);
  const [pdfUnvan, setPdfUnvan] = useState([]);
  const [pdfKonu, setPdfKonu] = useState([]);
  const [pdfSinav, setPdfSinav] = useState("Adalet Bak. GYS");
  const [pdfYuk, setPdfYuk] = useState(false);
  const [pdfSonuc, setPdfSonuc] = useState(null);
  const [pdfMsg, setPdfMsg] = useState("");
  const [ekleMsg, setEkleMsg] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [tumUyeler, setTumUyeler] = useState([]);
  const [mesajHedef, setMesajHedef] = useState(null);
  const [mesajMetin, setMesajMetin] = useState("");

  // Haberler
  const [haberler, setHaberler] = useState([]);

  // Kullanıcı soru ekleme
  const [kulSoruForm, setKulSoruForm] = useState({ soru: "", a: "", b: "", c: "", d: "", e: "", dogru: "a", konu: "", sinav: "" });
  const [kulSoruMsg, setKulSoruMsg] = useState("");

  // Yarış
  const [yarisEkran, setYarisEkran] = useState("menu"); // menu | bekleme | oyun | sonuc
  const [yarisOda, setYarisOda] = useState(null);
  const [yarisOdaId, setYarisOdaId] = useState(null);
  const [yarisSorular, setYarisSorular] = useState([]);
  const [yarisIdx, setYarisIdx] = useState(0);
  const [yarisSec, setYarisSec] = useState(null);
  const [yarisPuan, setYarisPuan] = useState({});

  // Beşli masa
  const [masaEkran, setMasaEkran] = useState("menu");
  const [masaOda, setMasaOda] = useState(null);
  const [masaOdaId, setMasaOdaId] = useState(null);

  const fileRef = useRef();

  // TEMA
  useEffect(() => { sv("netle_tema", tema); }, [tema]);
  useEffect(() => { sv("netle_stats", stats); }, [stats]);

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "uyeler", u.uid));
        if (snap.exists()) {
          setProfil(snap.data());
          // Online işaretle
          const onlineRef = ref(rtdb, `online/${u.uid}`);
          set(onlineRef, { ad: snap.data().ad, unvan: snap.data().unvan, uid: u.uid, zaman: rtServerTimestamp() });
          onDisconnect(onlineRef).remove();
        }
        setE("ana");
      } else {
        setProfil(null);
        setE("giris");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // SORULAR YÜKLEv
  useEffect(() => {
    if (!user) return;
    const sinav = profil?.sinav || "";
    const q = sinav
      ? query(collection(db, "sorular"), where("sinav", "==", sinav))
      : collection(db, "sorular");
    const unsub = onSnapshot(q, (snap) => {
      setSorular(snap.docs.map((d, i) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user, profil?.sinav]);

  // ONLINE KULLANICILAR
  useEffect(() => {
    const onlineRef = ref(rtdb, "online");
    const unsub = onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      setOnlineUsers(Object.values(data));
    });
    return () => unsub();
  }, []);

  // HABERLER (RSS proxy)
  useEffect(() => {
    fetch("https://api.rss2json.com/v1/api.json?rss_url=https://www.resmigazete.gov.tr/rss/resmi.xml&count=5")
      .then(r => r.json())
      .then(d => { if (d.items) setHaberler(d.items.slice(0, 5)); })
      .catch(() => setHaberler([
        { title: "Resmi Gazete haberleri yüklenemedi", pubDate: "", link: "#" },
      ]));
  }, []);

  // Günlük sıfırla
  useEffect(() => {
    const bugun = new Date().toDateString();
    if (stats.gunlukTarih !== bugun) {
      setStats(s => ({ ...s, gunlukCozulen: 0, gunlukTarih: bugun }));
    }
  }, []);

  const bildir = (msg, t = "info") => { setB({ msg, t }); setTimeout(() => setB(null), 3200); };
  const isAdmin = () => user && (ADMIN_EMAILS.includes(user.email) || profil?.admin === true);
  const toggle = (list, setList, val) => setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);

  // KAYIT
  async function kayitOl() {
    if (!kF.ad || !kF.mail || !kF.sifre || !kF.unvan || !kF.sinav) {
      bildir("Tüm alanları doldurun!", "hata"); return;
    }
    try {
      const uc = await createUserWithEmailAndPassword(auth, kF.mail, kF.sifre);
      await setDoc(doc(db, "uyeler", uc.user.uid), {
        ad: kF.ad, mail: kF.mail, tel: kF.tel,
        unvan: kF.unvan, sinav: kF.sinav,
        premium: false, admin: false,
        tarih: new Date().toISOString(),
      });
      bildir("Hoş geldiniz! 🎉", "basari");
    } catch (e) {
      bildir(e.code === "auth/email-already-in-use" ? "Bu e-posta zaten kayıtlı!" : e.message, "hata");
    }
  }

  // GİRİŞ
  async function girisYap() {
    try {
      await signInWithEmailAndPassword(auth, gF.mail, gF.sifre);
      bildir("Hoş geldiniz! 🎉", "basari");
    } catch (e) {
      bildir("E-posta veya şifre hatalı!", "hata");
    }
  }

  // ÇIKIŞ
  async function cikis() {
    if (user) { const r = ref(rtdb, `online/${user.uid}`); remove(r); }
    await signOut(auth);
    setE("giris");
  }

  // SORU BAŞLAT
  const konuSorular = sorular.filter(s => !profil?.sinav || s.sinav === profil.sinav);
  const konular = [...new Set(konuSorular.map(s => s.konu))].filter(Boolean);

  function baslatSoru(liste, modVal) {
    if (!liste.length) { bildir("Soru bulunamadı!", "info"); return; }
    setAktif(liste); setIdx(0); setSec(null); setAnim(null); setMod(modVal); setE("soru");
  }

  function konuBaslat(k) {
    if (!profil?.premium && stats.gunlukCozulen >= DEMO_LIMIT) {
      bildir("Günlük limit doldu! Premium'a geçin.", "hata"); return;
    }
    const liste = konuSorular.filter(s => s.konu === k);
    const coz = liste.filter(s => !stats.cozulenIds.includes(s.id));
    baslatSoru(shuffle(coz.length ? coz : liste), "normal");
  }

  function hataBaslat() {
    if (!stats.hataKutusu.length) { bildir("Hata kutunuz boş!", "info"); return; }
    baslatSoru(shuffle(sorular.filter(s => stats.hataKutusu.includes(s.id))), "hata");
  }

  function rastgeleCoz() {
    if (!profil?.premium && stats.gunlukCozulen >= DEMO_LIMIT) {
      bildir("Günlük limit doldu!", "hata"); return;
    }
    baslatSoru(shuffle(konuSorular).slice(0, profil?.premium ? 50 : DEMO_LIMIT - stats.gunlukCozulen), "normal");
  }

  function cevapVer(sik) {
    if (secilen) return;
    setSec(sik);
    const soru = aktif[idx];
    const d = sik === soru.dogru;
    setTimeout(() => {
      setAnim(d ? "r" : "l");
      setStats(s => {
        const ik = { ...(s.konular[soru.konu] || { dogru: 0, yanlis: 0 }) };
        if (d) ik.dogru++; else ik.yanlis++;
        return {
          ...s,
          gunlukCozulen: s.gunlukCozulen + 1,
          cozulenIds: [...new Set([...s.cozulenIds, soru.id])],
          hataKutusu: d ? s.hataKutusu.filter(id => id !== soru.id)
            : s.hataKutusu.includes(soru.id) ? s.hataKutusu : [...s.hataKutusu, soru.id],
          dogru: s.dogru + (d ? 1 : 0),
          yanlis: s.yanlis + (d ? 0 : 1),
          konular: { ...s.konular, [soru.konu]: ik },
        };
      });
      setTimeout(() => {
        setAnim(null); setSec(null);
        if (idx + 1 < aktif.length) setIdx(i => i + 1);
        else { bildir("Tüm sorular tamamlandı! 🎉", "basari"); setE("ana"); }
      }, 370);
    }, 880);
  }

  // PDF SORU ÜRETİMİ
  function pdfSec(e) {
    const file = e.target.files[0]; if (!file) return;
    setPdfFile(file); setPdfSonuc(null); setPdfMsg("");
    const reader = new FileReader();
    reader.onload = ev => setPdfB64(ev.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  }

  async function pdfdenSoruUret() {
    if (!pdfB64) { bildir("Önce PDF yükleyin!", "hata"); return; }
    if (!pdfUnvan.length) { bildir("En az bir ünvan seçin!", "hata"); return; }
    if (!pdfKonu.length) { bildir("En az bir konu seçin!", "hata"); return; }
    setPdfYuk(true); setPdfSonuc(null); setPdfMsg("Claude yapay zeka analiz ediyor… (1-2 dk)");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8000,
          messages: [{
            role: "user", content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
              {
                type: "text", text: `Sen Adalet Bakanlığı görevde yükselme sınavı soru üreticisisin.
Sınav: ${pdfSinav} | Ünvanlar: ${pdfUnvan.join(", ")} | Konular: ${pdfKonu.join(", ")}
PDF'i baştan sona tara, hiçbir detayı atlama. Her bilgiden çoktan seçmeli soru üret. Mümkün olduğunca çok soru üret.
SADECE şu JSON formatında yanıt ver:
{"sorular":[{"sinav":"${pdfSinav}","ders":"KONU","soru":"?","a":"","b":"","c":"","d":"","e":"","dogru":"a"}]}`
              }
            ]
          }]
        })
      });
      const data = await res.json();
      const raw = (data.content || []).map(b => b.text || "").join("");
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("JSON bulunamadı");
      const parsed = JSON.parse(m[0]);
      if (!parsed.sorular?.length) throw new Error("Soru üretilemedi");
      setPdfSonuc(parsed.sorular);
      setPdfMsg("✅ " + parsed.sorular.length + " soru üretildi!");
    } catch (err) { setPdfMsg("❌ " + err.message); }
    finally { setPdfYuk(false); }
  }

  async function soruEkleFirebase(liste) {
    setEkleMsg("Firebase'e ekleniyor…");
    try {
      for (const s of liste) {
        await addDoc(collection(db, "sorular"), {
          sinav: s.sinav || pdfSinav,
          konu: s.ders || s.konu || "",
          soru: s.soru, a: s.a, b: s.b, c: s.c, d: s.d, e: s.e || "",
          dogru: s.dogru, tarih: serverTimestamp(), kaynak: "admin"
        });
      }
      setEkleMsg("✅ " + liste.length + " soru eklendi!");
      setPdfSonuc(null); setPdfFile(null); setPdfB64(null);
    } catch (e) { setEkleMsg("❌ " + e.message); }
  }

  // KULLANICI SORU EKLE
  async function kulSoruEkle() {
    if (!kulSoruForm.soru || !kulSoruForm.a || !kulSoruForm.b || !kulSoruForm.konu) {
      setKulSoruMsg("Soru, en az 2 şık ve konu zorunlu!"); return;
    }
    try {
      await addDoc(collection(db, "kullanici_sorular"), {
        ...kulSoruForm,
        ekleyen: profil?.ad || user?.email,
        unvan: profil?.unvan || "",
        sinav: profil?.sinav || "",
        tarih: serverTimestamp(),
        onay: false
      });
      setKulSoruMsg("✅ Sorunuz admin onayına gönderildi!");
      setKulSoruForm({ soru: "", a: "", b: "", c: "", d: "", e: "", dogru: "a", konu: "", sinav: "" });
    } catch (e) { setKulSoruMsg("❌ " + e.message); }
  }

  // YARIŞMA - ODA OLUŞTUR
  async function yarisOdaOlustur() {
    try {
      const odaRef = ref(rtdb, `yarislar/${Date.now()}`);
      const secilenSorular = shuffle(konuSorular).slice(0, 10);
      await set(odaRef, {
        olusturan: user.uid,
        olusturanAd: profil?.ad || "Bilinmiyor",
        oyuncular: { [user.uid]: { ad: profil?.ad, puan: 0, hazir: true } },
        durum: "bekleme",
        sorular: secilenSorular.map(s => s.id),
        soruDetay: secilenSorular,
        idx: 0,
        zaman: rtServerTimestamp()
      });
      setYarisOdaId(odaRef.key);
      setYarisEkran("bekleme");
      onValue(odaRef, snap => {
        const data = snap.val();
        if (data) setYarisOda(data);
        if (data?.durum === "oyun") {
          setYarisSorular(data.soruDetay || []);
          setYarisEkran("oyun");
        }
      });
    } catch (e) { bildir("Oda oluşturulamadı: " + e.message, "hata"); }
  }

  async function yarisOdaKatil(odaId) {
    try {
      const odaRef = ref(rtdb, `yarislar/${odaId}`);
      const oyuncuRef = ref(rtdb, `yarislar/${odaId}/oyuncular/${user.uid}`);
      await set(oyuncuRef, { ad: profil?.ad, puan: 0, hazir: true });
      setYarisOdaId(odaId);
      setYarisEkran("bekleme");
      onValue(odaRef, snap => {
        const data = snap.val();
        if (data) setYarisOda(data);
        if (data?.durum === "oyun") {
          setYarisSorular(data.soruDetay || []);
          setYarisEkran("oyun");
        }
      });
    } catch (e) { bildir("Odaya katılınamadı!", "hata"); }
  }

  async function yarisBaslat() {
    const odaRef = ref(rtdb, `yarislar/${yarisOdaId}/durum`);
    await set(odaRef, "oyun");
  }

  async function yarisCevap(sik) {
    if (yarisSec) return;
    setYarisSec(sik);
    const soru = yarisSorular[yarisIdx];
    const d = sik === soru.dogru;
    if (d) {
      const puanRef = ref(rtdb, `yarislar/${yarisOdaId}/oyuncular/${user.uid}/puan`);
      onValue(puanRef, snap => {
        set(puanRef, (snap.val() || 0) + 10);
      }, { onlyOnce: true });
    }
    setTimeout(() => {
      setYarisSec(null);
      if (yarisIdx + 1 < yarisSorular.length) setYarisIdx(i => i + 1);
      else setYarisEkran("sonuc");
    }, 1500);
  }

  // BEŞLİ MASA
  async function masaOdaOlustur() {
    try {
      const odaRef = ref(rtdb, `besliMasa/${Date.now()}`);
      const secilenSorular = shuffle(konuSorular).slice(0, 50);
      await set(odaRef, {
        olusturan: user.uid,
        oyuncular: { [user.uid]: { ad: profil?.ad, puan: 0, sira: 0 } },
        durum: "bekleme",
        sorular: secilenSorular,
        aktifSoru: 0,
        aktifOyuncu: 0,
        zaman: rtServerTimestamp()
      });
      setMasaOdaId(odaRef.key);
      setMasaEkran("bekleme");
      onValue(odaRef, snap => {
        if (snap.val()) setMasaOda(snap.val());
      });
    } catch (e) { bildir("Masa oluşturulamadı!", "hata"); }
  }

  // ADMİN - TÜM ÜYELER
  async function tumUyeleriYukle() {
    const snap = await getDocs(collection(db, "uyeler"));
    setTumUyeler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function mesajGonder() {
    if (!mesajHedef || !mesajMetin) return;
    await addDoc(collection(db, "mesajlar"), {
      gonderen: user.uid,
      gonderenAd: profil?.ad || "Admin",
      alici: mesajHedef.uid,
      aliciAd: mesajHedef.ad,
      metin: mesajMetin,
      tarih: serverTimestamp(),
      okundu: false
    });
    setMesajMetin("");
    bildir("Mesaj gönderildi!", "basari");
  }

  const toplam = (stats.dogru || 0) + (stats.yanlis || 0);
  const oran = toplam > 0 ? Math.round((stats.dogru / toplam) * 100) : 0;
  const gun = gunFarki(SINAV_TARIHI);
  const soruObj = aktif[idx];

  // ─── CSS ─────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: 'Inter', -apple-system, sans-serif; }
    body { background: ${T.bg}; color: ${T.text}; }
    button:active { transform: scale(0.96); }
    input, select, textarea { background: ${T.bg3} !important; color: ${T.text} !important; border: 1px solid ${T.kenar} !important; border-radius: 10px; padding: 12px 14px; font-size: 14px; outline: none; width: 100%; }
    select option { background: ${T.bg2}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: ${T.bg}; }
    ::-webkit-scrollbar-thumb { background: ${T.kenar}; border-radius: 2px; }
    .kK { animation: fadeUp 0.4s ease forwards; opacity: 0; }
    .sK { animation: slideIn 0.3s ease forwards; }
  `;

  // ─── STYLES ──────────────────────────────────────────────────
  const S = {
    root: { minHeight: "100vh", background: T.bg, color: T.text, display: "flex", flexDirection: "column", alignItems: "center" },
    toast: { position: "fixed", top: "max(16px,env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", padding: "11px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,.4)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" },
    center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh", padding: 24, textAlign: "center" },
    logo: { fontSize: 60, fontWeight: 900, letterSpacing: "0.1em", background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    sub: { fontSize: 13, color: T.text3, letterSpacing: "0.05em" },
    spin: { width: 32, height: 32, border: `3px solid ${T.kenar}`, borderTop: `3px solid ${T.primary}`, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "16px 0" },
    page: { width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: "calc(80px + env(safe-area-inset-bottom))" },
    hdr: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 16px 12px" },
    hdrLogo: { fontSize: 24, fontWeight: 900, letterSpacing: "0.1em", background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    hdrSub: { fontSize: 10, color: T.text3, marginTop: 2 },
    btnP: { padding: "14px", background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", boxShadow: `0 4px 16px ${T.primary}40` },
    btnS: { padding: "12px", background: "transparent", color: T.text2, border: `1px solid ${T.kenar}`, borderRadius: 12, fontSize: 13, cursor: "pointer", width: "100%", fontWeight: 600 },
    btnSm: { padding: "8px 16px", background: T.bg3, color: T.text2, border: `1px solid ${T.kenar}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600 },
    kart: { background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 16, padding: "16px" },
    // Sayaç
    sayac: { margin: "0 14px 12px", background: `linear-gradient(135deg, ${T.primary}20, ${T.bg3})`, border: `1px solid ${T.primary}40`, borderRadius: 20, padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    sayacN: { fontSize: 48, fontWeight: 900, color: T.primary, lineHeight: 1 },
    sayacL: { fontSize: 11, color: T.text3, marginTop: 4 },
    sayacD: { fontSize: 10, color: T.text3, marginTop: 2 },
    sayacE: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 22 },
    // Stat
    statRow: { display: "flex", gap: 8, margin: "0 14px 12px" },
    statK: { flex: 1, background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 14, padding: "12px 8px", textAlign: "center" },
    statV: { fontSize: 22, fontWeight: 800, margin: "3px 0" },
    statL: { fontSize: 10, color: T.text3 },
    // Limit
    limitW: { margin: "0 14px 12px", background: T.kart, borderRadius: 12, padding: "12px 16px" },
    // Butonlar
    hataBtn: { margin: "0 14px 8px", background: `linear-gradient(135deg, ${T.error}20, ${T.bg3})`, border: `1px solid ${T.error}40`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", width: "calc(100% - 28px)", textAlign: "left" },
    rndBtn: { margin: "0 14px 14px", padding: "13px", background: `linear-gradient(135deg, ${T.primary}30, ${T.bg3})`, border: `1px solid ${T.primary}40`, borderRadius: 14, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "calc(100% - 28px)" },
    // Konu kartları
    kGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 14px" },
    kK: { background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 14, padding: "14px 12px", textAlign: "left", cursor: "pointer", position: "relative" },
    // Bottom nav
    bnav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: T.bg2, borderTop: `1px solid ${T.kenar}`, display: "flex", justifyContent: "space-around", padding: "8px 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 100 },
    nBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: T.text3, fontSize: 18, cursor: "pointer", fontSize: 10, padding: "4px 8px" },
    // Soru
    soruPage: { width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 14px 20px" },
    soruHdr: { display: "flex", alignItems: "center", gap: 10, padding: "14px 0 12px" },
    back: { background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 10, padding: "8px 14px", color: T.text, fontSize: 18, cursor: "pointer" },
    kartSoru: { background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 22, padding: "24px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 16, transition: "transform 0.3s ease, opacity 0.3s ease" },
    // Auth
    authWrap: { width: "100%", maxWidth: 420, padding: "48px 22px 40px", display: "flex", flexDirection: "column", gap: 14 },
    form: { display: "flex", flexDirection: "column", gap: 10 },
    lbl: { fontSize: 11, color: T.text3, fontWeight: 600, marginBottom: -6 },
    // Profil
    profK: { margin: "0 14px 14px", background: T.kart, borderRadius: 20, padding: "24px", textAlign: "center" },
    profAv: { width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#fff" },
    // Admin
    adminBody: { width: "100%", maxWidth: 480, padding: "0 14px 80px", display: "flex", flexDirection: "column", gap: 10 },
    tabRow: { display: "flex", gap: 4, padding: "8px 14px", overflowX: "auto", width: "100%", maxWidth: 480 },
    tab: { padding: "8px 14px", background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 10, color: T.text3, fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
    tabAkt: { background: `${T.primary}20`, border: `1px solid ${T.primary}`, color: T.primary },
    card: { background: T.kart, border: `1px solid ${T.kenar}`, borderRadius: 16, padding: "16px" },
    cardT: { fontSize: 14, fontWeight: 800, marginBottom: 8 },
    upload: { border: `2px dashed ${T.kenar}`, borderRadius: 14, padding: "28px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 },
    chkGrid: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
    chk: { padding: "6px 12px", background: T.bg3, border: `1px solid ${T.kenar}`, borderRadius: 8, fontSize: 11, cursor: "pointer", userSelect: "none" },
    chkOn: { background: `${T.primary}20`, border: `1px solid ${T.primary}`, color: T.primary },
    // Yarış
    yarisPage: { width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "14px" },
    // Online
    onlineBtn: { width: 10, height: 10, borderRadius: "50%", background: T.success, display: "inline-block", marginRight: 6 },
    // Tema
    temaRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
    temaBtn: (t) => ({ width: 44, height: 44, borderRadius: "50%", cursor: "pointer", border: tema === t ? `3px solid ${T.primary}` : `2px solid ${TEMALAR[t].kenar}`, background: TEMALAR[t].primary, transition: "all .2s" }),
    // Haber
    haberItem: { padding: "10px 0", borderBottom: `1px solid ${T.kenar}`, cursor: "pointer" },
  };

  if (loading) {
    return (
      <div style={S.root}>
        <style>{css}</style>
        <div style={S.center}>
          <div style={S.logo}>NETLE</div>
          <div style={S.sub}>⚖️ Adalet Bakanlığı · Görevde Yükselme</div>
          <div style={S.spin} />
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{css}</style>

      {bildiri && (
        <div style={{ ...S.toast, background: bildiri.t === "hata" ? T.error : bildiri.t === "basari" ? T.success : T.primary }}>
          {bildiri.msg}
        </div>
      )}

      {/* ══════════ GİRİŞ ══════════ */}
      {ekran === "giris" && (
        <div style={S.authWrap}>
          <div style={S.logo}>NETLE</div>
          <div style={S.sub}>Adalet Bakanlığı Görevde Yükselme Sınavı</div>
          <div style={S.form}>
            <label style={S.lbl}>E-posta</label>
            <input type="email" placeholder="mail@ornek.com" value={gF.mail} onChange={e => setGF(f => ({ ...f, mail: e.target.value }))} />
            <label style={S.lbl}>Şifre</label>
            <input type="password" placeholder="••••••••" value={gF.sifre} onChange={e => setGF(f => ({ ...f, sifre: e.target.value }))} onKeyDown={e => e.key === "Enter" && girisYap()} />
            <button style={S.btnP} onClick={girisYap}>Giriş Yap</button>
            <button style={S.btnS} onClick={() => setE("kayit")}>Yeni Hesap Oluştur</button>
          </div>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={S.temaRow}>
              {Object.keys(TEMALAR).map(t => <button key={t} style={S.temaBtn(t)} onClick={() => setTema(t)} title={TEMALAR[t].ad} />)}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ KAYIT ══════════ */}
      {ekran === "kayit" && (
        <div style={S.authWrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <button style={S.back} onClick={() => setE("giris")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Hesap Oluştur</h2>
          </div>
          <div style={S.form}>
            <label style={S.lbl}>Ad Soyad *</label>
            <input type="text" value={kF.ad} onChange={e => setKF(f => ({ ...f, ad: e.target.value }))} />
            <label style={S.lbl}>E-posta *</label>
            <input type="email" value={kF.mail} onChange={e => setKF(f => ({ ...f, mail: e.target.value }))} />
            <label style={S.lbl}>Şifre *</label>
            <input type="password" value={kF.sifre} onChange={e => setKF(f => ({ ...f, sifre: e.target.value }))} />
            <label style={S.lbl}>Telefon</label>
            <input type="tel" value={kF.tel} onChange={e => setKF(f => ({ ...f, tel: e.target.value }))} />
            <label style={S.lbl}>Ünvan *</label>
            <select value={kF.unvan} onChange={e => setKF(f => ({ ...f, unvan: e.target.value }))}>
              <option value="">Seçiniz</option>
              {UNVANLAR.map(u => <option key={u}>{u}</option>)}
            </select>
            <label style={S.lbl}>Sınav Türü *</label>
            <select value={kF.sinav} onChange={e => setKF(f => ({ ...f, sinav: e.target.value }))}>
              <option value="">Seçiniz</option>
              {UNVANLAR.map(u => <option key={u}>{u}</option>)}
            </select>
            <button style={S.btnP} onClick={kayitOl}>Kayıt Ol</button>
          </div>
        </div>
      )}

      {/* ══════════ ANA EKRAN ══════════ */}
      {ekran === "ana" && (
        <div style={S.page}>
          <div style={S.hdr}>
            <div>
              <div style={S.hdrLogo}>NETLE</div>
              <div style={S.hdrSub}>{profil?.sinav || "Adalet Bakanlığı GYS"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isAdmin() && <button style={{ ...S.btnSm, color: "#a78bfa", borderColor: "#7c3aed" }} onClick={() => setE("admin")}>⚙️ Admin</button>}
              {profil?.premium && <span style={{ fontSize: 10, background: `linear-gradient(135deg,${T.warning},${T.accent})`, color: "#000", padding: "3px 10px", borderRadius: 100, fontWeight: 800 }}>⭐ PRO</span>}
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => setE("profil")}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${T.primary},${T.primaryLight})`, color: "#fff", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(profil?.ad || "?")[0].toUpperCase()}
                </div>
              </button>
            </div>
          </div>

          {/* Sayaç */}
          <div style={S.sayac}>
            <div>
              <div style={S.sayacN}>{gun}</div>
              <div style={S.sayacL}>Sınava kalan gün</div>
              <div style={S.sayacD}>15 Ekim 2025</div>
            </div>
            <div style={{ position: "relative", width: 68, height: 68 }}>
              <svg viewBox="0 0 68 68" width="68" height="68">
                <circle cx="34" cy="34" r="28" fill="none" stroke={T.kenar} strokeWidth="6" />
                <circle cx="34" cy="34" r="28" fill="none" stroke={T.primary} strokeWidth="6"
                  strokeDasharray={`${Math.min(gun / 400, 1) * 175.9} 175.9`} strokeLinecap="round" transform="rotate(-90 34 34)" />
              </svg>
              <div style={S.sayacE}>⚖️</div>
            </div>
          </div>

          {/* İstatistik */}
          <div style={S.statRow}>
            {[["✅", stats.dogru || 0, "Doğru"], ["❌", stats.yanlis || 0, "Yanlış"], ["📊", "%" + oran, "Başarı"]].map(([ic, v, l]) => (
              <div key={l} style={S.statK}>
                <div style={{ fontSize: 20 }}>{ic}</div>
                <div style={S.statV}>{v}</div>
                <div style={S.statL}>{l}</div>
              </div>
            ))}
          </div>

          {/* Limit */}
          {!profil?.premium && (
            <div style={S.limitW}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>📅 Günlük: {stats.gunlukCozulen} / {DEMO_LIMIT}</div>
              <div style={{ height: 5, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", background: T.primary, borderRadius: 100, width: (stats.gunlukCozulen / DEMO_LIMIT * 100) + "%", transition: "width .3s" }} />
              </div>
            </div>
          )}

          {/* Aksiyon butonları */}
          <button style={S.hataBtn} onClick={hataBaslat}>
            <span style={{ fontSize: 26 }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Hata Kutusu</div>
              <div style={{ fontSize: 11, color: T.error, marginTop: 2 }}>{stats.hataKutusu.length} soru bekliyor</div>
            </div>
            {stats.hataKutusu.length > 0 && <div style={{ background: T.error, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{stats.hataKutusu.length}</div>}
            <span style={{ color: T.text3 }}>›</span>
          </button>

          <button style={S.rndBtn} onClick={rastgeleCoz}>🎲 Rastgele Soru Çöz</button>

          {/* Yarış & Masa butonları */}
          <div style={{ display: "flex", gap: 8, padding: "0 14px 14px" }}>
            <button style={{ ...S.btnS, flex: 1, background: `${T.primary}15`, borderColor: T.primary, color: T.primary }} onClick={() => setE("yaris")}>⚡ Online Yarış</button>
            <button style={{ ...S.btnS, flex: 1, background: `${T.accent}15`, borderColor: T.accent, color: T.accent }} onClick={() => setE("masa")}>🎯 Beşli Masa</button>
          </div>

          {/* Haberler */}
          {haberler.length > 0 && (
            <div style={{ margin: "0 14px 14px", ...S.card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, marginBottom: 8 }}>📰 Son Haberler</div>
              {haberler.map((h, i) => (
                <div key={i} style={S.haberItem} onClick={() => window.open(h.link, "_blank")}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{h.title}</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{new Date(h.pubDate).toLocaleDateString("tr-TR")}</div>
                </div>
              ))}
            </div>
          )}

          {/* Online kullanıcılar */}
          <div style={{ margin: "0 14px 14px", ...S.card }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, marginBottom: 8 }}>
              <span style={S.onlineBtn} />
              {onlineUsers.length} Kullanıcı Online
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {onlineUsers.slice(0, 8).map((u, i) => (
                <div key={i} style={{ fontSize: 11, background: T.bg3, padding: "4px 10px", borderRadius: 100, color: T.text2 }}>
                  {u.ad || "Kullanıcı"}
                </div>
              ))}
              {onlineUsers.length > 8 && <div style={{ fontSize: 11, color: T.text3 }}>+{onlineUsers.length - 8} daha</div>}
            </div>
          </div>

          {/* Konular */}
          <div style={{ padding: "0 14px 8px", fontSize: 11, fontWeight: 700, color: T.text3, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Konu Bazlı Çalış · {konuSorular.length} soru
          </div>

          {!loading && sorular.length === 0 && (
            <div style={{ margin: "0 14px", background: T.kart, borderRadius: 14, padding: "28px", textAlign: "center", color: T.text3, fontSize: 13 }}>
              <div style={{ fontSize: 28 }}>📭</div>
              <div style={{ marginTop: 8 }}>Henüz soru eklenmemiş</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Admin panelinden PDF yükleyerek soru ekleyin</div>
            </div>
          )}

          <div style={S.kGrid}>
            {konular.map((k, i) => {
              const ks = stats.konular[k];
              const kt = ks ? ks.dogru + ks.yanlis : 0;
              const ko = ks && kt > 0 ? Math.round((ks.dogru / kt) * 100) : null;
              return (
                <button key={k} className="kK" style={{ ...S.kK, animationDelay: i * 40 + "ms" }} onClick={() => konuBaslat(k)}>
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 10, color: T.text3 }}>{konuSorular.filter(s => s.konu === k).length} soru</div>
                  {ko !== null && <div style={{ position: "absolute", top: 10, right: 10, fontSize: 11, fontWeight: 800, color: ko >= 70 ? T.success : ko >= 40 ? T.warning : T.error }}>%{ko}</div>}
                </button>
              );
            })}
          </div>

          {/* Soru Ekle */}
          <div style={{ margin: "14px 14px 0", ...S.card }}>
            <div style={{ ...S.cardT }}>✏️ Soru Öner</div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 10 }}>Kendi alanınızdan soru önerin, admin onayından sonra yayınlanır.</div>
            <button style={S.btnP} onClick={() => setE("soruekle")}>+ Soru Ekle</button>
          </div>

          {/* Acil Yardım */}
          <button style={{ margin: "12px 14px 0", padding: "14px", background: `linear-gradient(135deg, ${T.error}, #c0392b)`, color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, cursor: "pointer", fontSize: 14, width: "calc(100% - 28px)" }}
            onClick={() => { if (confirm("Acil yardım hattı aranacak: 182")) window.location.href = "tel:182"; }}>
            🚨 ACİL YARDIM — 182
          </button>

          <BNav setE={setE} T={T} />
        </div>
      )}

      {/* ══════════ SORU EKRANI ══════════ */}
      {ekran === "soru" && soruObj && (
        <div style={S.soruPage}>
          <div style={S.soruHdr}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.text3, fontWeight: 600, marginBottom: 4 }}>{idx + 1} / {aktif.length}</div>
              <div style={{ height: 3, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", background: T.primary, borderRadius: 100, width: ((idx + 1) / aktif.length * 100) + "%", transition: "width .3s" }} />
              </div>
            </div>
            {mod === "hata" && <span style={{ fontSize: 11, color: T.error, fontWeight: 700 }}>📦 Hata</span>}
          </div>

          <div style={{
            ...S.kartSoru,
            ...(anim === "r" ? { transform: "translateX(115%) rotate(7deg)", opacity: 0 } : {}),
            ...(anim === "l" ? { transform: "translateX(-115%) rotate(-7deg)", opacity: 0 } : {}),
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.primary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {soruObj.sinav && <span style={{ color: T.text3 }}>{soruObj.sinav} · </span>}
              {soruObj.konu}
            </div>
            {soruObj.gorsel && <img src={soruObj.gorsel} style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "contain" }} alt="Soru görseli" />}
            <div style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 500, color: T.text }}>{soruObj.soru}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["a", "b", "c", "d", "e"].filter(s => soruObj[s]).map(sik => {
                let bg = T.bg3, border = T.kenar, color = T.text, opacity = 1;
                if (secilen) {
                  if (sik === soruObj.dogru) { bg = T.success + "20"; border = T.success; color = T.success; }
                  else if (sik === secilen) { bg = T.error + "20"; border = T.error; color = T.error; }
                  else opacity = 0.35;
                }
                return (
                  <button key={sik} onClick={() => cevapVer(sik)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: bg, border: `1px solid ${border}`, borderRadius: 12, color, cursor: "pointer", textAlign: "left", opacity, transition: "all .15s" }}>
                    <span style={{ background: T.kenar, borderRadius: 7, padding: "2px 8px", fontWeight: 800, fontSize: 10, color: T.primary, minWidth: 26, textAlign: "center", marginTop: 2 }}>{sik.toUpperCase()}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.45 }}>{soruObj[sik]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {!secilen && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", fontSize: 12 }}>
              <span style={{ color: T.error }}>← Yanlış</span>
              <span style={{ color: T.text3, fontSize: 11 }}>şık seç</span>
              <span style={{ color: T.success }}>Doğru →</span>
            </div>
          )}
          {secilen && (
            <div style={{ margin: "10px 0", borderRadius: 14, padding: "13px 18px", fontSize: 13, fontWeight: 700, textAlign: "center", background: secilen === soruObj.dogru ? T.success + "20" : T.error + "20", border: `1px solid ${secilen === soruObj.dogru ? T.success : T.error}`, color: secilen === soruObj.dogru ? T.success : T.error }}>
              {secilen === soruObj.dogru ? "✅ Doğru Bildiniz!" : "❌ Doğru: " + soruObj.dogru.toUpperCase() + ") " + soruObj[soruObj.dogru]}
            </div>
          )}
        </div>
      )}

      {/* ══════════ İSTATİSTİK ══════════ */}
      {ekran === "istat" && (
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 12px" }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>📊 İstatistikler</h2>
          </div>
          <div style={{ margin: "0 14px 18px", ...S.card, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" width="110" height="110">
                <circle cx="50" cy="50" r="40" fill="none" stroke={T.kenar} strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={T.success} strokeWidth="12"
                  strokeDasharray={oran * 2.51 + " 251"} strokeLinecap="round" transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, fontWeight: 900, color: T.success }}>%{oran}</div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Genel Başarı</div>
              <div style={{ fontSize: 13, color: T.text2 }}>{toplam} soru çözüldü</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>✅ {stats.dogru || 0} · ❌ {stats.yanlis || 0}</div>
            </div>
          </div>
          <div style={{ padding: "0 14px 8px", fontSize: 11, fontWeight: 700, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Konulara Göre</div>
          {konular.map(k => {
            const ks = stats.konular[k]; const kt = ks ? ks.dogru + ks.yanlis : 0;
            const ko = ks && kt > 0 ? Math.round((ks.dogru / kt) * 100) : 0;
            const col = ko >= 70 ? T.success : ko >= 40 ? T.warning : ko > 0 ? T.error : T.kenar;
            return (
              <div key={k} style={{ margin: "0 14px 8px", ...S.card }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>%{ko}</span>
                </div>
                <div style={{ height: 5, background: T.bg3, borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: col, borderRadius: 100, width: ko + "%", transition: "width .6s" }} />
                </div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{ks ? ks.dogru + " D · " + ks.yanlis + " Y" : "Henüz çözülmedi"}</div>
              </div>
            );
          })}
          <BNav setE={setE} T={T} />
        </div>
      )}

      {/* ══════════ PROFİL ══════════ */}
      {ekran === "profil" && (
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 12px" }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>👤 Profil</h2>
          </div>
          <div style={S.profK}>
            <div style={S.profAv}>{(profil?.ad || "?")[0].toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{profil?.ad}</div>
            {profil?.unvan && <div style={{ fontSize: 13, color: T.primary, marginBottom: 4 }}>{profil.unvan}</div>}
            <div style={{ fontSize: 12, color: T.text3, marginBottom: 8 }}>{user?.email}</div>
            {profil?.sinav && <div style={{ fontSize: 11, color: T.text2, marginBottom: 10 }}>📝 {profil.sinav}</div>}
            {isAdmin() && <div style={{ fontSize: 10, background: "#4c1d95", color: "#c4b5fd", padding: "3px 12px", borderRadius: 100, display: "inline-block", marginBottom: 8, fontWeight: 700 }}>🔐 Admin</div>}
            {profil?.premium ? <div style={{ display: "inline-block", background: `linear-gradient(135deg,${T.warning},${T.accent})`, color: "#000", padding: "4px 14px", borderRadius: 100, fontWeight: 800, fontSize: 11 }}>⭐ Premium — Sınırsız</div>
              : <div style={{ display: "inline-block", background: T.bg3, color: T.text3, padding: "4px 14px", borderRadius: 100, fontSize: 11 }}>🔒 Ücretsiz · {DEMO_LIMIT} soru/gün</div>}
          </div>

          {/* Tema seçici */}
          <div style={{ margin: "0 14px 14px", ...S.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎨 Tema Seç</div>
            <div style={S.temaRow}>
              {Object.entries(TEMALAR).map(([k, v]) => (
                <button key={k} style={S.temaBtn(k)} onClick={() => setTema(k)} title={v.ad} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>Aktif: {TEMALAR[tema].ad}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px" }}>
            <button style={S.btnS} onClick={() => { setStats(s => ({ ...s, dogru: 0, yanlis: 0, konular: {}, cozulenIds: [] })); bildir("Sıfırlandı.", "basari"); }}>🔄 İstatistikleri Sıfırla</button>
            <button style={{ ...S.btnS, color: T.error, borderColor: T.error + "60" }} onClick={() => { setStats(s => ({ ...s, hataKutusu: [] })); bildir("Temizlendi.", "basari"); }}>🗑️ Hata Kutusunu Temizle</button>
            <button style={{ ...S.btnS, color: T.text3 }} onClick={cikis}>🚪 Çıkış Yap</button>
          </div>
          <BNav setE={setE} T={T} />
        </div>
      )}

      {/* ══════════ SORU ÖNER ══════════ */}
      {ekran === "soruekle" && (
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 12px" }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>✏️ Soru Öner</h2>
          </div>
          <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...S.card, fontSize: 12, color: T.text3 }}>
              📌 Önerdiğiniz sorular admin onayından sonra <b style={{ color: T.primary }}>Kullanıcı Soruları</b> bölümünde yayınlanır.
            </div>
            <label style={S.lbl}>Konu</label>
            <select value={kulSoruForm.konu} onChange={e => setKulSoruForm(f => ({ ...f, konu: e.target.value }))}>
              <option value="">Seçiniz</option>
              {KONULAR.map(k => <option key={k}>{k}</option>)}
            </select>
            <label style={S.lbl}>Soru Metni *</label>
            <textarea rows={3} style={{ resize: "vertical" }} value={kulSoruForm.soru} onChange={e => setKulSoruForm(f => ({ ...f, soru: e.target.value }))} />
            {["a", "b", "c", "d", "e"].map(s => (
              <div key={s}>
                <label style={S.lbl}>{s.toUpperCase()} Şıkkı{s === "a" || s === "b" ? " *" : ""}</label>
                <input value={kulSoruForm[s]} onChange={e => setKulSoruForm(f => ({ ...f, [s]: e.target.value }))} />
              </div>
            ))}
            <label style={S.lbl}>Doğru Cevap</label>
            <select value={kulSoruForm.dogru} onChange={e => setKulSoruForm(f => ({ ...f, dogru: e.target.value }))}>
              {["a", "b", "c", "d", "e"].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
            <button style={S.btnP} onClick={kulSoruEkle}>Öneriyi Gönder</button>
            {kulSoruMsg && <div style={{ fontSize: 12, color: kulSoruMsg.startsWith("✅") ? T.success : T.error, textAlign: "center" }}>{kulSoruMsg}</div>}
          </div>
        </div>
      )}

      {/* ══════════ ONLINE YARIŞ ══════════ */}
      {ekran === "yaris" && (
        <div style={S.yarisPage}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>⚡ Online Yarış</h2>
          </div>

          {yarisEkran === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Yeni Oda Aç</div>
                <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>10 soruluk yarış odası oluştur, arkadaşlarını davet et.</div>
                <button style={S.btnP} onClick={yarisOdaOlustur}>🏁 Oda Oluştur</button>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Odaya Katıl</div>
                <input placeholder="Oda ID girin" id="odaIdInput" />
                <button style={{ ...S.btnS, marginTop: 8 }} onClick={() => {
                  const id = document.getElementById("odaIdInput").value;
                  if (id) yarisOdaKatil(id);
                }}>Katıl</button>
              </div>
            </div>
          )}

          {yarisEkran === "bekleme" && yarisOda && (
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>⏳ Oyuncular Bekleniyor</div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 12 }}>Oda ID: <b style={{ color: T.primary }}>{yarisOdaId}</b></div>
              {Object.values(yarisOda.oyuncular || {}).map((o, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.kenar}` }}>
                  <span style={S.onlineBtn} />
                  <span style={{ fontSize: 13 }}>{o.ad}</span>
                </div>
              ))}
              {yarisOda.olusturan === user?.uid && (
                <button style={{ ...S.btnP, marginTop: 12 }} onClick={yarisBaslat}>🚀 Yarışı Başlat</button>
              )}
            </div>
          )}

          {yarisEkran === "oyun" && yarisSorular[yarisIdx] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text3 }}>{yarisIdx + 1} / {yarisSorular.length}</span>
                <span style={{ fontSize: 11, color: T.primary }}>⚡ Yarış Modu</span>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 10, color: T.text3, marginBottom: 8, textTransform: "uppercase" }}>{yarisSorular[yarisIdx].konu}</div>
                <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 14 }}>{yarisSorular[yarisIdx].soru}</div>
                {["a", "b", "c", "d", "e"].filter(s => yarisSorular[yarisIdx][s]).map(sik => (
                  <button key={sik} onClick={() => yarisCevap(sik)} style={{ display: "flex", gap: 10, padding: "11px 14px", background: yarisSec === sik ? (sik === yarisSorular[yarisIdx].dogru ? T.success + "30" : T.error + "30") : T.bg3, border: `1px solid ${yarisSec === sik ? (sik === yarisSorular[yarisIdx].dogru ? T.success : T.error) : T.kenar}`, borderRadius: 11, color: T.text, cursor: "pointer", textAlign: "left", marginBottom: 7, width: "100%" }}>
                    <span style={{ background: T.kenar, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, color: T.primary, minWidth: 24, textAlign: "center" }}>{sik.toUpperCase()}</span>
                    <span style={{ fontSize: 13 }}>{yarisSorular[yarisIdx][sik]}</span>
                  </button>
                ))}
              </div>
              {yarisOda && (
                <div style={S.card}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🏆 Puan Tablosu</div>
                  {Object.values(yarisOda.oyuncular || {}).sort((a, b) => b.puan - a.puan).map((o, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                      <span>{i + 1}. {o.ad}</span>
                      <span style={{ fontWeight: 700, color: T.primary }}>{o.puan} puan</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {yarisEkran === "sonuc" && yarisOda && (
            <div style={S.card}>
              <div style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 16 }}>🏆 Yarış Bitti!</div>
              {Object.values(yarisOda.oyuncular || {}).sort((a, b) => b.puan - a.puan).map((o, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.kenar}`, fontSize: 14 }}>
                  <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {o.ad}</span>
                  <span style={{ fontWeight: 800, color: T.primary }}>{o.puan} puan</span>
                </div>
              ))}
              <button style={{ ...S.btnP, marginTop: 16 }} onClick={() => { setYarisEkran("menu"); setYarisOda(null); setYarisOdaId(null); setYarisIdx(0); }}>
                Tekrar Oyna
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════ BEŞLİ MASA ══════════ */}
      {ekran === "masa" && (
        <div style={S.yarisPage}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>🎯 Beşli Masa</h2>
          </div>

          {masaEkran === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...S.card, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Beşli Masa Nedir?</div>
                <div style={{ fontSize: 12, color: T.text3, lineHeight: 1.6, marginBottom: 14 }}>
                  5 oyuncu masaya oturur. Ortadan sırayla kart çekilir, herkes sırasıyla soruyu cevaplar.
                  10 soru × 5 oyuncu = 50 soruluk turnuva. En yüksek puan kazanır!
                </div>
                <button style={S.btnP} onClick={masaOdaOlustur}>🃏 Masa Kur</button>
              </div>

              {masaEkran === "bekleme" && masaOda && (
                <div style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>⏳ Oyuncular Bekleniyor (Max 5)</div>
                  <div style={{ fontSize: 11, color: T.text3, marginBottom: 12 }}>Masa ID: <b style={{ color: T.primary }}>{masaOdaId}</b></div>
                  {Object.values(masaOda.oyuncular || {}).map((o, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                      <span style={{ background: T.primary, color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                      <span>{o.ad}</span>
                    </div>
                  ))}
                  {Object.keys(masaOda.oyuncular || {}).length < 5 && (
                    <div style={{ fontSize: 11, color: T.text3, textAlign: "center", marginTop: 8 }}>
                      {5 - Object.keys(masaOda.oyuncular || {}).length} oyuncu daha bekleniyor…
                    </div>
                  )}
                  {masaOda.olusturan === user?.uid && (
                    <button style={{ ...S.btnP, marginTop: 12 }} onClick={async () => {
                      const r = ref(rtdb, `besliMasa/${masaOdaId}/durum`);
                      await set(r, "oyun");
                      setMasaEkran("oyun");
                    }}>🚀 Masayı Başlat</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ADMİN PANELİ ══════════ */}
      {ekran === "admin" && (
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 8px" }}>
            <button style={S.back} onClick={() => setE("ana")}>←</button>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#a78bfa" }}>🔐 Admin Paneli</h2>
            <div style={{ fontSize: 11, color: T.text3, marginLeft: "auto" }}>{sorular.length} soru · {onlineUsers.length} online</div>
          </div>

          <div style={S.tabRow}>
            {[["pdf", "📄 PDF→Soru"], ["kulsoruler", "✏️ Kullanıcı Soruları"], ["uyeler", "👥 Üyeler"], ["mesaj", "💬 Mesaj"]].map(([t, l]) => (
              <button key={t} style={{ ...S.tab, ...(adminTab === t ? S.tabAkt : {}) }} onClick={() => { setAdminTab(t); if (t === "uyeler") tumUyeleriYukle(); }}>
                {l}
              </button>
            ))}
          </div>

          {/* PDF → SORU */}
          {adminTab === "pdf" && (
            <div style={S.adminBody}>
              <div style={S.card}>
                <div style={S.cardT}>📄 PDF'den Yapay Zeka ile Soru Üret</div>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10, lineHeight: 1.6 }}>PDF yükle → ünvan ve konu seç → Claude analiz eder → Firebase'e ekle</div>

                <div style={{ ...S.upload, ...(pdfFile ? { borderColor: T.primary } : {}) }} onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none", width: "auto" }} onChange={pdfSec} />
                  {pdfFile ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 6 }}>📄</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{pdfFile.name}</div>
                      <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: T.text3 }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>☁️</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>PDF Yükle</div>
                      <div style={{ fontSize: 11, marginTop: 3 }}>Kanun, yönetmelik, ders notu…</div>
                    </div>
                  )}
                </div>

                <label style={{ ...S.lbl, marginTop: 8 }}>Sınav Adı</label>
                <input value={pdfSinav} onChange={e => setPdfSinav(e.target.value)} />

                <label style={{ ...S.lbl, marginTop: 10 }}>Hedef Ünvanlar <span style={{ color: T.text3, fontWeight: 400 }}>(çoklu)</span></label>
                <div style={S.chkGrid}>
                  {UNVANLAR.map(u => (
                    <label key={u} style={{ ...S.chk, ...(pdfUnvan.includes(u) ? S.chkOn : {}) }}>
                      <input type="checkbox" style={{ display: "none" }} checked={pdfUnvan.includes(u)} onChange={() => toggle(pdfUnvan, setPdfUnvan, u)} />
                      {pdfUnvan.includes(u) ? "✓ " : ""}{u}
                    </label>
                  ))}
                </div>

                <label style={{ ...S.lbl, marginTop: 10 }}>Konu Kategorileri <span style={{ color: T.text3, fontWeight: 400 }}>(çoklu)</span></label>
                <div style={S.chkGrid}>
                  {KONULAR.map(k => (
                    <label key={k} style={{ ...S.chk, ...(pdfKonu.includes(k) ? S.chkOn : {}) }}>
                      <input type="checkbox" style={{ display: "none" }} checked={pdfKonu.includes(k)} onChange={() => toggle(pdfKonu, setPdfKonu, k)} />
                      {pdfKonu.includes(k) ? "✓ " : ""}{k}
                    </label>
                  ))}
                </div>

                <button style={{ ...S.btnP, marginTop: 14, opacity: pdfYuk ? 0.55 : 1 }} onClick={pdfdenSoruUret} disabled={pdfYuk}>
                  {pdfYuk ? "⏳ Analiz ediliyor… (1-2 dk)" : "🤖 Yapay Zeka ile Soru Üret"}
                </button>
                {pdfMsg && <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5, color: pdfMsg.startsWith("✅") ? T.success : pdfMsg.startsWith("❌") ? T.error : T.text3 }}>{pdfMsg}</div>}
              </div>

              {pdfSonuc?.length > 0 && (
                <div style={S.card}>
                  <div style={S.cardT}>✅ {pdfSonuc.length} Soru — Önizleme</div>
                  <div style={{ maxHeight: 380, overflowY: "auto", marginBottom: 12 }}>
                    {pdfSonuc.map((s, i) => (
                      <div key={i} style={{ background: T.bg3, borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `3px solid ${T.primary}` }}>
                        <div style={{ fontSize: 9, color: T.primary, fontWeight: 700, marginBottom: 3, textTransform: "uppercase" }}>{s.ders}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{i + 1}. {s.soru}</div>
                        {["a", "b", "c", "d", "e"].filter(k => s[k]).map(k => (
                          <div key={k} style={{ fontSize: 11, color: k === s.dogru ? T.success : T.text3, marginTop: 3, display: "flex", gap: 6 }}>
                            <span style={{ background: T.kenar, borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 800, minWidth: 20, textAlign: "center", color: k === s.dogru ? T.success : T.primary }}>{k.toUpperCase()}</span>
                            {s[k]}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <button style={S.btnP} onClick={() => soruEkleFirebase(pdfSonuc)}>
                    📤 Tümünü Firebase'e Ekle ({pdfSonuc.length} soru)
                  </button>
                  {ekleMsg && <div style={{ fontSize: 12, marginTop: 6, color: ekleMsg.startsWith("✅") ? T.success : ekleMsg.startsWith("❌") ? T.error : T.text3 }}>{ekleMsg}</div>}
                </div>
              )}
            </div>
          )}

          {/* KULLANICI SORULARI */}
          {adminTab === "kulsoruler" && (
            <div style={S.adminBody}>
              <KullaniciSorular db={db} T={T} S={S} bildir={bildir} />
            </div>
          )}

          {/* ÜYELER */}
          {adminTab === "uyeler" && (
            <div style={S.adminBody}>
              <div style={S.card}>
                <div style={S.cardT}>👥 Tüm Üyeler ({tumUyeler.length})</div>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10 }}>Online: {onlineUsers.length} kullanıcı</div>
                {tumUyeler.map((u, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.kenar}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${T.primary},${T.primaryLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {(u.ad || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{u.ad}</div>
                      <div style={{ fontSize: 10, color: T.text3 }}>{u.mail} · {u.sinav}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {onlineUsers.find(o => o.uid === u.id) && <span style={S.onlineBtn} />}
                      {u.admin && <span style={{ fontSize: 9, background: "#4c1d95", color: "#c4b5fd", padding: "2px 7px", borderRadius: 100, fontWeight: 700 }}>ADMIN</span>}
                      {u.premium && <span style={{ fontSize: 9, background: T.warning, color: "#000", padding: "2px 7px", borderRadius: 100, fontWeight: 700 }}>PRO</span>}
                      <button style={S.btnSm} onClick={() => { setMesajHedef({ uid: u.id, ad: u.ad }); setAdminTab("mesaj"); }}>💬</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MESAJ */}
          {adminTab === "mesaj" && (
            <div style={S.adminBody}>
              <div style={S.card}>
                <div style={S.cardT}>💬 Kullanıcıya Mesaj Gönder</div>
                {mesajHedef ? (
                  <>
                    <div style={{ fontSize: 13, color: T.primary, marginBottom: 10 }}>Alıcı: <b>{mesajHedef.ad}</b></div>
                    <textarea rows={4} style={{ resize: "vertical" }} placeholder="Mesajınızı yazın…" value={mesajMetin} onChange={e => setMesajMetin(e.target.value)} />
                    <button style={{ ...S.btnP, marginTop: 10 }} onClick={mesajGonder}>📤 Gönder</button>
                    <button style={{ ...S.btnS, marginTop: 8 }} onClick={() => setMesajHedef(null)}>İptal</button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: T.text3 }}>Üyeler sekmesinden bir kullanıcı seçip 💬 butonuna tıklayın.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KULLANICI SORULARI BİLEŞENİ ──────────────────────────────────
function KullaniciSorular({ db, T, S, bildir }) {
  const [sorular, setSorular] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "kullanici_sorular"), where("onay", "==", false), orderBy("tarih", "desc"), limit(20));
    const unsub = onSnapshot(q, snap => setSorular(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function onayla(s) {
    await addDoc(collection(db, "sorular"), { ...s, onay: true, kaynak: "kullanici" });
    await updateDoc(doc(db, "kullanici_sorular", s.id), { onay: true });
    bildir("Soru onaylandı ve yayınlandı!", "basari");
  }
  async function reddet(id) {
    await deleteDoc(doc(db, "kullanici_sorular", id));
    bildir("Soru silindi.", "info");
  }

  return (
    <div style={S.card}>
      <div style={S.cardT}>✏️ Onay Bekleyen Sorular ({sorular.length})</div>
      {sorular.length === 0 && <div style={{ fontSize: 12, color: T.text3 }}>Onay bekleyen soru yok.</div>}
      {sorular.map(s => (
        <div key={s.id} style={{ background: T.bg3, borderRadius: 10, padding: "12px", marginBottom: 10, borderLeft: `3px solid ${T.warning}` }}>
          <div style={{ fontSize: 10, color: T.text3, marginBottom: 4 }}>{s.ekleyen} · {s.konu}</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{s.soru}</div>
          {["a", "b", "c", "d"].filter(k => s[k]).map(k => (
            <div key={k} style={{ fontSize: 11, color: k === s.dogru ? T.success : T.text3, marginTop: 2 }}>
              {k.toUpperCase()}) {s[k]} {k === s.dogru ? "✓" : ""}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={{ ...S.btnP, flex: 1, padding: "8px" }} onClick={() => onayla(s)}>✅ Onayla</button>
            <button style={{ ...S.btnS, flex: 1, padding: "8px", color: T.error, borderColor: T.error + "60" }} onClick={() => reddet(s.id)}>❌ Sil</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BOTTOM NAV ───────────────────────────────────────────────────
function BNav({ setE, T }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: T.bg2, borderTop: `1px solid ${T.kenar}`, display: "flex", justifyContent: "space-around", padding: "8px 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 100 }}>
      {[["🏠", "Ana", "ana"], ["📊", "İstat", "istat"], ["⚡", "Yarış", "yaris"], ["🎯", "Masa", "masa"], ["👤", "Profil", "profil"]].map(([ic, l, e]) => (
        <button key={e} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: T.text3, cursor: "pointer", padding: "4px 8px", fontSize: 10 }} onClick={() => setE(e)}>
          <span style={{ fontSize: 18 }}>{ic}</span>
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}
