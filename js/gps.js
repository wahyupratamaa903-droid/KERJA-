// js/gps.js - Deteksi satelit & pemroses koordinat manual

export function dapatkanKoordinatGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat tidak mendukung sensor GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        resolve({
          lat: Number(posisi.coords.latitude.toFixed(6)),
          lng: Number(posisi.coords.longitude.toFixed(6))
        });
      },
      (error) => {
        let pesan = 'Gagal mengambil lokasi GPS.';
        if (error.code === error.PERMISSION_DENIED) pesan = 'Izin lokasi ditolak di browser.';
        else if (error.code === error.TIMEOUT) pesan = 'Waktu sinyal GPS habis.';
        reject(new Error(pesan));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

// Mengubah format "3.797733°S, 102.266305°E" atau "-3.797733, 102.266305" ke objek { lat, lng }
export function parsingKoordinatManual(teks) {
  if (!teks || !teks.trim()) return null;

  const bagian = teks.split(/[,;/]/).map(b => b.trim());
  if (bagian.length < 2) return null;

  function bersihkanAngka(str) {
    const isSelatanAtauBarat = /[swSW]/.test(str);
    const angkaBersih = str.replace(/[^0-9.-]/g, '');
    let nilai = parseFloat(angkaBersih);

    if (isNaN(nilai)) return null;
    if (isSelatanAtauBarat && nilai > 0) nilai = -nilai;
    return Number(nilai.toFixed(6));
  }

  const lat = bersihkanAngka(bagian[0]);
  const lng = bersihkanAngka(bagian[1]);

  if (lat === null || lng === null) return null;
  return { lat, lng };
}
