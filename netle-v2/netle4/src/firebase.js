import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA9mrdLvnKwkPK6fNRxhb0klQGbzLU9dkI",
  authDomain: "netle-app.firebaseapp.com",
  projectId: "netle-app",
  storageBucket: "netle-app.firebasestorage.app",
  messagingSenderId: "1020041214470",
  appId: "1:1020041214470:web:056950539ad9032363e187",
  databaseURL: "https://netle-app-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export default app;
