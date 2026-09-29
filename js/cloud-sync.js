// js/cloud-sync.js - Modul Sinkronisasi Real-Time Cloud
import { CLOUD_API_URL } from './config-db.js';

export async function kirimDataKeServer(daftarSarana) {
  try {
    // Bersihkan foto berat agar pengiriman data kilat (di bawah 1 detik)
    const dataKirim = daftarSarana.map(s => {
      const salin = { ...s };
      if (salin.fotos && salin.fotos.length > 2) {
        salin.fotos = salin.fotos.slice(0, 2);
      }
      return salin;
    });

    const respon = await fetch(CLOUD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataKirim)
    });

    if (!respon.ok) throw new Error(`HTTP Error: ${respon.status}`);
    return true;
  } catch (err) {
    console.error("Gagal kirim ke server cloud:", err);
    throw err;
  }
}

export async function ambilDataDariServer() {
  try {
    const respon = await fetch(`${CLOUD_API_URL}?t=${Date.now()}`); // Cegah cache browser
    if (!respon.ok) {
      if (respon.status === 404) return [];
      throw new Error(`HTTP Error: ${respon.status}`);
    }
    const data = await respon.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Gagal ambil dari server cloud:", err);
    throw err;
  }
}
