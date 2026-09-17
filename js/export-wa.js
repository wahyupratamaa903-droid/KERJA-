// js/export-wa.js - Berbagi laporan WhatsApp lengkap dengan lampiran foto

export async function kirimLaporanKeWhatsApp(daftarSarana, fungsiHitung) {
  const tglSekarang = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const saranaKritis = [];

  daftarSarana.forEach(item => {
    const info = fungsiHitung(item.riwayatToken);
    if (info.status === 'kritis' || info.status === 'waspada') {
      saranaKritis.push({ item, info });
    }
  });

  let teks = `*LAPORAN STATUS TOKEN SARANA LAPANGAN*\n`;
  teks += `Tanggal Pengecekan: ${tglSekarang}\n`;
  teks += `Total Titik: ${daftarSarana.length} | *Perlu Diisi: ${saranaKritis.length}*\n`;
  teks += `-------------------------------------------\n\n`;

  if (saranaKritis.length === 0) {
    teks += `*STATUS:* Seluruh sarana saat ini dalam kondisi AMAN.\n\n`;
  } else {
    teks += `*DAFTAR SARANA SEGERA DIISI / WASPADA:*\n\n`;
    saranaKritis.forEach((entry, i) => {
      const s = entry.item;
      const inf = entry.info;
      const jenis = s.jenisLampu === 'FL' ? `FL (${s.jumlahLampu} Lampu)` : s.jenisLampu;

      teks += `${i + 1}. *${s.lokasi}*\n`;
      teks += `   - Tipe: ${s.tipe} • ${jenis}\n`;
      teks += `   - Sisa Terakhir: ${inf.terakhir.kwh} kWh (${inf.terakhir.tanggal})\n`;
      teks += `   - Estimasi Habis: *± ${inf.estimasiHari} Hari Lagi (${inf.tanggalHabis || '-'})*\n`;
      if (s.koordinat && s.koordinat.lat) {
        teks += `   - Rute Lokasi: https://maps.google.com/?q=${s.koordinat.lat},${s.koordinat.lng}\n`;
      }
      teks += `\n`;
    });
  }

  teks += `-------------------------------------------\n`;
  teks += `_Laporan otomatis dari Sistem Monitoring Lapangan_`;

  // Konversi foto base64 sarana kritis menjadi file foto nyata
  const berkasFoto = [];
  for (const entry of saranaKritis) {
    if (entry.item.fotos && entry.item.fotos.length > 0) {
      for (let i = 0; i < entry.item.fotos.length; i++) {
        try {
          const base64 = entry.item.fotos[i];
          const response = await fetch(base64);
          const blob = await response.blob();
          const file = new File([blob], `sarana_${entry.item.id}_${i + 1}.jpg`, { type: 'image/jpeg' });
          berkasFoto.push(file);
          if (berkasFoto.length >= 6) break; // Batasi maks 6 foto agar menu share tetap cepat
        } catch (e) {
          console.warn('Gagal menyiapkan berkas gambar:', e);
        }
      }
    }
    if (berkasFoto.length >= 6) break;
  }

  // Gunakan Android Native Share jika ada foto dan didukung browser Chrome HP
  if (berkasFoto.length > 0 && navigator.canShare && navigator.canShare({ files: berkasFoto })) {
    try {
      await navigator.share({
        title: 'Laporan Token Sarana Lapangan',
        text: teks,
        files: berkasFoto
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // Dibatalkan oleh pengguna
      console.warn('Beralih ke WhatsApp Web link:', err);
    }
  }

  // Fallback standar URL WhatsApp
  const urlWa = `https://api.whatsapp.com/send?text=${encodeURIComponent(teks)}`;
  window.open(urlWa, '_blank');
}
