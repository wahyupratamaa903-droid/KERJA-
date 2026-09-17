// js/token-calc.js - Prediksi akurat konsumsi normal & pengisian ulang

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

  // Urutkan catatan dari terlama ke terbaru
  const urut = [...riwayat].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const terakhir = urut[urut.length - 1];

  if (urut.length === 1) {
    return {
      status: 'baru',
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: null,
      pesan: 'Data awal tercatat. Masukkan catatan berikutnya untuk mengukur konsumsi.'
    };
  }

  const sebelum = urut[urut.length - 2];
  const tgl1 = parseTgl(sebelum.tanggal);
  const tgl2 = parseTgl(terakhir.tanggal);
  const selisihHari = Math.max(1, Math.round((tgl2 - tgl1) / (1000 * 60 * 60 * 24)));
  const selisihKwh = sebelum.kwh - terakhir.kwh;

  let rataPerHari = 0;
  let isTopUp = false;
  let keteranganPemakaian = '';

  if (selisihKwh <= 0) {
    // KONDISI PENGISIAN ULANG (Token bertambah)
    isTopUp = true;

    // Cara A: Jika user menginput nominal pembelian token (kwhBeli)
    if (terakhir.kwhBeli && terakhir.kwhBeli > 0) {
      const konsumsiRiil = (sebelum.kwh + terakhir.kwhBeli) - terakhir.kwh;
      if (konsumsiRiil > 0) {
        rataPerHari = konsumsiRiil / selisihHari;
        keteranganPemakaian = `Pemakaian Riil: ${konsumsiRiil.toFixed(1)} kWh (${selisihHari} hr)`;
      }
    }

    // Cara B: Jika tidak input beli, pinjam laju konsumsi riwayat sebelumnya
    if (rataPerHari <= 0) {
      for (let i = urut.length - 2; i > 0; i--) {
        const itemA = urut[i - 1];
        const itemB = urut[i];
        let pakaiLalu = 0;

        if (itemB.kwhBeli && itemB.kwhBeli > 0) {
          pakaiLalu = (itemA.kwh + itemB.kwhBeli) - itemB.kwh;
        } else if (itemA.kwh > itemB.kwh) {
          pakaiLalu = itemA.kwh - itemB.kwh;
        }

        if (pakaiLalu > 0) {
          const durasiLalu = Math.max(1, Math.round((parseTgl(itemB.tanggal) - parseTgl(itemA.tanggal)) / (1000 * 60 * 60 * 24)));
          rataPerHari = pakaiLalu / durasiLalu;
          keteranganPemakaian = `Status: Diisi Ulang (Laju riwayat lalu)`;
          break;
        }
      }
    }
  } else {
    // KONDISI KONSUMSI NORMAL (Token berkurang)
    rataPerHari = selisihKwh / selisihHari;
    keteranganPemakaian = `Pemakaian: ${selisihKwh.toFixed(1)} kWh (${selisihHari} hr)`;
  }

  // Jika belum ada riwayat laju sama sekali
  if (rataPerHari <= 0) {
    return {
      status: 'topup',
      isTopUp: true,
      terakhir: { kwh: terakhir.kwh, tanggal: terakhir.tanggal },
      sebelumnya: { kwh: sebelum.kwh, tanggal: sebelum.tanggal },
      selisihHari,
      pesan: 'Token baru diisi ulang (+ kWh). Menunggu 1x catatan berikutnya untuk menghitung laju harian.'
    };
  }

  const estimasiHari = Math.floor(terakhir.kwh / rataPerHari);

  // Perhitungan tanggal kalender habis
  const tglHabisObj = parseTgl(terakhir.tanggal);
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
    keteranganPemakaian,
    rataPerHari: rataPerHari.toFixed(2),
    estimasiHari,
    tanggalHabis,
    butuhIsi: status !== 'aman'
  };
}
