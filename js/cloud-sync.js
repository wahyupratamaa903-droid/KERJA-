import { CLOUD_API_URL } from './config-db.js';

export async function kirimDataKeServer(daftarSarana) {
  try {
    if (!CLOUD_API_URL) throw new Error("URL Cloud Kosong");

    // Kirim data murni tanpa foto berukuran megabyte agar kilat (~3 KB)
    const dataRingan = daftarSarana.map(s => {
      const { fotos, ...dataBersih } = s;
      return dataBersih;
    });

    const respon = await fetch(CLOUD_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataRingan)
    });

    if (!respon.ok) throw new Error(`HTTP Error: ${respon.status}`);
    return true;
  } catch (err) {
    console.error("Gagal sinkronisasi data ke Firebase:", err);
    throw err;
  }
}

export async function ambilDataDariServer() {
  try {
    if (!CLOUD_API_URL) throw new Error("URL Cloud Kosong");

    const respon = await fetch(CLOUD_API_URL, {
      cache: 'no-store'
    });

    if (!respon.ok) throw new Error(`HTTP Error: ${respon.status}`);
    const data = await respon.json();
    if (!data) return [];

    const daftar = Array.isArray(data) ? data : Object.values(data);
    return daftar.filter(Boolean);
  } catch (err) {
    console.error("Gagal mengambil data dari Firebase:", err);
    throw err;
  }
}
