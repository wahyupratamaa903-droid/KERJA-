// js/vault.js - Engine Brankas Data & Mesin Waktu (Zero-Loss System)

const KUNCI_SNAPSHOT = 'devis_time_machine_v1';
const MAKS_SNAPSHOT = 10; // Menyimpan 10 titik waktu terakhir

// 1. Simpan Snapshot Otomatis Setiap Ada Perubahan
export function rekamSnapshotWaktu(daftarSarana) {
  if (!daftarSarana || daftarSarana.length === 0) return;
  try {
    const riwayat = JSON.parse(localStorage.getItem(KUNCI_SNAPSHOT) || '[]');
    const sekarang = new Date();
    const labelWaktu = sekarang.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    const snapshotBaru = {
      id: Date.now(),
      waktu: labelWaktu,
      totalSarana: daftarSarana.length,
      data: daftarSarana
    };

    // Sisipkan di awal, batasi maksimal 10 snapshot
    riwayat.unshift(snapshotBaru);
    if (riwayat.length > MAKS_SNAPSHOT) riwayat.pop();

    localStorage.setItem(KUNCI_SNAPSHOT, JSON.stringify(riwayat));
  } catch (err) {
    console.error("Gagal merekam snapshot waktu:", err);
  }
}

// 2. Ambil Riwayat Snapshot untuk Ditampilkan di Menu Mesin Waktu
export function ambilDaftarSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SNAPSHOT) || '[]');
  } catch (err) {
    return [];
  }
}

// 3. Ekspor Data Fisik Mentah ke File (.json) di HP
export function unduhFileCadangan(daftarSarana) {
  if (!daftarSarana || daftarSarana.length === 0) {
    alert("Belum ada data untuk dicadangkan.");
    return;
  }
  const dataString = JSON.stringify(daftarSarana, null, 2);
  const blob = new Blob([dataString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const tgl = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `CADANGAN_SARANA_DEVIS_${tgl}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 4. Kirim Berkas Cadangan Format Teks ke WhatsApp Pribadi
export function kirimCadanganKeWA(daftarSarana) {
  if (!daftarSarana || daftarSarana.length === 0) {
    alert("Tidak ada data untuk dikirim.");
    return;
  }
  const ringkasan = daftarSarana.map((s, idx) => {
    const terakhir = s.riwayatToken && s.riwayatToken.length > 0 
      ? s.riwayatToken[s.riwayatToken.length - 1] 
      : { kwh: 0, tanggal: '-' };
    const lat = s.koordinat && s.koordinat.lat ? s.koordinat.lat : '-';
    const lng = s.koordinat && s.koordinat.lng ? s.koordinat.lng : '-';
    return `${idx + 1}. *${s.lokasi}*\n   Tipe: ${s.tipe} (${s.jenisLampu || 'FL'})\n   Token: ${terakhir.kwh} kWh (${terakhir.tanggal})\n   GPS: ${lat}, ${lng}`;
  }).join('\n\n');

  const teksPesan = `*BRANKAS DATA LAPANGAN PT DEVIS JAYA*\n_Dicadangkan pada: ${new Date().toLocaleString('id-ID')}_\nTotal Titik: ${daftarSarana.length}\n\n${ringkasan}`;
  const urlWa = `https://wa.me/?text=${encodeURIComponent(teksPesan)}`;
  window.open(urlWa, '_blank');
}
