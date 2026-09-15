// js/gps.js - Deteksi titik koordinat akurat HP

export function dapatkanKoordinatGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat atau browser tidak mendukung fitur GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        resolve({
          lat: posisi.coords.latitude,
          lng: posisi.coords.longitude
        });
      },
      (error) => {
        let pesan = 'Gagal mengambil lokasi GPS.';
        if (error.code === error.PERMISSION_DENIED) pesan = 'Izin lokasi ditolak di browser.';
        else if (error.code === error.TIMEOUT) pesan = 'Waktu pencarian sinyal GPS habis.';
        reject(new Error(pesan));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}
