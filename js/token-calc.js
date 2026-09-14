// js/token-calc.js - Perhitungan riil berdasarkan riwayat tanggal

export function hitungPrediksiHabis(riwayat) {
  if (!riwayat || riwayat.length === 0) {
    return { status: 'baru', pesan: 'Belum ada data token', butuhIsi: false };
  }

  // Urutkan dari catatan terlama ke terbaru
  const dataUrut = [...riwayat].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const catatanTerakhir = dataUrut[dataUrut.length - 1];

  if (dataUrut.length === 1) {
    return {
      status: 'baru',
      sisaKwh: catatanTerakhir.kwh,
      tanggalCatat: catatanTerakhir.tanggal,
      pesan: 'Butuh 1x catat lagi di tanggal berbeda untuk hitung estimasi',
      butuhIsi: false,
      kwhPerHari: null,
      estimasiHari: null
    };
  }

  // Ambil data terakhir dan data sebelum terakhir
  const dataSebelum = dataUrut[dataUrut.length - 2];
  const tgl1 = new Date(dataSebelum.tanggal);
  const tgl2 = new Date(catatanTerakhir.tanggal);

  const selisihHari = Math.max(1, Math.round((tgl2 - tgl1) / (1000 * 60 * 60 * 24)));
  const pemakaian = dataSebelum.kwh - catatanTerakhir.kwh;

  // Jika token bertambah (baru diisi ulang / top-up)
  if (pemakaian <= 0) {
    return {
      status: 'topup',
      sisaKwh: catatanTerakhir.kwh,
      tanggalCatat: catatanTerakhir.tanggal,
      pesan: 'Token baru diisi ulang / tidak berkurang',
      butuhIsi: false,
      kwhPerHari: 0,
      estimasiHari: null
    };
  }

  const kwhPerHari = pemakaian / selisihHari;
  const estimasiHari = Math.floor(catatanTerakhir.kwh / kwhPerHari);

  let status = 'aman';
  if (estimasiHari <= 3) {
    status = 'kritis';
  } else if (estimasiHari <= 7) {
    status = 'waspada';
  }

  return {
    status,
    sisaKwh: catatanTerakhir.kwh,
    tanggalCatat: catatanTerakhir.tanggal,
    selisihHari,
    pemakaianTotal: pemakaian.toFixed(1),
    kwhPerHari: kwhPerHari.toFixed(2),
    estimasiHari,
    butuhIsi: status !== 'aman'
  };
}
