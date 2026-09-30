// js/plugins/power-engine.js - Mesin Estimasi Presisi Tinggi (Real-Time Decay & Hybrid Model)
// 100% Bersih: Tanpa tuduhan salah input, tanpa kotak merah, membaca seluruh riwayat

export function analisaDayaDanEstimasi(riwayatToken, jumlahLampu = 0, jenisLampu = 'FL') {
  if (!riwayatToken || riwayatToken.length === 0) {
    return {
      status: 'aman',
      rataPerHari: 0,
      estimasiHari: 0,
      tanggalHabis: '-',
      pesan: 'Belum ada catatan riwayat token.',
      wattTerdeteksi: 0,
      sisaKwhEstimasiSekarang: 0,
      hariBerlalu: 0
    };
  }

  // 1. Urutkan seluruh riwayat secara kronologis (dari tanggal paling lampau ke terbaru)
  const historiUrut = [...riwayatToken].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const catatanTerakhir = historiUrut[historiUrut.length - 1];
  const catatanSebelumnya = historiUrut.length > 1 ? historiUrut[historiUrut.length - 2] : null;

  if (historiUrut.length === 1) {
    return {
      status: 'aman',
      rataPerHari: 0,
      estimasiHari: 999,
      tanggalHabis: 'Menunggu Cek ke-2',
      pesan: 'Catatan perdana. Diperlukan 1 kali pengecekan lagi untuk menghitung laju harian.',
      terakhir: catatanTerakhir,
      sebelumnya: null,
      wattTerdeteksi: 0,
      sisaKwhEstimasiSekarang: Number(catatanTerakhir.kwh),
      hariBerlalu: 0
    };
  }

  // 2. Evaluasi seluruh interval riwayat untuk memisahkan Konsumsi Murni vs Top-Up
  const daftarInterval = [];
  for (let i = 1; i < historiUrut.length; i++) {
    const awal = historiUrut[i - 1];
    const akhir = historiUrut[i];

    const tglAwal = new Date(awal.tanggal);
    const tglAkhir = new Date(akhir.tanggal);
    const selisihHari = Math.max(1, Math.round((tglAkhir - tglAwal) / (1000 * 60 * 60 * 24)));

    const kwhAwal = Number(awal.kwh);
    const kwhAkhir = Number(akhir.kwh);

    if (kwhAkhir > kwhAwal) {
      // Peristiwa Pengisian Ulang Token PLN (Top-Up)
      daftarInterval.push({ jenis: 'TOP_UP', deltaKwh: kwhAkhir - kwhAwal, selisihHari });
    } else {
      // Konsumsi Pemakaian Listrik Normal
      const deltaPakai = kwhAwal - kwhAkhir;
      const laju = deltaPakai / selisihHari;
      daftarInterval.push({ jenis: 'KONSUMSI', deltaKwh: deltaPakai, selisihHari, lajuPerHari: laju });
    }
  }

  // 3. Kalkulasi Laju Harian Berbobot Waktu (Weighted Recency Average)
  const intervalKonsumsi = daftarInterval.filter(x => x.jenis === 'KONSUMSI');
  let lajuHarian = 0;

  if (intervalKonsumsi.length === 0) {
    // Jika semua data adalah top-up, gunakan baseline fisik lampu
    const jml = (jenisLampu === 'FL' && Number(jumlahLampu) > 0) ? Number(jumlahLampu) : 2;
    lajuHarian = jml * 2.5; // Estimasi wajar per lampu
  } else if (intervalKonsumsi.length === 1) {
    lajuHarian = intervalKonsumsi[0].lajuPerHari;
  } else {
    // Pembobotan eksponensial halus: interval terbaru diberi pengaruh lebih besar
    let totalBobot = 0;
    let akumulasi = 0;
    intervalKonsumsi.forEach((item, idx) => {
      const bobot = Math.pow(idx + 1, 1.3);
      akumulasi += item.lajuPerHari * bobot;
      totalBobot += bobot;
    });
    lajuHarian = akumulasi / totalBobot;
  }

  // Jaga angka laju agar tetap positif dan rasional
  lajuHarian = Math.max(0.1, Number(lajuHarian.toFixed(2)));
  const estimasiWatt = Math.round((lajuHarian / 12) * 1000); // Beban 12 jam malam

  // 4. Kompensasi Hari Berjalan Nyata (Real-Time Decay Gap)
  const tglCekTerakhir = new Date(catatanTerakhir.tanggal);
  const tglHariIni = new Date();
  // Hitung selisih hari murni dari tanggal cek s/d hari ini
  const diffWaktu = tglHariIni.getTime() - tglCekTerakhir.getTime();
  const hariBerlalu = Math.max(0, Math.floor(diffWaktu / (1000 * 60 * 60 * 24)));

  const kwhTercatat = Number(catatanTerakhir.kwh);
  const perkiraanPakaiBerjalan = hariBerlalu * lajuHarian;
  const sisaKwhSekarang = Math.max(0, Number((kwhTercatat - perkiraanPakaiBerjalan).toFixed(1)));

  // 5. Estimasi Hari Habis Presisi
  const estimasiHari = Math.max(0, Math.floor(sisaKwhSekarang / lajuHarian));

  const tglTarget = new Date();
  tglTarget.setDate(tglTarget.getDate() + estimasiHari);
  const tanggalHabis = tglTarget.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Tentukan status normal berdasarkan sisa hari riil
  let status = 'aman';
  if (estimasiHari <= 3 || sisaKwhSekarang <= 15) {
    status = 'kritis';
  } else if (estimasiHari <= 7 || sisaKwhSekarang <= 35) {
    status = 'waspada';
  }

  const intervalTerakhir = daftarInterval[daftarInterval.length - 1];

  return {
    status,
    sisaKwhTercatat: kwhTercatat,
    sisaKwhEstimasiSekarang: sisaKwhSekarang,
    hariBerlalu,
    rataPerHari: lajuHarian,
    estimasiHari,
    tanggalHabis,
    terakhir: catatanTerakhir,
    sebelumnya: catatanSebelumnya,
    isTopUp: intervalTerakhir && intervalTerakhir.jenis === 'TOP_UP',
    wattTerdeteksi: estimasiWatt,
    keteranganPemakaian: `Laju: ${lajuHarian} kWh/hr (Beban: ±${estimasiWatt} Watt)`
  };
}
