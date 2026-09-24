// js/mission.js - Modul Manajemen Operasional & Misi Kerja PT DEVIS JAYA

const KUNCI_BBM = 'devis_bbm_cycle_v1';
const KUNCI_VINIL = 'devis_vinil_log_v1';

// 1. Logika Jadwal Otomatis Berdasarkan Hari & Tanggal
export function dapatkanMisiHariIni() {
  const sekarang = new Date();
  const hari = sekarang.getDay(); // 0: Minggu, 1: Senin, ..., 3: Rabu, 4: Kamis
  const tgl = sekarang.getDate();

  const daftarMisi = [];

  // Misi Rutin Senin: BYD Jl. Suprapto
  if (hari === 1) {
    daftarMisi.push({
      id: 'misi-byd',
      kategori: 'Prioritas Klien',
      judul: 'Foto Sarana BYD (Jl. Suprapto)',
      detail: 'Dokumentasi foto siang & malam untuk dikirim ke Pak Alfian (Pusat Jakarta).',
      target: 'Jl. Suprapto Simp. 5 (Diatas Ruko)',
      urgent: true
    });
  }

  // Misi Rutin Tanggal Siklus HMS (1-4, 10-14, 20-24)
  const isSiklusHms = (tgl >= 1 && tgl <= 4) || (tgl >= 10 && tgl <= 14) || (tgl >= 20 && tgl <= 24);
  if (isSiklusHms) {
    daftarMisi.push({
      id: 'misi-hms',
      kategori: `Siklus Rutin (Tgl ${tgl})`,
      judul: 'Patroli 4 Titik Sarana HMS',
      detail: 'Foto kamera biasa & timestamp (3 jarak: dekat, sedang, jauh) siang & malam.',
      target: 'KM 8, Simp Skip TIKI, TB Ken Jaya, Danau Simp Kompi',
      urgent: false
    });
  }

  // Misi Rutin Rabu: Laporan Mingguan & KM Motor
  if (hari === 3) {
    daftarMisi.push({
      id: 'misi-rabu',
      kategori: 'Administrasi Cabang',
      judul: 'Setor Foto Kegiatan & KM Motor',
      detail: 'Kirim rekap kegiatan Kamis pekan lalu s.d. hari ini beserta foto kilometer motor ke Bu Reni.',
      target: 'Kantor Cabang (Bu Reni)',
      urgent: true
    });
  }

  // Misi Awal Bulan (Tgl 1-3): Audit Visual Seluruh Tiang
  if (tgl >= 1 && tgl <= 3) {
    daftarMisi.push({
      id: 'misi-awal-bulan',
      kategori: 'Audit Bulanan',
      judul: 'Keliling Seluruh Titik Sarana Bengkulu',
      detail: 'Foto dokumentasi lengkap seluruh tiang reklame cabang Bengkulu (Kamera biasa + Timemark) untuk Pak Alfian.',
      target: 'Seluruh 18 Titik Bengkulu',
      urgent: true
    });
  }

  return daftarMisi;
}

// 2. Logika Plafon Bensin Mingguan (Kamis - Rabu) Rp50.000
export function getStatusBBM() {
  const sekarang = new Date();
  const data = JSON.parse(localStorage.getItem(KUNCI_BBM) || '{}');
  
  // Tentukan Kamis terakhir sebagai awal periode
  const hari = sekarang.getDay();
  const selisihKeKamis = (hari >= 4) ? (hari - 4) : (hari + 3);
  const kamisIni = new Date(sekarang);
  kamisIni.setDate(sekarang.getDate() - selisihKeKamis);
  const idPeriode = kamisIni.toISOString().split('T')[0];

  let periodeAktif = data[idPeriode];
  if (!periodeAktif) {
    periodeAktif = {
      plafon: 50000,
      terpakai: 0,
      riwayat: []
    };
    data[idPeriode] = periodeAktif;
    localStorage.setItem(KUNCI_BBM, JSON.stringify(data));
  }

  const sisa = Math.max(0, periodeAktif.plafon - periodeAktif.terpakai);
  const sisaHariRabu = (3 - hari + 7) % 7;

  return {
    idPeriode,
    plafon: periodeAktif.plafon,
    terpakai: periodeAktif.terpakai,
    sisa,
    riwayat: periodeAktif.riwayat,
    sisaHariRabu: sisaHariRabu === 0 ? 'Hari ini terakhir!' : `${sisaHariRabu} hari lagi (Rabu)`
  };
}

export function catatIsiBbm(nominal, catatan = '') {
  const sekarang = new Date();
  const data = JSON.parse(localStorage.getItem(KUNCI_BBM) || '{}');
  const info = getStatusBBM();

  data[info.idPeriode].terpakai += Number(nominal);
  data[info.idPeriode].riwayat.push({
    tanggal: sekarang.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    nominal: Number(nominal),
    catatan: catatan || 'Isi Bensin Operasional'
  });

  localStorage.setItem(KUNCI_BBM, JSON.stringify(data));
}

// 3. Log Pengiriman Vinil Sampoerna Rawa Makmur
export function getLogVinil() {
  return JSON.parse(localStorage.getItem(KUNCI_VINIL) || '[]');
}

export function simpanLogVinil(item) {
  const logs = getLogVinil();
  logs.unshift({
    id: Date.now(),
    tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    ...item
  });
  localStorage.setItem(KUNCI_VINIL, JSON.stringify(logs));
}
