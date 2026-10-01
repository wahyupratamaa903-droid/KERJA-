// js/gps.js - Deteksi Posisi GPS Akurasi Tinggi
export function dapatkanKoordinatGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Perangkat tidak mendukung fitur lokasi GPS."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          akurasi: pos.coords.accuracy
        });
      },
      (err) => {
        let pesan = "Gagal mengambil lokasi.";
        if (err.code === 1) pesan = "Izin lokasi GPS ditolak oleh peramban. Mohon izinkan akses lokasi.";
        else if (err.code === 2) pesan = "Sinyal GPS tidak terdeteksi. Pastikan GPS HP aktif.";
        else if (err.code === 3) pesan = "Waktu pencarian GPS habis.";
        reject(new Error(pesan));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}
