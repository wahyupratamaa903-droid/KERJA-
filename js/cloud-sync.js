import { CLOUD_API_URL } from './config-db.js';

export async function kirimDataKeServer(daftarSarana) {
  try {
    // Pisahkan foto berukuran megabyte agar paket data sangat kecil (~3 KB) dan kilat
    const dataRingan = daftarSarana.map(s => {
      const { fotos, ...dataBersih } = s;
      return dataBersih;
    });

    const respon = await fetch(CLOUD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataRingan)
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
    const respon = await fetch(`${CLOUD_API_URL}?t=${Date.now()}`);
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
