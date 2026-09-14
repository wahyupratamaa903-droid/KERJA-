// js/token-calc.js - Perhitungan otomatis daya & durasi token

export function hitungKetahananToken(jumlahLampu, sisaKwh, wattPerLampu = 40, jamNyala = 12) {
  const totalWatt = jumlahLampu * wattPerLampu;
  const pemakaianKwhPerHari = (totalWatt * jamNyala) / 1000;

  if (pemakaianKwhPerHari <= 0) {
    return {
      status: 'aman',
      estimasiHari: 999,
      pemakaianHarian: '0',
      butuhIsi: false
    };
  }

  const estimasiHari = Math.floor(sisaKwh / pemakaianKwhPerHari);

  let status = 'aman';
  if (estimasiHari <= 2) {
    status = 'kritis';
  } else if (estimasiHari <= 5) {
    status = 'waspada';
  }

  return {
    status,
    estimasiHari,
    pemakaianHarian: pemakaianKwhPerHari.toFixed(2),
    butuhIsi: status !== 'aman'
  };
}
