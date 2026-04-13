import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import BottomNav from "../components/BottomNav";

const UNVANLAR = ["Mübaşir","Zabıt Katibi","Yazı İşleri Müdürü","İdari İşler Müdürü","Müdür Yardımcısı","Şef","İcra Müdürü","İcra Müdür Yardımcısı"];
const KONULAR = ["Anayasa Hukuku","İdare Hukuku","Ceza Hukuku","Medeni Hukuk","İş Hukuku","657 Sayılı DMK","Ceza Muhakemesi Hukuku","Hukuk Muhakemeleri Usulü","İcra ve İflas Hukuku","Borçlar Hukuku","Ticaret Hukuku","Genel Kültür","Türkçe","Atatürk İlkeleri","Matematik / Mantık"];

export default function Admin({ T, bildir, setEkran }) {
  const { kullanici, profil } = useAuth();
  const [tab, setTab] = useState("pdf");
  const [onlineKullanicilar, setOnlineKullanicilar] = useState([]);
  const [bekleyenSorular, setBekleyenSorular] = useState([]);
  const [tumUyeler, setTumUyeler] = useState([]);
  const [sorularIstat, setSorularIstat] = useState({});
  const [mesajModal, setMesajModal] = useState(null);
  const [mesajMetni, setMesajMetni] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfB64, setPdfB64] = useState(null);
  const [pdfUnvanlar, setPdfUnvanlar] = useState([]);
  const [pdfKonular, setPdfKonular] = useState([]);
  const [pdfSinav, setPdfSinav] = useState("Adalet Bak. GYS");
  const [pdfYuk, setPdfYuk] = useState(false);
  const [pdfSonuc, setPdfSonuc] = useState(null);
  const [pdfMsg, setPdfMsg] = useState("");
  const [ekleMsg, setEkleMsg] = useState("");
  const [seciliSorular, setSeciliSorular] = useState(new Set());
  const fileRef = useRef();

  if (!profil?.admin) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", gap:16, padding:24 }}>
        <div style={{ fontSize:48 }}>🚫</div>
        <div style={{ fontSize:16, fontWeight:700, color:"#ef4444" }}>Admin yetkisi yok</div>
        <button onClick={() => setEkran("ana")} style={{ background:T.gradient, border:"none", borderRadius:11, padding:"12px 24px", color:"white", fontWeight:700 }}>Geri Dön</button>
      </div>
    );
  }

  useEffect(() => {
    const unsub = onValue(ref(rtdb, "online"), snap => {
      setOnlineKullanicilar(snap.exists() ? Object.values(snap.val()) : []);
    });
    async function yukle() {
      try {
        const q = query(collection(db, "kullanici_sorular"), limit(50));
        const snap = await getDocs(q);
        setBekleyenSorular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      try {
        const snap2 = await getDocs(query(collection(db, "sorular"), limit(2000)));
        const istat = {};
        snap2.docs.forEach(d => {
          const k = d.data().ders || d.data().konu || "Genel";
          istat[k] = (istat[k] || 0) + 1;
        });
        setSorularIstat(istat);
      } catch {}
      try {
        const snap3 = await getDocs(query(collection(db, "uyeler"), limit(200)));
        setTumUyeler(snap3.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
    }
    yukle();
    return unsub;
  }, []);

  function pdfSec(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file); setPdfSonuc(null); setPdfMsg(""); setEkleMsg(""); setSeciliSorular(new Set());
    const reader = new FileReader();
    reader.onload = ev => setPdfB64(ev.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  }

  function toggle(list, setList, val) {
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);
  }

  async function pdfdenSoruUret() {
    if (!pdfB64) { bildir("PDF yükleyin!", "hata"); return; }
    if (!pdfUnvanlar.length) { bildir("Ünvan seçin!", "hata"); return; }
    if (!pdfKonular.length) { bildir("Konu seçin!", "hata"); return; }
    setPdfYuk(true); setPdfSonuc(null); setPdfMsg("🤖 Claude analiz ediyor… (1-3 dk)");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
              { type: "text", text: `Adalet Bakanlığı GYS soru üreticisisin.\nSınav: ${pdfSinav}\nÜnvanlar: ${pdfUnvanlar.join(", ")}\nKonular: ${pdfKonular.join(", ")}\n\nPDF'i baştan sona tara, hiçbir detayı atlama. En az 20 soru üret.\nSADECE JSON: {"sorular":[{"sinav":"${pdfSinav}","ders":"KONU","soru":"?","a":"","b":"","c":"","d":"","e":"","dogru":"a"}]}` }
            ]
          }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = (data.content || []).map(b => b.text || "").join("");
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("JSON bulunamadı");
      const parsed = JSON.parse(m[0]);
      if (!parsed.sorular?.length) throw new Error("Soru üretilemedi");
      setPdfSonuc(parsed.sorular);
      setSeciliSorular(new Set(parsed.sorular.map((_, i) => i)));
      setPdfMsg(`✅ ${parsed.sorular.length} soru üretildi!`);
    } catch (err) {
      setPdfMsg("❌ " + err.message);
    } finally {
      setPdfYuk(false);
    }
  }

  async function soruEkle() {
    if (!pdfSonuc || !seciliSorular.size) { bildir("Soru seçin!", "hata"); return; }
    setEkleMsg("Firebase'e ekleniyor…");
    try {
      const liste = pdfSonuc.filter((_, i) => seciliSorular.has(i));
      for (const s of liste) {
        await addDoc(collection(db, "sorular"), {
          sinav: s.sinav || pdfSinav, unvanlar: pdfUnvanlar,
          ders: s.ders || pdfKonular[0], konu: s.ders || pdfKonular[0],
          soru: s.soru, a: s.a, b: s.b, c: s.c, d: s.d, e: s.e || "",
          dogru: s.dogru, ekleyenUid: kullanici.uid, olusturuldu: serverTimestamp(),
        });
      }
      setEkleMsg(`✅ ${liste.length} soru eklendi!`);
      setPdfSonuc(null); setPdfFile(null); setPdfB64(null); setSeciliSorular(new Set());
      bildir(`${liste.length} soru Firebase'e eklendi!`, "basari");
    } catch (e) {
      setEkleMsg("❌ " + e.message);
    }
  }

  async function soruOnayla(s) {
    try {
      await addDoc(collection(db, "sorular"), {
        ders: s.konu || "Genel", konu: s.konu || "Genel",
        soru: s.soru, a: s.a, b: s.b, c: s.c, d: s.d, e: s.e || "",
        dogru: s.dogru, kaynak: "kullanici", ekleyenUid: s.ekleyenUid,
        olusturuldu: serverTimestamp(),
      });
      await deleteDoc(doc(db, "kullanici_sorular", s.id));
      setBekleyenSorular(prev => prev.filter(x => x.id !== s.id));
      bildir("Soru onaylandı!", "basari");
    } catch (e) { bildir("Hata: " + e.message, "hata"); }
  }

  async function mesajGonder() {
    if (!mesajMetni.trim() || !mesajModal) return;
    try {
      await addDoc(collection(db, "mesajlar"), {
        aliciUid: mesajModal.uid || mesajModal.id,
        aliciAd: mesajModal.ad,
        gondereciUid: kullanici.uid,
        gondereciAd: profil?.ad || "Admin",
        mesaj: mesajMetni, okundu: false,
        olusturuldu: serverTimestamp(),
      });
      bildir("Mesaj gönderildi!", "basari");
      setMesajModal(null); setMesajMetni("");
    } catch (e) { bildir("Hata: " + e.message, "hata"); }
  }

  async function yetkiDegistir(uye, alan) {
    try {
      await updateDoc(doc(db, "uyeler", uye.id), { [alan]: !uye[alan] });
      setTumUyeler(prev => prev.map(u => u.id === uye.id ? { ...u, [alan]: !u[alan] } : u));
      bildir("Güncellendi!", "basari");
    } catch (e) { bildir("Hata: " + e.message, "hata"); }
  }

  const tabs = [["pdf","📄 PDF→Soru"],["uyeler","👥 Üyeler"],["sorular","❓ Sorular"],["onay","✅ Onay"],["online","🟢 Online"]];

  const C = {
    card: { background:T.bg2, border:`1px solid ${T.border}`, borderRadius:16, padding:16, marginBottom:12 },
    inp: { width:"100%", padding:"11px 13px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontSize:13, outline:"none", marginBottom:8 },
    btn: { padding:"12px", background:T.gradient, border:"none", borderRadius:10, color:"white", fontWeight:800, fontSize:13, width:"100%", marginBottom:8 },
    lbl: { fontSize:10, color:T.text3, fontWeight:600, marginBottom:4, display:"block", marginTop:6 },
    chk: (on) => ({ padding:"5px 10px", background:on?T.accent+"33":T.bg, border:`1px solid ${on?T.accent:T.border}`, borderRadius:7, fontSize:11, cursor:"pointer", userSelect:"none", color:on?T.accent:T.text2 }),
  };

  return (
    <div style={{ width:"100%", maxWidth:480, minHeight:"100vh", paddingBottom:90 }}>

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"16px 16px 8px" }}>
        <button onClick={() => setEkran("ana")} style={{ background:T.bg2, border:"none", borderRadius:9, padding:"8px 14px", color:T.text, fontSize:16 }}>←</button>
        <h2 style={{ fontSize:17, fontWeight:800, margin:0, color:T.accent }}>🔐 Admin Paneli</h2>
        <div style={{ marginLeft:"auto", fontSize:10, color:T.text3 }}>
          {Object.values(sorularIstat).reduce((a,b)=>a+b,0)} soru · {tumUyeler.length} üye
        </div>
      </div>

      <div style={{ display:"flex", gap:5, padding:"0 14px 12px", overflowX:"auto" }}>
        {tabs.map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"7px 12px", background:tab===t?T.gradient:T.bg2,
            border:`1px solid ${tab===t?"transparent":T.border}`,
            borderRadius:9, color:"white", fontSize:11, fontWeight:700, whiteSpace:"nowrap",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"0 14px 20px" }}>

        {/* PDF → SORU */}
        {tab==="pdf" && (
          <>
            <div style={C.card}>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:8 }}>📄 PDF'den Yapay Zeka ile Soru Üret</div>
              <div style={{ fontSize:11, color:T.text2, marginBottom:12, lineHeight:1.6 }}>
                PDF → ünvan & konu seç → Claude tüm içeriği tarar → önizle → seç → Firebase'e ekle
              </div>

              <div style={{
                border:`2px dashed ${pdfFile?T.accent:T.border}`, borderRadius:14,
                padding:"22px 16px", cursor:"pointer", textAlign:"center", marginBottom:12,
                background:pdfFile?T.accent+"11":"transparent",
              }} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={pdfSec} />
                {pdfFile ? (
                  <><div style={{ fontSize:32, marginBottom:6 }}>📄</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.accent }}>{pdfFile.name}</div>
                  <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{(pdfFile.size/1024/1024).toFixed(2)} MB · Değiştirmek için tıkla</div></>
                ) : (
                  <><div style={{ fontSize:36, marginBottom:8 }}>☁️</div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text2 }}>PDF Yükle</div>
                  <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>Kanun, yönetmelik, ders notu…</div></>
                )}
              </div>

              <label style={C.lbl}>Sınav Adı</label>
              <input style={C.inp} value={pdfSinav} onChange={e => setPdfSinav(e.target.value)} />

              <label style={C.lbl}>Hedef Ünvanlar <span style={{ color:T.text3, fontWeight:400 }}>(çoklu)</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                {UNVANLAR.map(u => (
                  <label key={u} style={C.chk(pdfUnvanlar.includes(u))}>
                    <input type="checkbox" style={{ display:"none" }} checked={pdfUnvanlar.includes(u)} onChange={() => toggle(pdfUnvanlar, setPdfUnvanlar, u)} />
                    {pdfUnvanlar.includes(u)?"✓ ":""}{u}
                  </label>
                ))}
              </div>

              <label style={C.lbl}>Konu Kategorileri <span style={{ color:T.text3, fontWeight:400 }}>(çoklu)</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
                {KONULAR.map(k => (
                  <label key={k} style={C.chk(pdfKonular.includes(k))}>
                    <input type="checkbox" style={{ display:"none" }} checked={pdfKonular.includes(k)} onChange={() => toggle(pdfKonular, setPdfKonular, k)} />
                    {pdfKonular.includes(k)?"✓ ":""}{k}
                  </label>
                ))}
              </div>

              <button style={{ ...C.btn, opacity:pdfYuk?0.6:1 }} onClick={pdfdenSoruUret} disabled={pdfYuk}>
                {pdfYuk?"⏳ Analiz ediliyor… (1-3 dk)":"🤖 Yapay Zeka ile Soru Üret"}
              </button>
              {pdfMsg && <div style={{ fontSize:12, color:pdfMsg.startsWith("✅")?"#10b981":pdfMsg.startsWith("❌")?"#ef4444":T.text2, lineHeight:1.5 }}>{pdfMsg}</div>}
            </div>

            {pdfSonuc?.length > 0 && (
              <div style={C.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>✅ {pdfSonuc.length} Soru — Önizleme</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => setSeciliSorular(new Set(pdfSonuc.map((_,i)=>i)))} style={{ padding:"5px 9px", background:T.bg3, border:"none", borderRadius:7, color:T.text2, fontSize:11 }}>Tümü</button>
                    <button onClick={() => setSeciliSorular(new Set())} style={{ padding:"5px 9px", background:T.bg3, border:"none", borderRadius:7, color:T.text2, fontSize:11 }}>Temizle</button>
                  </div>
                </div>
                <div style={{ fontSize:11, color:T.text2, marginBottom:8 }}>{seciliSorular.size}/{pdfSonuc.length} seçili — Seçilenleri ekleyeceksiniz</div>

                <div style={{ maxHeight:400, overflowY:"auto", marginBottom:10 }}>
                  {pdfSonuc.map((s,i) => (
                    <div key={i} onClick={() => {
                      const y = new Set(seciliSorular);
                      y.has(i)?y.delete(i):y.add(i);
                      setSeciliSorular(y);
                    }} style={{
                      background:seciliSorular.has(i)?T.accent+"22":T.bg,
                      border:`1px solid ${seciliSorular.has(i)?T.accent:T.border}`,
                      borderRadius:10, padding:"10px 12px", marginBottom:6, cursor:"pointer",
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <div style={{ fontSize:9, color:T.accent, fontWeight:700 }}>{s.ders}</div>
                        <div style={{ fontSize:10, color:seciliSorular.has(i)?T.accent:T.text3 }}>{seciliSorular.has(i)?"✓ Seçili":"Seç"}</div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, marginBottom:5, lineHeight:1.4 }}>{i+1}. {s.soru}</div>
                      {["a","b","c","d","e"].filter(k=>s[k]).map(k=>(
                        <div key={k} style={{ fontSize:11, color:k===s.dogru?"#10b981":T.text2, marginTop:2, display:"flex", gap:5 }}>
                          <span style={{ background:T.bg2, borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:800, color:k===s.dogru?"#10b981":T.accent, minWidth:18, textAlign:"center" }}>{k.toUpperCase()}</span>
                          {s[k]}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <button style={C.btn} onClick={soruEkle} disabled={!seciliSorular.size}>
                  📤 {seciliSorular.size} Soruyu Firebase'e Ekle
                </button>
                {ekleMsg && <div style={{ fontSize:12, color:ekleMsg.startsWith("✅")?"#10b981":ekleMsg.startsWith("❌")?"#ef4444":T.text2 }}>{ekleMsg}</div>}
              </div>
            )}
          </>
        )}

        {/* ÜYELER */}
        {tab==="uyeler" && (
          <div style={C.card}>
            <div style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>👥 Üyeler ({tumUyeler.length})</div>
            {tumUyeler.map(u => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:T.gradient, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"white", flexShrink:0 }}>
                  {(u.ad||"?")[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{u.ad}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{u.email}</div>
                  <div style={{ fontSize:10, color:T.text2 }}>{u.unvan||"—"}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                  <div style={{ display:"flex", gap:3 }}>
                    {u.admin && <span style={{ fontSize:9, background:"#4c1d95", color:"#c4b5fd", padding:"2px 6px", borderRadius:100, fontWeight:700 }}>ADMİN</span>}
                    {u.premium && <span style={{ fontSize:9, background:T.gradient, color:"white", padding:"2px 6px", borderRadius:100, fontWeight:700 }}>PRO</span>}
                  </div>
                  <div style={{ display:"flex", gap:3 }}>
                    <button onClick={() => setMesajModal(u)} style={{ fontSize:16, background:"none", border:"none" }}>💬</button>
                    <button onClick={() => yetkiDegistir(u,"premium")} style={{ fontSize:9, background:u.premium?"#7f1d1d":"#065f46", border:"none", borderRadius:6, padding:"3px 6px", color:"white", fontWeight:700 }}>
                      {u.premium?"PRO Al":"PRO Ver"}
                    </button>
                    <button onClick={() => yetkiDegistir(u,"admin")} style={{ fontSize:9, background:u.admin?"#1e293b":T.accent+"33", border:`1px solid ${T.accent}44`, borderRadius:6, padding:"3px 6px", color:T.accent, fontWeight:700 }}>
                      {u.admin?"Admin Al":"Admin"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SORULAR */}
        {tab==="sorular" && (
          <div style={C.card}>
            <div style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>
              ❓ Soru Havuzu — {Object.values(sorularIstat).reduce((a,b)=>a+b,0)} soru
            </div>
            {Object.entries(sorularIstat).sort((a,b)=>b[1]-a[1]).map(([k,n]) => (
              <div key={k} style={{ display:"flex", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:12, flex:1 }}>{k}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:60, height:4, background:T.bg3, borderRadius:100, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:T.gradient, borderRadius:100, width:`${Math.min((n/Math.max(...Object.values(sorularIstat),1))*100,100)}%` }} />
                  </div>
                  <span style={{ fontSize:12, color:T.accent, fontWeight:700, minWidth:50, textAlign:"right" }}>{n} soru</span>
                </div>
              </div>
            ))}
            {!Object.keys(sorularIstat).length && <div style={{ color:T.text3, fontSize:12, textAlign:"center", padding:16 }}>Henüz soru yok.</div>}
          </div>
        )}

        {/* ONAY */}
        {tab==="onay" && (
          <div style={C.card}>
            <div style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>
              ✅ Kullanıcı Soruları ({bekleyenSorular.filter(s=>s.durum==="bekliyor").length} bekliyor)
            </div>
            {!bekleyenSorular.filter(s=>s.durum==="bekliyor").length && (
              <div style={{ color:T.text3, fontSize:12, textAlign:"center", padding:16 }}>Onay bekleyen soru yok.</div>
            )}
            {bekleyenSorular.filter(s=>s.durum==="bekliyor").map(s => (
              <div key={s.id} style={{ background:T.bg, borderRadius:12, padding:12, marginBottom:10, borderLeft:`3px solid ${T.accent}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div style={{ fontSize:10, color:T.accent, fontWeight:700 }}>{s.konu||"Genel"}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{s.ekleyenAd}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:7, lineHeight:1.4 }}>{s.soru}</div>
                {["a","b","c","d","e"].filter(k=>s[k]).map(k=>(
                  <div key={k} style={{ fontSize:11, color:k===s.dogru?"#10b981":T.text2, marginTop:2, display:"flex", gap:5 }}>
                    <span style={{ background:T.bg2, borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:800, color:k===s.dogru?"#10b981":T.accent, minWidth:18, textAlign:"center" }}>{k.toUpperCase()}</span>
                    {s[k]}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button onClick={() => soruOnayla(s)} style={{ flex:1, padding:"8px", background:"#065f46", border:"none", borderRadius:8, color:"white", fontWeight:700, fontSize:12 }}>✅ Onayla</button>
                  <button onClick={async () => {
                    await deleteDoc(doc(db, "kullanici_sorular", s.id));
                    setBekleyenSorular(prev => prev.filter(x => x.id !== s.id));
                    bildir("Reddedildi.", "info");
                  }} style={{ flex:1, padding:"8px", background:"#7f1d1d", border:"none", borderRadius:8, color:"white", fontWeight:700, fontSize:12 }}>❌ Reddet</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ONLİNE */}
        {tab==="online" && (
          <div style={C.card}>
            <div style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>🟢 Şu An Online ({onlineKullanicilar.length})</div>
            {!onlineKullanicilar.length && <div style={{ color:T.text3, fontSize:12, textAlign:"center", padding:16 }}>Kimse çevrimiçi değil.</div>}
            {onlineKullanicilar.map(u => (
              <div key={u.uid} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"#10b981" }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{u.ad||"Misafir"}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{u.unvan||"—"}</div>
                </div>
                <button onClick={() => setMesajModal({ uid:u.uid, ad:u.ad, id:u.uid })} style={{ fontSize:20, background:"none", border:"none" }}>💬</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MESAJ MODALİ */}
      {mesajModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={() => setMesajModal(null)}>
          <div style={{ background:T.bg2, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:800, marginBottom:12 }}>💬 → {mesajModal.ad}</div>
            <textarea
              style={{ width:"100%", padding:"12px 14px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:11, color:T.text, fontSize:14, outline:"none", resize:"none", height:100 }}
              placeholder="Mesajınız…"
              value={mesajMetni}
              onChange={e => setMesajMetni(e.target.value)}
            />
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={() => setMesajModal(null)} style={{ flex:1, padding:"12px", background:T.bg3, border:"none", borderRadius:11, color:T.text2, fontWeight:600 }}>İptal</button>
              <button onClick={mesajGonder} style={{ flex:2, padding:"12px", background:T.gradient, border:"none", borderRadius:11, color:"white", fontWeight:800 }}>Gönder</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav ekran="admin" setEkran={setEkran} T={T} />
    </div>
  );
}
