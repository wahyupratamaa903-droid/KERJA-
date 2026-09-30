export function getStatusBBM() {
  const PLAFON = 50000;
  const sekarang = new Date();
  const hariIni = sekarang.getDay(); 
  const hariKeKamis = (hariIni >= 4) ? (hariIni - 4) : (hariIni + 3);
  const tglKamis = new Date(sekarang);
  tglKamis.setDate(sekarang.getDate() - hariKeKamis);
  
  const kunciPeriode = `BBM_${tglKamis.getFullYear()}_${tglKamis.getMonth()}_${tglKamis.getDate()}`;
  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  const terpakai = historiSemua.filter(x => x.periode === kunciPeriode).reduce((sum, item) => sum + item.nominal, 0);

  return { plafon: PLAFON, terpakai, sisa: PLAFON - terpakai, rentangPeriode: "Kamis - Rabu", kunciPeriode, riwayat: historiSemua };
}

export function catatIsiBbm(nominal) {
  const status = getStatusBBM();
  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  historiSemua.unshift({ id: Date.now(), tanggal: new Date().toLocaleDateString('id-ID'), nominal, periode: status.kunciPeriode });
  localStorage.setItem('devis_bbm_history_all', JSON.stringify(historiSemua));
}

export function dapatkanMisiHariIni() {
  return [{ kategori: 'Admin', judul: 'Setor Foto', detail: 'Ke Cabang', target: 'Kantor', urgent: true }];
}
