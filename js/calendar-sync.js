// js/calendar-sync.js - Sinkronisasi Pengingat Token ke Google Calendar

function formatTglGoogle(date) {
  return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

export function pasangAlarmTokenHabis(daftarSarana, fungsiHitung) {
  const kritis = [];

  daftarSarana.forEach(s => {
    const info = fungsiHitung(s.riwayatToken);
    if ((info.status === 'kritis' || info.status === 'waspada') && info.estimasiHari !== undefined) {
      kritis.push({ s, info });
    }
  });

  if (kritis.length === 0) {
    alert("Semua titik sarana dalam kondisi aman. Belum ada jadwal pengisian mendesak.");
    return;
  }

  // Buat pengingat untuk titik paling mendesak
  const target = kritis[0];
  const tglHabis = new Date();
  tglHabis.setDate(tglHabis.getDate() + Math.max(1, target.info.estimasiHari - 1)); // Diingatkan 1 hari sebelum habis
  tglHabis.setHours(9, 0, 0, 0);

  const tglSelesai = new Date(tglHabis);
  tglSelesai.setHours(10, 0, 0, 0);

  const judul = encodeURIComponent(`[PATROLI PLN] Isi Ulang Token: ${target.s.lokasi}`);
  const rincian = encodeURIComponent(
    `Pengingat Pengisian Token Listrik Reklame PT DEVIS JAYA\n` +
    `Titik: ${target.s.lokasi} (${target.s.tipe})\n` +
    `Sisa Terakhir: ${target.info.terakhir.kwh} kWh\n` +
    `Estimasi Padam: ${target.info.tanggalHabis}\n` +
    `Segera koordinasikan dengan Bu Reni / Pak Alfian untuk pengisian voucher token PLN.`
  );

  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${judul}&dates=${formatTglGoogle(tglHabis)}/${formatTglGoogle(tglSelesai)}&details=${rincian}&location=${encodeURIComponent(target.s.lokasi)}`;
  window.open(gCalUrl, '_blank');
}
