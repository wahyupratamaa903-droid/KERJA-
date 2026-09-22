// js/budget-calc.js - Estimasi anggaran pembelian token PLN (standar kantor Rp500.000/titik)

export function hitungEstimasiBiaya(daftarSarana, fungsiHitung) {
  const saranaKritis = [];
  let totalEstimasiBiaya = 0;

  daftarSarana.forEach(sarana => {
    const info = fungsiHitung(sarana.riwayatToken);
    // Hanya sarana yang benar-benar mendekati habis (kritis / waspada)
    if (info.status === 'kritis' || info.status === 'waspada') {
      const estimasiRp = 500000; // Paket nominal token operasional standar
      totalEstimasiBiaya += estimasiRp;

      saranaKritis.push({
        lokasi: sarana.lokasi,
        tipe: sarana.tipe,
        sisaKwh: info.terakhir.kwh,
        estimasiHari: info.estimasiHari,
        tanggalHabis: info.tanggalHabis,
        estimasiRp
      });
    }
  });

  return {
    saranaKritis,
    totalEstimasiBiaya
  };
}
