// js/token-calc.js - Perhitungan murni matematis tanpa angka palsu

function parseTgl(str) {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(str);
}

export function hitungPrediksiHabis(riwayat) {
  if (!riwayat || riwayat.length === 0) {
    return { status: 'baru', pesan: 'Belum ada data token' };
  }

  // Urutkan riwayat dari terlama ke terbaru
  const urut = [...riwayat].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const terakhir = urut[urut.length - 1];

  if (urut.length === 1) {
    return {
      status: 'baru',
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: null,
      pesan: 'Data awal tercatat. Tambah catatan berikutnya untuk mengukur konsumsi.'
    };
  }

  const sebelum = urut[urut.length - 2];
  const tgl1 = parseTgl(sebelum.tanggal);
  const tgl2 = parseTgl(terakhir.tanggal);
  const selisihHari = Math.max(1, Math.round((tgl2 - tgl1) / (1000 * 60 * 60 * 24)));
  const selisihKwh = sebelum.kwh - terakhir.kwh;

  let rataPerHari = 0;
  let isTopUp = false;
  let isAnomali = false;
  let keteranganPemakaian = '';

  if (selisihKwh <= 0) {
    // KONDISI DIISI ULANG
    isTopUp = true;
    keteranganPemakaian = 'Status: Diisi Ulang';

    // Cari laju konsumsi normal dari siklus sebelumnya yang pernah berkurang
    for (let i = urut.length - 2; i > 0; i--) {
      const itemA = urut[i - 1];
      const itemB = urut[i];
      if (itemA.kwh > itemB.kwh) {
        const durasi = Math.max(1, Math.round((parseTgl(itemB.tanggal) - parseTgl(itemA.tanggal)) / (1000 * 60 * 60 * 24)));
        const laju = (itemA.kwh - itemB.kwh) / durasi;
        if (laju > 0 && laju < 3000) {
          rataPerHari = laju;
          break;
        }
      }
    }
    if (rataPerHari <= 0) rataPerHari = 50; // Konsumsi wajar reklame
  } else {
    // KONSUMSI NORMAL (MURNI TANPA BATASAN PALSU)
    rataPerHari = selisihKwh / selisihHari;
    keteranganPemakaian = `Pemakaian: ${selisihKwh.toFixed(1)} kWh (${selisihHari} hr)`;

    // Deteksi jika pemakaian melebihi 5.000 kWh/hari (pasti salah ketik angka meteran)
    if (rataPerHari > 5000) {
      isAnomali = true;
    }
  }

  const estimasiHari = Math.floor(terakhir.kwh / Math.max(0.1, rataPerHari));

  const tglHabisObj = parseTgl(terakhir.tanggal);
  tglHabisObj.setDate(tglHabisObj.getDate() + estimasiHari);
  const tanggalHabis = tglHabisObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let status = 'aman';
  if (isAnomali) {
    status = 'kritis';
  } else if (terakhir.kwh < 3000 || estimasiHari <= 7) {
    status = (terakhir.kwh < 1500 || estimasiHari <= 3) ? 'kritis' : 'waspada';
  }

  if (isTopUp && terakhir.kwh >= 3000) {
    status = 'aman';
  }

  return {
    status,
    isTopUp,
    isAnomali,
    terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
    sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
    selisihHari,
    keteranganPemakaian,
    rataPerHari: rataPerHari.toFixed(2),
    estimasiHari,
    tanggalHabis,
    butuhIsi: status !== 'aman'
  };
}
