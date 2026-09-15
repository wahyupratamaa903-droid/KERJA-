// js/export-wa.js - Generator format rekap WhatsApp

export function kirimLaporanKeWhatsApp(daftarSarana, fungsiHitung) {
  const tglSekarang = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const saranaKritis = [];
  const saranaAman = [];

  daftarSarana.forEach(item => {
    const info = fungsiHitung(item.riwayatToken);
    if (info.status === 'kritis' || info.status === 'waspada') {
      saranaKritis.push({ item, info });
    } else {
      saranaAman.push({ item, info });
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

  const urlWa = `https://api.whatsapp.com/send?text=${encodeURIComponent(teks)}`;
  window.open(urlWa, '_blank');
}
