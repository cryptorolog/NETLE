import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TEMALAR, VARSAYILAN_TEMA } from "./themes";
import Splash from "./pages/Splash";
import Giris from "./pages/Giris";
import Ana from "./pages/Ana";
import Soru from "./pages/Soru";
import Istatistik from "./pages/Istatistik";
import Profil from "./pages/Profil";
import Admin from "./pages/Admin";
import Yaris from "./pages/Yaris";
import BesliMasa from "./pages/BesliMasa";
import Toast from "./components/Toast";

function AppInner() {
  const { kullanici, profil, yukleniyor } = useAuth();
  const [ekran, setEkran] = useState("splash");
  const [soruParams, setSoruParams] = useState(null);
  const [tema, setTema] = useState(() => localStorage.getItem("netle_tema") || VARSAYILAN_TEMA);
  const [toast, setToast] = useState(null);

  const T = TEMALAR[tema] || TEMALAR[VARSAYILAN_TEMA];

  function bildir(msg, tip = "info") {
    setToast({ msg, tip });
    setTimeout(() => setToast(null), 3000);
  }

  function temaGuncelle(yeniTema) {
    setTema(yeniTema);
    localStorage.setItem("netle_tema", yeniTema);
  }

  function soruBaslat(params) {
    setSoruParams(params);
    setEkran("soru");
  }

  useEffect(() => {
    if (!yukleniyor) {
      setEkran(kullanici ? "ana" : "giris");
    }
  }, [yukleniyor, kullanici]);

  useEffect(() => {
    if (profil?.tema && profil.tema !== tema) {
      setTema(profil.tema);
    }
  }, [profil]);

  const css = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    button { cursor: pointer; font-family: inherit; }
    button:active { transform: scale(0.97); }
    input, select, textarea { font-family: inherit; }
    select option { background: ${T.bg2}; }
    input[type=checkbox] { display: none; }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.bg3}; border-radius: 2px; }
  `;

  const rootStyle = {
    minHeight: "100vh",
    background: T.bg,
    color: T.text,
    fontFamily: "'Inter', -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    transition: "background 0.3s, color 0.3s",
  };

  const props = { T, tema, temaGuncelle, bildir, setEkran, soruBaslat };

  return (
    <div style={rootStyle}>
      <style>{css}</style>
      {toast && <Toast toast={toast} T={T} />}

      {yukleniyor || ekran === "splash" ? (
        <Splash T={T} />
      ) : !kullanici ? (
        <Giris {...props} />
      ) : ekran === "ana" ? (
        <Ana {...props} />
      ) : ekran === "soru" ? (
        <Soru {...props} params={soruParams} />
      ) : ekran === "istat" ? (
        <Istatistik {...props} />
      ) : ekran === "profil" ? (
        <Profil {...props} />
      ) : ekran === "admin" ? (
        <Admin {...props} />
      ) : ekran === "yaris" ? (
        <Yaris {...props} />
      ) : ekran === "besli" ? (
        <BesliMasa {...props} />
      ) : (
        <Ana {...props} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
