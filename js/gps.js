// js/gps.js - Deteksi Sensor Posisi Satelit GPS Lapangan
export function dapatkanKoordinatGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Perangkat tidak mendukung sensor geolokasi GPS."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          akurasi: Math.round(pos.coords.accuracy)
        });
      },
      (err) => {
        let alasan = "";
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            alasan = "IZIN LOKASI DITOLAK: Peramban Chrome memblokir akses lokasi untuk web ini.\n\nCara Membuka:\n1. Ketuk ikon Setelan/Gembok di sebelah kiri bilah URL atas.\n2. Pilih 'Izin' atau 'Setelan Situs'.\n3. Ubah 'Lokasi' menjadi 'IZINKAN'.";
            break;
          case 2: // POSITION_UNAVAILABLE
            alasan = "GPS HP TIDAK AKTIF: Sinyal GPS satelit tidak terdeteksi. Pastikan tombol 'Lokasi / GPS' di bar notifikasi HP Anda sudah dinyalakan.";
            break;
          case 3: // TIMEOUT
            alasan = "WAKTU HABIS: Satelit GPS membutuhkan waktu lebih lama untuk mengunci posisi. Pastikan Anda berada di luar ruangan dengan pandangan langit terbuka.";
            break;
          default:
            alasan = err.message || "Gagal memperoleh koordinat GPS.";
        }
        reject(new Error(alasan));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}
