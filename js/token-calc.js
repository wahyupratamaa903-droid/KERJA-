// js/token-calc.js - Deteksi isi ulang & estimasi tanggal kalender habis

export function hitungPrediksiHabis(riwayat) {
  if (!riwayat || riwayat.length === 0) {
    return { status: 'baru', pesan: 'Belum ada data token' };
  }

  // Urutkan catatan dari terlama ke terbaru
  const urut = [...riwayat].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const terakhir = urut[urut.length - 1];

  // Jika baru ada 1 catatan awal
  if (urut.length === 1) {
    return {
      status: 'baru',
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: null,
      pesan: 'Data awal tercatat. Masukkan catatan kedua untuk menghitung rata-rata pemakaian.'
    };
  }

  const sebelum = urut[urut.length - 2];
  const tgl1 = new Date(sebelum.tanggal);
  const tgl2 = new Date(terakhir.tanggal);
  const selisihHari = Math.max(1, Math.round((tgl2 - tgl1) / (1000 * 60 * 60 * 24)));
  const selisihKwh = sebelum.kwh - terakhir.kwh;

  let rataPerHari = 0;
  let isTopUp = false;

  if (selisihKwh <= 0) {
    // Angka bertambah = SUDAH DIISI ULANG
    isTopUp = true;
    
    // Cari rata-rata pemakaian dari siklus sebelumnya yang pernah berkurang
    let rataSebelumnya = null;
    for (let i = urut.length - 2; i > 0; i--) {
      const dataA = urut[i - 1];
      const dataB = urut[i];
      if (dataA.kwh > dataB.kwh) {
        const durasi = Math.max(1, Math.round((new Date(dataB.tanggal) - new Date(dataA.tanggal)) / (1000 * 60 * 60 * 24)));
        rataSebelumnya = (dataA.kwh - dataB.kwh) / durasi;
        break;
      }
    }
    rataPerHari = rataSebelumnya || 0;
  } else {
    // Angka berkurang = KONSUMSI NORMAL
    rataPerHari = selisihKwh / selisihHari;
  }

  // Jika belum ada data rata-rata pemakaian yang valid
  if (rataPerHari <= 0) {
    return {
      status: 'topup',
      isTopUp: true,
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
      selisihHari,
      pesan: 'Token baru diisi ulang (+ kWh). Menunggu 1x catatan berikutnya untuk menghitung laju pemakaian.'
    };
  }

  // Hitung jumlah hari tersisa
  const estimasiHari = Math.floor(terakhir.kwh / rataPerHari);

  // Hitung tanggal kalender habis (Tanggal Catat Terakhir + Estimasi Hari)
  const tglHabisObj = new Date(terakhir.tanggal);
  tglHabisObj.setDate(tglHabisObj.getDate() + estimasiHari);
  const tanggalHabis = tglHabisObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let status = 'aman';
  if (estimasiHari <= 3) status = 'kritis';
  else if (estimasiHari <= 7) status = 'waspada';

  return {
    status,
    isTopUp,
    terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
    sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
    selisihHari,
    totalPakai: isTopUp ? null : selisihKwh.toFixed(1),
    rataPerHari: rataPerHari.toFixed(2),
    estimasiHari,
    tanggalHabis,
    butuhIsi: status !== 'aman'
  };
}
