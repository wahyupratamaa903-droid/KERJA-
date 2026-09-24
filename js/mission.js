// js/mission.js - Modul Misi Harian & Plafon BBM PT DEVIS JAYA

const KUNCI_BBM = 'devis_bbm_cycle_v2';

export function dapatkanMisiHariIni() {
  const sekarang = new Date();
  const hari = sekarang.getDay(); // 0: Minggu, 1: Senin, ..., 4: Kamis, 5: Jumat, 6: Sabtu
  const tgl = sekarang.getDate();

  // Tangani Hari Libur (Sabtu & Minggu)
  if (hari === 0 || hari === 6) {
    return [{
      id: 'misi-libur',
      kategori: 'Hari Libur',
      judul: 'Sabtu & Minggu Libur Operasional',
      detail: 'Tidak ada jadwal patroli kantor hari ini. Selamat beristirahat.',
      target: 'Kantor Libur',
      urgent: false
    }];
  }

  const daftarMisi = [];

  // Misi Rutin Senin: BYD Jl. Suprapto
  if (hari === 1) {
    daftarMisi.push({
      id: 'misi-byd',
      kategori: 'Wajib Senin',
      judul: 'Foto Sarana BYD (Jl. Suprapto)',
      detail: 'Dokumentasi foto siang & malam untuk dikirim ke Pak Alfian (Pusat Jakarta).',
      target: 'Jl. Suprapto Simp. 5 (Diatas Ruko)',
      urgent: true
    });
  }

  // Misi Rutin Siklus HMS (1-4, 10-14, 20-24)
  const isSiklusHms = (tgl >= 1 && tgl <= 4) || (tgl >= 10 && tgl <= 14) || (tgl >= 20 && tgl <= 24);
  if (isSiklusHms) {
    daftarMisi.push({
      id: 'misi-hms',
      kategori: `Siklus Rutin (Tgl ${tgl})`,
      judul: 'Patroli 4 Titik Sarana HMS',
      detail: 'Foto kamera biasa & timestamp (3 jarak) siang & malam.',
      target: 'KM 8, Simp Skip TIKI, TB Ken Jaya, Danau Simp Kompi',
      urgent: false
    });
  }

  // Misi Rutin Rabu: Rekap Mingguan & Spidometer Motor
  if (hari === 3) {
    daftarMisi.push({
      id: 'misi-rabu',
      kategori: 'Administrasi Cabang',
      judul: 'Setor Foto Kegiatan & KM Motor',
      detail: 'Kirim rekap kegiatan mingguan dan foto kilometer motor ke Bu Reni.',
      target: 'Kantor Cabang (Bu Reni)',
      urgent: true
    });
  }

  // Misi Awal Bulan (Tgl 1-3): Audit Seluruh Tiang
  if (tgl >= 1 && tgl <= 3) {
    daftarMisi.push({
      id: 'misi-awal-bulan',
      kategori: 'Audit Bulanan',
      judul: 'Patroli Seluruh Titik Sarana Bengkulu',
      detail: 'Foto lengkap 18 titik tiang reklame cabang Bengkulu untuk Pak Alfian.',
      target: 'Seluruh 18 Titik Bengkulu',
      urgent: true
    });
  }

  return daftarMisi;
}

// Logika BBM Mingguan (Kamis - Rabu)
export function getStatusBBM() {
  const sekarang = new Date();
  const hari = sekarang.getDay();
  
  // Tentukan hari Kamis sebagai awal periode
  const selisihKeKamis = (hari >= 4) ? (hari - 4) : (hari + 3);
  const tglAwalKamis = new Date(sekarang);
  tglAwalKamis.setDate(sekarang.getDate() - selisihKeKamis);
  tglAwalKamis.setHours(0, 0, 0, 0);

  // Akhir periode selalu hari Rabu berikutnya
  const tglAkhirRabu = new Date(tglAwalKamis);
  tglAkhirRabu.setDate(tglAwalKamis.getDate() + 6);

  const idPeriode = tglAwalKamis.toISOString().split('T')[0];
  const dataSemua = JSON.parse(localStorage.getItem(KUNCI_BBM) || '{}');

  if (!dataSemua[idPeriode]) {
    dataSemua[idPeriode] = {
      plafon: 50000,
      terpakai: 0,
      riwayat: []
    };
    localStorage.setItem(KUNCI_BBM, JSON.stringify(dataSemua));
  }

  const aktif = dataSemua[idPeriode];
  const sisa = Math.max(0, aktif.plafon - aktif.terpakai);

  const opsiTgl = { day: 'numeric', month: 'short' };
  const labelRentang = `${tglAwalKamis.toLocaleDateString('id-ID', opsiTgl)} s/d ${tglAkhirRabu.toLocaleDateString('id-ID', opsiTgl)}`;

  return {
    idPeriode,
    rentangPeriode: labelRentang,
    plafon: aktif.plafon,
    terpakai: aktif.terpakai,
    sisa,
    riwayat: aktif.riwayat || []
  };
}

export function catatIsiBbm(nominal) {
  const sekarang = new Date();
  const info = getStatusBBM();
  const dataSemua = JSON.parse(localStorage.getItem(KUNCI_BBM) || '{}');

  dataSemua[info.idPeriode].terpakai += Number(nominal);
  dataSemua[info.idPeriode].riwayat.unshift({
    tanggal: sekarang.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
    nominal: Number(nominal)
  });

  localStorage.setItem(KUNCI_BBM, JSON.stringify(dataSemua));
}

export function resetBbmPeriodeIni() {
  const info = getStatusBBM();
  const dataSemua = JSON.parse(localStorage.getItem(KUNCI_BBM) || '{}');
  dataSemua[info.idPeriode] = {
    plafon: 50000,
    terpakai: 0,
    riwayat: []
  };
  localStorage.setItem(KUNCI_BBM, JSON.stringify(dataSemua));
}
