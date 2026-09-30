// js/mission.js - Manajemen Misi Lapangan & BBM Permanen (Multi-Periode)

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
  
  // Hitung pemakaian periode aktif saja
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

export function dapatkanMisiHariIni() {
  return [
    {
      kategori: 'Administrasi Lapangan',
      judul: 'Dokumentasi Tiang & Kilometer Motor',
      detail: 'Rekap kondisi fisik lampu reklame dan kilometer operasional mingguan.',
      target: 'Kantor Cabang',
      urgent: true
    }
  ];
}
