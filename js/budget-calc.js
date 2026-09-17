// js/budget-calc.js - Estimasi anggaran pembelian token listrik PLN

export function hitungEstimasiBiaya(daftarSarana, fungsiHitung, tarifPerKwh = 1500) {
  const saranaKritis = [];
  let totalKwhDibutuhkan = 0;
  let totalEstimasiBiaya = 0;

  daftarSarana.forEach(sarana => {
    const info = fungsiHitung(sarana.riwayatToken);
    if (info.status === 'kritis' || info.status === 'waspada') {
      const rataHarian = parseFloat(info.rataPerHari) || 50;
      // Target isi ulang untuk cadangan 30 hari ke depan
      const kebutuhanKwh = Math.max(50, Math.round((rataHarian * 30) - info.terakhir.kwh));
      const estimasiRp = Math.ceil((kebutuhanKwh * tarifPerKwh) / 50000) * 50000; // Pembulatan kelipatan nominal PLN 50rb

      totalKwhDibutuhkan += kebutuhanKwh;
      totalEstimasiBiaya += estimasiRp;

      saranaKritis.push({
        lokasi: sarana.lokasi,
        tipe: sarana.tipe,
        sisaKwh: info.terakhir.kwh,
        estimasiHari: info.estimasiHari,
        tanggalHabis: info.tanggalHabis,
        kebutuhanKwh,
        estimasiRp
      });
    }
  });

  return {
    saranaKritis,
    totalKwhDibutuhkan,
    totalEstimasiBiaya,
    tarifPerKwh
  };
}
