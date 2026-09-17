// js/db.js - Penghubung Firestore Database & Migrasi Data

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc 
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
const KOLEKSI = "daftar_sarana";

export async function ambilDataDariCloud() {
  const snapshot = await getDocs(collection(db, KOLEKSI));
  const hasil = [];
  snapshot.forEach((dokumen) => {
    hasil.push(dokumen.data());
  });
  return hasil;
}

export async function simpanSaranaKeCloud(item) {
  const ref = doc(db, KOLEKSI, String(item.id));
  await setDoc(ref, item, { merge: true });
}

export async function hapusSaranaDariCloud(id) {
  const ref = doc(db, KOLEKSI, String(id));
  await deleteDoc(ref);
}

// Otomatis menyelamatkan data HP dan mengunggahnya ke Cloud
export async function migrasiDataLokalKeCloud(dataLokal) {
  if (!dataLokal || dataLokal.length === 0) return;
  for (const item of dataLokal) {
    if (!item.id) item.id = Date.now() + Math.floor(Math.random() * 1000);
    await simpanSaranaKeCloud(item);
  }
}
