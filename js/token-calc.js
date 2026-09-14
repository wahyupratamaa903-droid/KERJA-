// js/token-calc.js - Logika perhitungan daya & status token

export function hitungKetahananToken(jumlahLampu, wattPerLampu, sisaKwh, jamNyala = 12) {
  const totalWatt = jumlahLampu * wattPerLampu;
  const pemakaianKwhPerHari = (totalWatt * jamNyala) / 1000;

  if (pemakaianKwhPerHari <= 0) {
    return {
      status: 'aman',
      hariTersisa: Infinity,
      pesan: 'Beban lampu 0 Watt'
    };
  }

  const estimasiHari = Math.floor(sisaKwh / pemakaianKwhPerHari);

  // Jika token sisa kurang dari 3 hari, beri tanda waspada/merah
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
