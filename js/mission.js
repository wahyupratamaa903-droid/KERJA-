// js/mission.js - Jadwal Operasional Akurat & Plafon BBM Multi-Periode

export function dapatkanMisiHariIni() {
  const now = new Date();
  const hari = now.getDay(); // 0: Mgg, 1: Sen, 2: Sel, 3: Rab, 4: Kam, 5: Jum, 6: Sab
  const tgl = now.getDate();
  const daftarMisi = [];

  // 1. Setiap awal bulan (tanggal 1-2): Foto seluruh sarana beriklan
  if (tgl >= 1 && tgl <= 2) {
    daftarMisi.push({
      kategori: 'Dokumentasi Awal Bulan',
      judul: 'Foto Seluruh Sarana Beriklan',
      detail: 'Ambil foto dokumentasi visual untuk seluruh titik tiang reklame yang memiliki materi iklan aktif.',
      target: '19 Titik Reklame Bengkulu',
      urgent: true
    });
  }

  // 2. Setiap tanggal 1-4, 10-14, 20-24: Foto HMS Siang & Malam di 4 Lokasi
  const isRentangHms = (tgl >= 1 && tgl <= 4) || (tgl >= 10 && tgl <= 14) || (tgl >= 20 && tgl <= 24);
  if (isRentangHms) {
    daftarMisi.push({
      kategori: `Patroli HMS (Tgl ${tgl})`,
      judul: 'Foto HMS Siang & Malam (4 Lokasi)',
      detail: 'Wajib 2 versi foto (Kamera Timestamp & Kamera Biasa) Siang & Malam di 4 titik:\n1. Jl. Adam Malik\n2. Simpang Skip\n3. Rawa Makmur\n4. Simpang Brimob',
      target: 'Adam Malik, Skip, Rawa Makmur, Brimob',
      urgent: true
    });
  }

  // 3. Setiap Senin: Foto BYD Siang & Malam
  if (hari === 1) {
    daftarMisi.push({
      kategori: 'Rutin Mingguan (Senin)',
      judul: 'Foto BYD Siang & Malam',
      detail: 'Wajib ambil 2 versi dokumentasi: Kamera Timestamp & Kamera Biasa (kondisi Siang dan Malam).',
      target: 'Sarana Billboard BYD',
      urgent: true
    });
  }

  // 4. Setiap Rabu: Setor Foto Kegiatan Kamis - Rabu
  if (hari === 3) {
    daftarMisi.push({
      kategori: 'Pelaporan Mingguan (Rabu)',
      judul: 'Setor Foto Kegiatan & KM Motor',
      detail: 'Kirim rekap dokumentasi pekerjaan dari hari Kamis minggu lalu hingga hari Rabu ini ke Bu Reni di kantor cabang.',
      target: 'Kantor Cabang (Bu Reni)',
      urgent: true
    });
  }

  // Jika hari kerja biasa tanpa jadwal khusus
  if (daftarMisi.length === 0) {
    daftarMisi.push({
      kategori: 'Patroli Reguler',
      judul: 'Monitoring Kelistrikan & KWH Tiang',
      detail: 'Pengecekan rutin sisa token listrik tiang reklame dan kondisi visual tiang di lapangan.',
      target: 'Sarana Prioritas Lapangan',
      urgent: false
    });
  }

  return daftarMisi;
}

export function getStatusBBM() {
  const PLAFON = 50000;
  const sekarang = new Date();
  const hariIni = sekarang.getDay();
  const hariKeKamis = (hariIni >= 4) ? (hariIni - 4) : (hariIni + 3);
  
  const tglKamis = new Date(sekarang);
  tglKamis.setDate(sekarang.getDate() - hariKeKamis);
  
  const tglRabu = new Date(tglKamis);
  tglRabu.setDate(tglKamis.getDate() + 6);
  
  const rentangPeriode = `${tglKamis.getDate()} ${tglKamis.toLocaleString('id-ID', {month:'short'})} s/d ${tglRabu.getDate()} ${tglRabu.toLocaleString('id-ID', {month:'short'})}`;
  const kunciPeriode = `BBM_${tglKamis.getFullYear()}_${tglKamis.getMonth()}_${tglKamis.getDate()}`;

  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  const terpakai = historiSemua
    .filter(x => x.periode === kunciPeriode)
    .reduce((sum, item) => sum + Number(item.nominal), 0);

  return {
    plafon: PLAFON,
    terpakai,
    sisa: Math.max(0, PLAFON - terpakai),
    rentangPeriode,
    kunciPeriode,
    riwayat: historiSemua
  };
}

export function catatIsiBbm(nominal) {
  const status = getStatusBBM();
  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  
  historiSemua.unshift({
    id: Date.now(),
    tanggal: tgl,
    nominal: Number(nominal),
    periode: status.kunciPeriode
  });
  
  localStorage.setItem('devis_bbm_history_all', JSON.stringify(historiSemua));
}
