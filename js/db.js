// js/db.js - Mesin Siaran Cloud (Live Broadcast to Firebase)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKMCwzTpbGVzRuGypONFLyYosw3as4EEk",
  authDomain: "sarana-bengkulu.firebaseapp.com",
  projectId: "sarana-bengkulu",
  storageBucket: "sarana-bengkulu.firebasestorage.app",
  messagingSenderId: "736749701654",
  appId: "1:736749701654:web:3229cffcb234409f638337"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const KOLEKSI_SARANA = "daftar_sarana";
const DOK_META = "metadata_siaran";

// 1. Unggah seluruh sarana lokal ke cloud untuk dilihat publik
export async function siarkanDataKeCloud(daftarSarana) {
  if (!daftarSarana || daftarSarana.length === 0) {
    throw new Error("Tidak ada data untuk disiarkan.");
  }

  // Simpan setiap titik ke koleksi
  for (const s of daftarSarana) {
    const refDoc = doc(db, KOLEKSI_SARANA, String(s.id));
    await setDoc(refDoc, s, { merge: true });
  }

  // Perbarui status metadata siaran
  const refMeta = doc(db, "sistem", DOK_META);
  const dataMeta = {
    statusAktif: true,
    totalTitik: daftarSarana.length,
    waktuUpdate: new Date().toISOString()
  };
  await setDoc(refMeta, dataMeta, { merge: true });
  return dataMeta;
}

// 2. Tarik data siaran untuk penonton / tamu yang membuka web
export async function ambilDataSiaranCloud() {
  const refMeta = doc(db, "sistem", DOK_META);
  const snapMeta = await getDoc(refMeta);
  const infoMeta = snapMeta.exists() ? snapMeta.data() : { statusAktif: false };

  const snapshot = await getDocs(collection(db, KOLEKSI_SARANA));
  const hasil = [];
  snapshot.forEach((d) => hasil.push(d.data()));

  return {
    daftarSarana: hasil,
    infoMeta
  };
}
