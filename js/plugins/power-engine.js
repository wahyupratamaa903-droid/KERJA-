// js/plugins/power-engine.js - AI Power-Profiling & Smart Consumption Engine
// Menganalisis seluruh riwayat kWh secara mendalam tanpa merusak data mentah

export function analisaDayaDanEstimasi(riwayatToken, jumlahLampu = 0, jenisLampu = 'FL') {
  if (!riwayatToken || riwayatToken.length === 0) {
    return {
      status: 'aman',
      rataPerHari: 0,
      estimasiHari: 0,
      tanggalHabis: '-',
      pesan: 'Belum ada catatan riwayat token.',
      wattTerdeteksi: 0,
      wattPerLampu: 0,
      statusKelistrikan: 'NORMAL',
      diagnosa: 'Belum ada data',
      tingkatKeyakinan: '0%'
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
      pesan: 'Catatan perdana. Diperlukan 1 kali pengecekan lagi untuk mengaktifkan AI profil daya.',
      terakhir: catatanTerakhir,
      sebelumnya: null,
      wattTerdeteksi: 0,
      wattPerLampu: 0,
      statusKelistrikan: 'MENUNGGU_DATA',
      diagnosa: 'Perlu minimal 2 kali pencatatan untuk membaca beban daya lampu.',
      tingkatKeyakinan: '10%'
    };
  }

  // 2. Evaluasi seluruh interval riwayat untuk memisahkan Konsumsi Murni vs Top-Up
  const daftarInterval = [];
  let totalDeltaKwh = 0;
  let totalHariOperasional = 0;
  let eventTopUpTerdeteksi = false;

  for (let i = 1; i < historiUrut.length; i++) {
    const awal = historiUrut[i - 1];
    const akhir = historiUrut[i];

    const tglAwal = new Date(awal.tanggal);
    const tglAkhir = new Date(akhir.tanggal);
    const selisihHari = Math.max(1, Math.round((tglAkhir - tglAwal) / (1000 * 60 * 60 * 24)));

    const kwhAwal = Number(awal.kwh);
    const kwhAkhir = Number(akhir.kwh);

    if (kwhAkhir > kwhAwal) {
      // Terjadi Pengisian Ulang Token PLN (Top-Up)
      eventTopUpTerdeteksi = true;
      daftarInterval.push({
        jenis: 'TOP_UP',
        tglAwal: awal.tanggal,
        tglAkhir: akhir.tanggal,
        selisihHari,
        deltaKwh: kwhAkhir - kwhAwal
      });
    } else {
      // Konsumsi Pemakaian Listrik Normal
      const deltaPakai = kwhAwal - kwhAkhir;
      const lajuPerHari = deltaPakai / selisihHari;

      daftarInterval.push({
        jenis: 'KONSUMSI',
        tglAwal: awal.tanggal,
        tglAkhir: akhir.tanggal,
        selisihHari,
        deltaKwh: deltaPakai,
        lajuPerHari
      });

      totalDeltaKwh += deltaPakai;
      totalHariOperasional += selisihHari;
    }
  }

  // Ambil hanya interval konsumsi yang valid
  const intervalKonsumsi = daftarInterval.filter(x => x.jenis === 'KONSUMSI');

  // 3. Deteksi Gejala Blackout / Lampu Padam Total (Sisa kWh tidak berkurang sama sekali)
  const intervalTerakhir = daftarInterval[daftarInterval.length - 1];
  let isBlackout = false;
  if (intervalTerakhir && intervalTerakhir.jenis === 'KONSUMSI' && intervalTerakhir.deltaKwh === 0 && intervalTerakhir.selisihHari >= 2) {
    isBlackout = true;
  }

  // 4. Kalkulasi Laju Harian Berbobot Waktu (Weighted Recency Average)
  let lajuHarianFinal = 0;

  if (intervalKonsumsi.length === 0) {
    // Jika semua interval adalah top-up, gunakan patokan standar
    lajuHarianFinal = 15;
  } else if (intervalKonsumsi.length === 1) {
    lajuHarianFinal = intervalKonsumsi[0].lajuPerHari;
  } else {
    // Multi-interval: Beri bobot lebih tinggi pada data konsumsi paling mutakhir
    let totalBobot = 0;
    let akumulasiLaju = 0;

    intervalKonsumsi.forEach((item, index) => {
      // Interval lebih baru memiliki faktor pengali bobot lebih tinggi
      const bobot = (index + 1) * 1.5;
      akumulasiLaju += item.lajuPerHari * bobot;
      totalBobot += bobot;
    });

    lajuHarianFinal = akumulasiLaju / totalBobot;
  }

  // Jaga agar laju tidak negatif atau nol agar pembagian tidak crash
  lajuHarianFinal = Math.max(0.1, Number(lajuHarianFinal.toFixed(2)));

  // 5. Analisa Beban Watt Listrik Nyata (Standar 12 Jam Operasi per Malam)
  // Daya (Watt) = (kWh per hari / 12 jam) * 1000
  const estimasiTotalWatt = Math.round((lajuHarianFinal / 12) * 1000);
  const jmlLampuEfektif = (jenisLampu === 'FL' && Number(jumlahLampu) > 0) ? Number(jumlahLampu) : 1;
  const wattPerTitik = Math.round(estimasiTotalWatt / jmlLampuEfektif);

  // 6. Diagnosa Cerdas Kelistrikan & Anomali
  let statusKelistrikan = 'NORMAL';
  let diagnosa = `Beban operasional terpantau normal (±${wattPerTitik}W/lampu).`;
  let isAnomali = false;

  if (isBlackout) {
    statusKelistrikan = 'BLACKOUT';
    diagnosa = `⚠️ INDIKASI PADAM: Token tidak berkurang selama ${intervalTerakhir.selisihHari} hari. Periksa MCB boks atau timer PLN.`;
  } else if (wattPerTitik > 400 && jenisLampu === 'FL') {
    statusKelistrikan = 'ARUS_BOCOR';
    diagnosa = `🔥 BEBAN TINGGI: Konsumsi terhitung ±${wattPerTitik}W/lampu (melebihi standar). Waspada kabel lecet atau korsleting.`;
    isAnomali = true;
  } else if (wattPerTitik < 30 && jenisLampu === 'FL' && lajuHarianFinal > 0.5) {
    statusKelistrikan = 'LAMPU_MATI_SEBAGIAN';
    diagnosa = `💡 BEBAN RENDAH: Konsumsi hanya ±${wattPerTitik}W/lampu. Kemungkinan ada sebagian lampu sorot yang putus.`;
  }

  // 7. Estimasi Habis Presisi Berdasarkan Profil Daya Terkalibrasi
  const sisaKwhSekarang = Number(catatanTerakhir.kwh);
  const estimasiHari = isBlackout ? 999 : Math.max(0, Math.floor(sisaKwhSekarang / lajuHarianFinal));

  // Hitung Tanggal Habis Nyata
  const tglTarget = new Date();
  tglTarget.setDate(tglTarget.getDate() + estimasiHari);
  const tanggalHabisStr = isBlackout ? 'Tertahan (Lampu Mati)' : tglTarget.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Tentukan Status Warna Kritis / Waspada / Aman
  let status = 'aman';
  if (isBlackout) {
    status = 'waspada';
  } else if (estimasiHari <= 3 || sisaKwhSekarang <= 15) {
    status = 'kritis';
  } else if (estimasiHari <= 7 || sisaKwhSekarang <= 35) {
    status = 'waspada';
  }

  // Tingkat Keyakinan AI (Berdasarkan jumlah riwayat data yang sudah dipelajari)
  const tingkatKeyakinan = historiUrut.length >= 4 ? '95% (Sangat Akurat)' : historiUrut.length === 3 ? '80% (Akurat)' : '65% (Sedang)';

  return {
    status,
    sisaKwh: sisaKwhSekarang,
    rataPerHari: lajuHarianFinal,
    estimasiHari,
    tanggalHabis: tanggalHabisStr,
    terakhir: catatanTerakhir,
    sebelumnya: catatanSebelumnya,
    isTopUp: intervalTerakhir && intervalTerakhir.jenis === 'TOP_UP',
    isBlackout,
    isAnomali,
    wattTerdeteksi: estimasiTotalWatt,
    wattPerLampu: wattPerTitik,
    statusKelistrikan,
    diagnosa,
    tingkatKeyakinan,
    totalIntervalDianalisa: intervalKonsumsi.length,
    keteranganPemakaian: `Konsumsi AI: ${lajuHarianFinal} kWh/hr (Beban: ±${estimasiTotalWatt} Watt)`
  };
}
