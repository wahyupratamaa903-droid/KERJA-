// js/vault.js - Brankas Data & Mesin Waktu Mandiri

export function rekamSnapshotWaktu(dataSarana) {
  if (!dataSarana || dataSarana.length === 0) return;
  const list = JSON.parse(localStorage.getItem('devis_time_machine_snapshots') || '[]');
  const now = new Date();
  const labelWaktu = `${now.getDate()} ${now.toLocaleString('id-ID', {month:'short'})}, ${String(now.getHours()).padStart(2,'0')}.${String(now.getMinutes()).padStart(2,'0')}`;
  
  list.unshift({
    waktu: labelWaktu,
    total: dataSarana.length,
    data: dataSarana
  });

  localStorage.setItem('devis_time_machine_snapshots', JSON.stringify(list.slice(0, 8)));
}

export function ambilDaftarSnapshot() {
  return JSON.parse(localStorage.getItem('devis_time_machine_snapshots') || '[]');
}

export function unduhCadanganJson(dataSarana) {
  const blob = new Blob([JSON.stringify(dataSarana, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Backup_Sarana_DevisJaya_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

export function kirimCadanganWhatsApp(dataSarana) {
  const ringkasan = dataSarana.map((s, i) => `${i+1}. ${s.lokasi} (${s.riwayatToken.length} riwayat)`).join('\n');
  const teks = encodeURIComponent(`*CADANGAN DATA PT DEVIS JAYA*\nTotal: ${dataSarana.length} Titik\n\n${ringkasan}`);
  window.open(`https://api.whatsapp.com/send?text=${teks}`, '_blank');
}
