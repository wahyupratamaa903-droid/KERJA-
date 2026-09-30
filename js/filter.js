export function filterSarana(daftarSarana, kataKunci, statusFilter, fnHitungPrediksi, filterTipe, filterLampu) {
  const cari = (kataKunci || '').toLowerCase();
  
  return daftarSarana.filter((s) => {
    const info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    
    let cocokStatus = true;
    if (statusFilter === 'perlu-isi') {
      cocokStatus = (info.status === 'kritis' || info.status === 'waspada');
    } else if (statusFilter === 'aman') {
      cocokStatus = (info.status === 'aman');
    }

    const cocokTeks = !cari || s.lokasi.toLowerCase().includes(cari) || s.tipe.toLowerCase().includes(cari);
    const cocokTipe = filterTipe ? s.tipe === filterTipe : true;
    const cocokLampu = filterLampu ? s.jenisLampu === filterLampu : true;

    return cocokStatus && cocokTeks && cocokTipe && cocokLampu;
  });
}
