// js/pdf-report.js - Laporan Pengajuan Formal PT DEVIS JAYA
import { hitungEstimasiAnggaranToken } from './plugins/budget-calculator.js';

export function generatePDFLaporan(daftarSarana, fnPrediksi) {
  const estimasi = hitungEstimasiAnggaranToken(daftarSarana, fnPrediksi);
  const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const barisTabel1 = estimasi.saranaKritis.map((s, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td><strong>${s.lokasi}</strong> (${s.tipe})</td>
      <td style="text-align:center;">${s.jumlahLampu || 0} ${s.jenisLampu}</td>
      <td style="text-align:center;">${s.info.terakhir ? s.info.terakhir.kwh.toLocaleString('id-ID') : '-'} kWh</td>
      <td>Lampu ${s.jumlahLampu || 0} titik; Sisa ${s.info.terakhir ? s.info.terakhir.kwh : '-'} kWh (Target tgl 10 bulan depan)</td>
      <td style="text-align:right; font-weight:bold; color:#047857;">Rp ${s.nominal.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const barisTabel2 = daftarSarana.map((s, idx) => {
    const info = fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const sisa = info.terakhir ? `${info.terakhir.kwh.toLocaleString('id-ID')} kWh` : '-';
    const est = info.estimasiHari !== undefined ? `±${info.estimasiHari} hari` : '-';
    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${s.lokasi}</td>
        <td>${s.tipe} / ${s.jenisLampu} (${s.jumlahLampu || 0} Titik)</td>
        <td style="text-align:center;">${sisa}</td>
        <td style="text-align:center;">${est}</td>
        <td style="text-align:center; font-weight:bold; color:${info.status === 'kritis' ? '#b91c1c' : info.status === 'waspada' ? '#b45309' : '#047857'};">${info.status.toUpperCase()}</td>
      </tr>
    `;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan Pengajuan Token Listrik Reklame</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }
        .btn-print { display: block; width: 100%; padding: 10px; background: #0284c7; color: #fff; text-align: center; text-decoration: none; font-weight: bold; border-radius: 4px; margin-bottom: 20px; }
        @media print { .btn-print { display: none; } }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 20px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
        th { background: #f8fafc; font-weight: bold; }
        .header-dokumen { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
        .meta-bar { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <a href="javascript:window.print()" class="btn-print">🖨️ Klik Simpan sebagai PDF / Cetak Dokumen</a>
      <div class="header-dokumen">
        <h2 style="margin:0 0 4px 0;">LAPORAN PENGAJUAN TOKEN LISTRIK REKLAME</h2>
        <div style="font-size:11px; color:#475569;">PT DEVIS JAYA • Cabang Bengkulu • Tanggal Dokumen: ${now}</div>
      </div>
      <div class="meta-bar">
        <span>Total Sarana Terdaftar: ${daftarSarana.length} Titik</span>
        <span style="color:#b91c1c;">Waktunya Pengajuan: ${estimasi.totalTitikKritis} Titik</span>
        <span style="color:#047857;">Total Pengajuan Dana: Rp ${estimasi.totalPengajuan.toLocaleString('id-ID')}</span>
      </div>

      <h4 style="margin:12px 0 4px 0;">1. Rekomendasi Pengajuan Voucher Token PLN (Target Tanggal 10 Bulan Depan)</h4>
      <table>
        <thead>
          <tr>
            <th style="width:30px;">No</th>
            <th>Lokasi Titik Sarana</th>
            <th style="width:70px;">Lampu</th>
            <th style="width:90px;">Sisa Token</th>
            <th>Keterangan / Alasan Pengajuan</th>
            <th style="width:100px;">Rekomendasi</th>
          </tr>
        </thead>
        <tbody>
          ${barisTabel1.length > 0 ? barisTabel1 : '<tr><td colspan="6" style="text-align:center;">Seluruh sarana masih aman di atas 30 hari.</td></tr>'}
        </tbody>
      </table>

      <h4 style="margin:12px 0 4px 0;">2. Status Lengkap Seluruh Sarana Lapangan</h4>
      <table>
        <thead>
          <tr>
            <th style="width:30px;">No</th>
            <th>Lokasi Titik</th>
            <th>Tipe / Konfigurasi</th>
            <th style="width:90px;">Sisa Token</th>
            <th style="width:80px;">Estimasi</th>
            <th style="width:80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${barisTabel2}
        </tbody>
      </table>

      <h4 style="margin:12px 0 4px 0;">3. Lampiran Dokumentasi Lapangan</h4>
      <p style="color:#64748b; font-style:italic;">Lampiran foto fisik meteran dan tiang tersinkronisasi di sistem digital lapangan.</p>
    </body>
    </html>
  `);
  win.document.close();
}
