import { CLOUD_API_URL } from './config-db.js';

export async function kirimDataKeServer(daftarSarana) {
  try {
    if (!CLOUD_API_URL) return false;

    // Hanya mengirim data yang kamu input, tanpa menyisipkan data tiruan
    const dataRingan = (daftarSarana || []).map(s => {
      const { fotos, ...dataBersih } = s;
      return dataBersih;
    });

    const respon = await fetch(CLOUD_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataRingan)
    });

    return respon.ok;
  } catch (err) {
    console.error("Gagal sinkronisasi ke server:", err);
    return false;
  }
}

export async function ambilDataDariServer() {
  try {
    if (!CLOUD_API_URL) return [];

    const respon = await fetch(CLOUD_API_URL, { cache: 'no-store' });
    if (!respon.ok) return [];

    const data = await respon.json();
    if (!data) return [];

    const daftar = Array.isArray(data) ? data : Object.values(data);
    return daftar.filter(Boolean);
  } catch (err) {
    console.error("Gagal mengambil data server:", err);
    return [];
  }
}
