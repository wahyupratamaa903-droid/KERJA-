// js/token-calc.js - Perhitungan riil komparasi tanggal

export function hitungPrediksiHabis(riwayat) {
  if (!riwayat || riwayat.length === 0) {
    return { status: 'baru', pesan: 'Belum ada data token' };
  }

  // Urutkan catatan dari terlama ke terbaru
  const urut = [...riwayat].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const terakhir = urut[urut.length - 1];

  // Jika baru ada 1 kali pencatatan
  if (urut.length === 1) {
    return {
      status: 'baru',
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: null,
      pesan: 'Data awal tercatat. Tambahkan 1 catatan lagi di tanggal berbeda untuk melihat estimasi.'
    };
  }

  // Ambil data sebelum terakhir
  const sebelum = urut[urut.length - 2];
  const tgl1 = new Date(sebelum.tanggal);
  const tgl2 = new Date(terakhir.tanggal);
  const selisihHari = Math.max(1, Math.round((tgl2 - tgl1) / (1000 * 60 * 60 * 24)));
  const pemakaian = sebelum.kwh - terakhir.kwh;

  // Jika token diisi ulang
  if (pemakaian <= 0) {
    return {
      status: 'topup',
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
      pesan: 'Token baru saja diisi ulang.'
    };
  }

  const rataPerHari = pemakaian / selisihHari;
  const estimasiHari = Math.floor(terakhir.kwh / rataPerHari);

  let status = 'aman';
  if (estimasiHari <= 3) status = 'kritis';
  else if (estimasiHari <= 7) status = 'waspada';

  return {
    status,
    terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
    sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
    selisihHari,
    totalPakai: pemakaian.toFixed(1),
    rataPerHari: rataPerHari.toFixed(2),
    estimasiHari,
    butuhIsi: status !== 'aman'
  };
}
