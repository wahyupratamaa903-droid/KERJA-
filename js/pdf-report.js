// js/pdf-report.js - Laporan Resmi PDF Berdasarkan Acuan Pengajuan Bu Reni

export function cetakDokumenPdfResmi(daftarSarana, fungsiHitung, dataAnggaran) {
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let barisPrioritas = '';
  if (dataAnggaran.daftarPengajuan.length === 0) {
    barisPrioritas = `<tr><td colspan="6" style="text-align:center; padding:10px; color:#10b981;">Semua titik sarana dalam kondisi aman di atas batas pengajuan.</td></tr>`;
  } else {
    dataAnggaran.daftarPengajuan.forEach((item, idx) => {
      barisPrioritas += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${item.lokasi}</strong> (${item.tipe})</td>
          <td style="text-align:center;">${item.jumlahLampu} FL</td>
          <td style="text-align:right;">${item.sisaKwh.toLocaleString('id-ID')} kWh</td>
          <td>${item.alasan}</td>
          <td style="text-align:right; font-weight:bold; color:#047857;">Rp ${item.nominalRekomendasi.toLocaleString('id-ID')}</td>
        </tr>
      `;
    });
  }

  let barisInventaris = '';
  daftarSarana.forEach((item, idx) => {
    const info = fungsiHitung(item.riwayatToken);
    const statusLabel = info.status === 'kritis' ? 'PERLU DIISI' : info.status === 'waspada' ? 'WASPADA' : 'AMAN';
    const warna = info.status === 'kritis' ? '#ef4444' : info.status === 'waspada' ? '#f59e0b' : '#10b981';

    barisInventaris += `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${item.lokasi}</strong></td>
        <td>${item.tipe} / ${item.jenisLampu || '-'} (${item.jumlahLampu || 0} Titik)</td>
        <td style="text-align:right;">${info.terakhir.kwh.toLocaleString('id-ID')} kWh</td>
        <td style="text-align:center;">${info.estimasiHari ? info.estimasiHari + ' hari' : '-'}</td>
        <td style="text-align:center; font-weight:bold; color:${warna};">${statusLabel}</td>
      </tr>
    `;
  });

  let lampiranFotoHtml = '';
  daftarSarana.forEach((item) => {
    if (item.fotos && item.fotos.length > 0) {
      lampiranFotoHtml += `
        <div style="margin-bottom:14px; page-break-inside:avoid;">
          <div style="font-weight:bold; font-size:11pt; margin-bottom:4px;">Titik: ${item.lokasi} (${item.tipe})</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${item.fotos.map(f => `<img src="${f}" style="width:140px; height:105px; object-fit:cover; border:1px solid #ccc; border-radius:4px;">`).join('')}
          </div>
        </div>
      `;
    }
  });

  const isiHtml = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Laporan Pengajuan Token - ${tglCetak}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; padding: 20px; font-size: 10pt; line-height: 1.4; }
        .kop { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; text-align: center; }
        .kop h2 { margin: 0; font-size: 14pt; text-transform: uppercase; }
        .kop p { margin: 2px 0 0 0; font-size: 9pt; color: #444; }
        .info-rekap { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 9.5pt; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        th, td { border: 1px solid #777; padding: 6px 8px; font-size: 8.5pt; }
        th { background-color: #f1f5f9; text-align: left; }
        .sub-judul { font-size: 10.5pt; font-weight: bold; margin: 16px 0 6px 0; border-left: 4px solid #2563eb; padding-left: 8px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px; background:#e0f2fe; padding:10px; border-radius:6px; text-align:center;">
        <button onclick="window.print()" style="padding:8px 18px; font-weight:bold; background:#0284c7; color:#fff; border:none; border-radius:6px; cursor:pointer;">
          📄 Klik Simpan sebagai PDF / Cetak Dokumen
        </button>
      </div>

      <div class="kop">
        <h2>Laporan Pengajuan Token Listrik Reklame</h2>
        <p>PT DEVIS JAYA • Cabang Bengkulu • Tanggal Dokumen: ${tglCetak}</p>
      </div>

      <div class="info-rekap">
        <div>Total Sarana Terdaftar: <strong>${daftarSarana.length} Titik</strong></div>
        <div>Waktunya Pengajuan: <strong style="color:#b91c1c;">${dataAnggaran.daftarPengajuan.length} Titik</strong></div>
        <div>Total Pengajuan Dana: <strong style="color:#047857;">Rp ${dataAnggaran.totalEstimasiBiaya.toLocaleString('id-ID')}</strong></div>
      </div>

      <div class="sub-judul">1. Rekomendasi Pengajuan Voucher Token PLN (Sesuai Batas Bu Reni)</div>
      <table>
        <thead>
          <tr>
            <th style="width:25px; text-align:center;">No</th>
            <th>Lokasi Titik Sarana</th>
            <th style="width:50px; text-align:center;">Lampu</th>
            <th style="width:75px; text-align:right;">Sisa Token</th>
            <th>Keterangan / Alasan Pengajuan</th>
            <th style="width:90px; text-align:right;">Rekomendasi</th>
          </tr>
        </thead>
        <tbody>
          ${barisPrioritas}
        </tbody>
      </table>

      <div class="sub-judul">2. Status Lengkap Seluruh Sarana Lapangan</div>
      <table>
        <thead>
          <tr>
            <th style="width:25px; text-align:center;">No</th>
            <th>Lokasi Titik</th>
            <th>Tipe / Konfigurasi</th>
            <th style="width:80px; text-align:right;">Sisa Token</th>
            <th style="width:65px; text-align:center;">Estimasi</th>
            <th style="width:70px; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${barisInventaris}
        </tbody>
      </table>

      <div class="sub-judul" style="page-break-before:always;">3. Lampiran Dokumentasi Lapangan</div>
      ${lampiranFotoHtml || '<p style="color:#777;">Tidak ada lampiran foto dokumentasi.</p>'}
    </body>
    </html>
  `;

  const jendelaCetak = window.open('', '_blank');
  jendelaCetak.document.write(isiHtml);
  jendelaCetak.document.close();
}
