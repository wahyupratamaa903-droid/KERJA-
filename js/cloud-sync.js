import { CLOUD_API_URL } from './config-db.js';

export async function kirimDataKeServer(daftarSarana) {
  try {
    const dataRingan = daftarSarana.map(s => {
      const { fotos, ...dataBersih } = s;
      return dataBersih;
    });

    // Menggunakan text/plain agar browser langsung mengirim tanpa tertahan CORS preflight
    const respon = await fetch(CLOUD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
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
    // Tanpa ?t= agar server membaca kunci sarana_devis dengan tepat
    const respon = await fetch(CLOUD_API_URL, {
      cache: 'no-store'
    });

    if (!respon.ok) {
      if (respon.status === 404) return [];
      throw new Error(`HTTP Error: ${respon.status}`);
    }

    const teks = await respon.text();
    if (!teks || teks.trim() === '') return [];
    const data = JSON.parse(teks);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Gagal ambil dari server cloud:", err);
    throw err;
  }
}
