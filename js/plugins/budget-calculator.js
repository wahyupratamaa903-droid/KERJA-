// js/plugins/budget-calculator.js - Estimasi Anggaran Finansial Target Tgl 10 Bulan Depan

export function hitungEstimasiAnggaranToken(daftarSarana, fnPrediksi) {
  const now = new Date();
  let tgtBulan = now.getMonth() + 1;
  let tgtTahun = now.getFullYear();
  if (tgtBulan > 11) { tgtBulan = 0; tgtTahun++; }
  const tglTarget = new Date(tgtTahun, tgtBulan, 10);
  const selisihHariTarget = Math.max(1, Math.ceil((tglTarget - now) / (1000 * 60 * 60 * 24)));

  const saranaKritis = [];
  let totalPengajuan = 0;

  daftarSarana.forEach(s => {
    const info = fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const sisaHari = info.estimasiHari !== undefined ? info.estimasiHari : 999;
    
    // Titik yang perlu pengisian (sisa hari < 30 hari atau sisa kWh tipis)
    if (sisaHari < 30 || (info.terakhir && Number(info.terakhir.kwh) <= 25)) {
      const jmlLampu = Number(s.jumlahLampu) || 0;
      let nominal = 200000;

      // Lampu 8 FL dialokasikan Rp 500.000, lampu 2-4 dialokasikan Rp 200.000 - Rp 500.000
      if (jmlLampu >= 8 || (s.jenisLampu === 'FL' && jmlLampu > 4)) {
        nominal = 500000;
      } else {
        const laju = info.rataPerHari || 10;
        const butuhKwh = Math.max(0, selisihHariTarget - sisaHari) * laju;
        const biayaKwh = butuhKwh * (500000 / 41330);
        if (biayaKwh > 300000) nominal = 500000;
        else if (biayaKwh > 150000) nominal = 300000;
        else nominal = 200000;
      }

      totalPengajuan += nominal;
      saranaKritis.push({
        ...s,
        info,
        nominal,
        sisaHari
      });
    }
  });

  return {
    saranaKritis,
    totalPengajuan,
    totalTitikKritis: saranaKritis.length,
    selisihHariTarget
  };
}

export function bukaModalAnggaran(daftarSarana, fnPrediksi) {
  const modal = document.getElementById('modal-anggaran');
  const container = document.getElementById('konten-rincian-anggaran');
  if (!modal || !container) return;

  const res = hitungEstimasiAnggaranToken(daftarSarana, fnPrediksi);

  if (res.saranaKritis.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:2rem; margin-bottom:8px;">✅</div>
        <h4 style="color:#10b981; margin-bottom:4px;">Semua Sarana Masih Aman!</h4>
        <p style="font-size:0.75rem; color:#94a3b8;">Tidak ada sarana dengan sisa token di bawah 30 hari.</p>
      </div>
    `;
    modal.style.display = 'flex';
    return;
  }

  const listHtml = res.saranaKritis.map(s => `
    <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(245,158,11,0.3); border-left:4px solid #f59e0b; padding:10px 12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong style="color:#fff; font-size:0.85rem;">${s.lokasi}</strong>
        <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">
          Sisa: ${s.info.terakhir ? s.info.terakhir.kwh.toLocaleString('id-ID') : '-'} kWh • Habis: ±${s.sisaHari} hari
        </div>
      </div>
      <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:4px 8px; border-radius:6px; font-weight:800; font-size:0.8rem; white-space:nowrap;">
        Rp ${s.nominal.toLocaleString('id-ID')}
      </span>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <span style="font-size:0.72rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">TOTAL PENGAJUAN DANA:</span>
      <div style="font-size:1.4rem; font-weight:800; color:#10b981; margin:2px 0 4px 0;">
        Rp ${res.totalPengajuan.toLocaleString('id-ID')}
      </div>
      <span style="font-size:0.72rem; color:#38bdf8;">${res.totalTitikKritis} titik masuk rentang pengajuan (Target Tgl 10 Bulan Depan)</span>
    </div>
    <div style="max-height:300px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
  `;

  modal.style.display = 'flex';
}
