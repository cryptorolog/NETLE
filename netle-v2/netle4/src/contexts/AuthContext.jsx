import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, set, onDisconnect } from "firebase/database";
import { auth, db, rtdb } from "../firebase";

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(null);
  const [profil, setProfil] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  async function kayitOl(email, sifre, profilData) {
    const cred = await createUserWithEmailAndPassword(auth, email, sifre);
    const uid = cred.user.uid;
    const yeniProfil = {
      uid,
      email,
      ad: profilData.ad,
      tel: profilData.tel || "",
      unvan: profilData.unvan || "",
      sinav: profilData.sinav || "",
      premium: false,
      admin: false,
      puan: 0,
      rozet: [],
      tema: "gece",
      olusturuldu: serverTimestamp(),
    };
    await setDoc(doc(db, "uyeler", uid), yeniProfil);
    setProfil(yeniProfil);
    return cred;
  }

  async function girisYap(email, sifre) {
    return signInWithEmailAndPassword(auth, email, sifre);
  }

  async function cikisYap() {
    if (kullanici) {
      await set(ref(rtdb, `online/${kullanici.uid}`), null);
    }
    return signOut(auth);
  }

  async function profilGuncelle(data) {
    if (!kullanici) return;
    await setDoc(doc(db, "uyeler", kullanici.uid), data, { merge: true });
    setProfil((p) => ({ ...p, ...data }));
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setKullanici(user);
      if (user) {
        const snap = await getDoc(doc(db, "uyeler", user.uid));
        if (snap.exists()) {
          const p = snap.data();
          setProfil(p);
          // Online presence
          const onlineRef = ref(rtdb, `online/${user.uid}`);
          await set(onlineRef, {
            uid: user.uid,
            ad: p.ad || email,
            unvan: p.unvan || "",
            giris: Date.now(),
          });
          onDisconnect(onlineRef).remove();
        }
      } else {
        setProfil(null);
      }
      setYukleniyor(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider
      value={{ kullanici, profil, yukleniyor, kayitOl, girisYap, cikisYap, profilGuncelle }}
    >
      {children}
    </AuthContext.Provider>
  );
}
