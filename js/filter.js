// js/filter.js - Logika penyaringan nama jalan & status sarana

export function filterSarana(daftar, kataKunci, filterStatusDipilih, fungsiHitung) {
  const keyword = kataKunci.trim().toLowerCase();

  return daftar.filter(item => {
    // Pencarian berdasarkan nama jalan / tipe
    const cocokTeks = item.lokasi.toLowerCase().includes(keyword) || 
                      item.tipe.toLowerCase().includes(keyword);

    if (!cocokTeks) return false;
    if (filterStatusDipilih === 'semua') return true;

    const info = fungsiHitung(item.riwayatToken);

    if (filterStatusDipilih === 'perlu-isi') {
      return info.status === 'kritis' || info.status === 'waspada';
    }

    return info.status === filterStatusDipilih;
  });
}
