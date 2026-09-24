// js/budget-calc.js - Kalkulator Estimasi Anggaran Sesuai Aturan Bu Reni

export function evaluasiKebutuhanPengajuan(sarana, info) {
  const sisa = info.terakhir.kwh;
  const estimasiHari = info.estimasiHari || 999;
  const jmlLampu = Number(sarana.jumlahLampu) || 0;
  const jenisLampu = sarana.jenisLampu || 'FL';

  let perluPengajuan = false;
  let nominalRekomendasi = 0;
  let alasan = '';

  // 1. Kategori 8 Lampu FL
  if (jmlLampu >= 8) {
    if (sisa <= 44898) {
      perluPengajuan = true;
      nominalRekomendasi = 500000;
      alasan = `Lampu 8 titik: Sisa ${sisa.toLocaleString('id-ID')} kWh (Batas Bu Reni: ≤ 44.898)`;
    }
  } 
  // 2. Kategori 4 Lampu FL
  else if (jmlLampu >= 4) {
    if (sisa <= 26000) {
      perluPengajuan = true;
      if (sisa <= 18000 || estimasiHari <= 30) {
        nominalRekomendasi = 500000;
        alasan = `Lampu 4 titik: Sisa ${sisa.toLocaleString('id-ID')} kWh mendekati batas bawah / sisa ≤ 30 hari`;
      } else {
        nominalRekomendasi = 200000;
        alasan = `Lampu 4 titik: Sisa ${sisa.toLocaleString('id-ID')} kWh masuk rentang pengajuan (18rb - 26rb)`;
      }
    }
  } 
  // 3. Kategori 2 Lampu FL
  else if (jmlLampu >= 2) {
    if (sisa <= 20000) {
      perluPengajuan = true;
      if (sisa <= 8000 || estimasiHari <= 30) {
        nominalRekomendasi = 500000;
        alasan = `Lampu 2 titik: Sisa ${sisa.toLocaleString('id-ID')} kWh mendekati batas bawah / sisa ≤ 30 hari`;
      } else {
        nominalRekomendasi = 200000;
        alasan = `Lampu 2 titik: Sisa ${sisa.toLocaleString('id-ID')} kWh masuk rentang pengajuan (4rb - 20rb)`;
      }
    }
  } 
  // 4. Kategori Lainnya (1 Lampu / BL / None)
  else {
    if (sisa <= 10000 || estimasiHari <= 30) {
      perluPengajuan = true;
      nominalRekomendasi = 200000;
      alasan = `Sisa token ${sisa.toLocaleString('id-ID')} kWh (Cadangan < 30 hari)`;
    }
  }

  return {
    perluPengajuan,
    nominalRekomendasi,
    alasan
  };
}

export function hitungEstimasiBiaya(daftarSarana, fungsiHitung) {
  const daftarPengajuan = [];
  let totalEstimasiBiaya = 0;

  daftarSarana.forEach(sarana => {
    const info = fungsiHitung(sarana.riwayatToken);
    const cek = evaluasiKebutuhanPengajuan(sarana, info);

    if (cek.perluPengajuan) {
      totalEstimasiBiaya += cek.nominalRekomendasi;
      daftarPengajuan.push({
        lokasi: sarana.lokasi,
        tipe: sarana.tipe,
        jumlahLampu: sarana.jumlahLampu || 0,
        sisaKwh: info.terakhir.kwh,
        estimasiHari: info.estimasiHari || 0,
        tanggalHabis: info.tanggalHabis || '-',
        nominalRekomendasi: cek.nominalRekomendasi,
        alasan: cek.alasan
      });
    }
  });

  return {
    daftarPengajuan,
    totalEstimasiBiaya
  };
}
