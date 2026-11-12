// MODUL MANDIRI 1: ESTIMASI ANGGARAN TOKEN PRESISI TINGGI (TARGET TGL 20 BULAN DEPAN)
import { panggilAICerdas, ucapkanSuaraStudio } from './ai-router.js';

const KWH_PER_100RB = 8266;  // Patokan riil: Rp 100.000 = 8.266 kWh (Rp 500.000 = 41.330 kWh)

// Kalibrasi laju harian yang akurat (mencegah bug ±0 hari akibat lonjakan riwayat)
function hitungLajuDanSisaAkurat(riwayatToken, jumlahLampu, jenisLampu, infoDasar) {
  const jml = Number(jumlahLampu) || 2;
  // Standar konsumsi normal per hari dalam satuan digit meteran Anda
  const standarPerLampu = jenisLampu === 'BL' ? 120 : 185;
  const lajuStandar = Math.max(150, jml * standarPerLampu);

  let lajuPakai = Number(infoDasar.rataPerHari) || lajuStandar;
  // Jika laju dari riwayat terlalu ekstrem (misal > 3x standar karena salah tanggal/topup), normalkan
  if (lajuPakai > lajuStandar * 3 || lajuPakai < 50) {
    lajuPakai = Math.round((lajuStandar * 0.7) + (Math.min(lajuPakai, lajuStandar * 2.5) * 0.3));
  }

  const historiUrut = [...(riwayatToken || [])].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  const catatanTerakhir = historiUrut[0] || { kwh: 0, tanggal: new Date().toISOString().split('T')[0] };
  const kwhTerakhir = Number(catatanTerakhir.kwh) || 0;

  // Hitung berapa hari sudah berlalu sejak tanggal pencatatan terakhir sampai hari ini
  const tglCatat = new Date(catatanTerakhir.tanggal);
  const sekarang = new Date();
  const selisihMs = sekarang - tglCatat;
  const hariBerlalu = Math.max(0, Math.floor(selisihMs / (1000 * 60 * 60 * 24)));

  // Sisa kWh estimasi hari ini (Real-time)
  const pemakaianSejakCatat = Math.round(hariBerlalu * lajuPakai);
  const sisaKwhHariIni = Math.max(0, kwhTerakhir - pemakaianSejakCatat);
  const sisaHariDariSekarang = lajuPakai > 0 ? Math.floor(sisaKwhHariIni / lajuPakai) : 999;

  return {
    kwhTerakhir,
    tglTerakhir: catatanTerakhir.tanggal,
    hariBerlalu,
    sisaKwhHariIni,
    lajuPakai: Math.round(lajuPakai),
    sisaHariDariSekarang
  };
}

export function hitungEstimasiAnggaranToken(daftarSarana, fnPrediksi) {
  const now = new Date();
  let tgtBulan = now.getMonth() + 1;
  let tgtTahun = now.getFullYear();
  if (tgtBulan > 11) { tgtBulan = 0; tgtTahun++; }

  // TARGET MUTLAK: TANGGAL 20 BULAN DEPAN
  const tglTarget20 = new Date(tgtTahun, tgtBulan, 20);
  const hariKeTgl20 = Math.max(1, Math.ceil((tglTarget20 - now) / (1000 * 60 * 60 * 24)));
  const labelTarget = tglTarget20.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const saranaKritis = [];
  let totalPengajuan = 0;

  (daftarSarana || []).forEach(s => {
    if (s.jenisLampu === 'NONE' || s.isBerlampu === false) return;
    const infoDasar = fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const akurasi = hitungLajuDanSisaAkurat(s.riwayatToken, s.jumlahLampu, s.jenisLampu, infoDasar);

    // Filter sarana yang sisa harinya di bawah 30 hari
    if (akurasi.sisaHariDariSekarang < 30) {
      const jmlLampu = Number(s.jumlahLampu) || 2;
      const totalKwhDibutuhkan = hariKeTgl20 * akurasi.lajuPakai;
      const defisitKwh = Math.max(0, totalKwhDibutuhkan - akurasi.sisaKwhHariIni);

      // Hitung kelipatan Rp 100.000 (8.266 kWh) yang dibutuhkan agar cukup sampai Tgl 20 bulan depan
      let kelipatan100rb = Math.ceil(defisitKwh / KWH_PER_100RB);
      if (kelipatan100rb < 1) kelipatan100rb = 1;

      let nominal = kelipatan100rb * 100000;
      if (jmlLampu >= 8 && nominal < 500000) nominal = 500000;
      if (jmlLampu >= 2 && jmlLampu <= 4 && nominal < 200000 && defisitKwh > KWH_PER_100RB * 0.8) {
        nominal = 200000;
      }

      const kwhDidapat = Math.round((nominal / 100000) * KWH_PER_100RB);
      const totalKwhNanti = akurasi.sisaKwhHariIni + kwhDidapat;
      const totalHariBertahan = Math.floor(totalKwhNanti / akurasi.lajuPakai);

      const tglHabisBaru = new Date(now);
      tglHabisBaru.setDate(now.getDate() + totalHariBertahan);
      const labelHabisBaru = tglHabisBaru.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

      totalPengajuan += nominal;
      saranaKritis.push({
        ...s,
        info: infoDasar,
        akurasi,
        nominal,
        kwhDidapat,
        defisitKwh: Math.round(defisitKwh),
        totalKwhNanti,
        totalHariBertahan,
        labelHabisBaru,
        cukupSampaiTgl20: totalHariBertahan >= hariKeTgl20
      });
    }
  });

  saranaKritis.sort((a, b) => a.akurasi.sisaHariDariSekarang - b.akurasi.sisaHariDariSekarang);

  return {
    saranaKritis,
    totalPengajuan,
    totalTitikKritis: saranaKritis.length,
    hariKeTgl20,
    labelTarget
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
        <h4 style="color:#10b981; margin-bottom:4px;">Semua Sarana Berlampu Aman!</h4>
        <p style="font-size:0.75rem; color:#94a3b8;">Tidak ada sarana di bawah 30 hari. Seluruhnya aman melewati ${res.labelTarget}.</p>
      </div>
    `;
    modal.style.display = 'flex';
    return;
  }

  const listHtml = res.saranaKritis.map((s, idx) => `
    <div class="item-anggaran-kartu" data-idx="${idx}" style="background:rgba(15,23,42,0.8); border:1px solid rgba(245,158,11,0.3); border-left:4px solid ${s.akurasi.sisaHariDariSekarang <= 7 ? '#ef4444' : '#f59e0b'}; padding:10px 12px; border-radius:8px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <strong style="color:#fff; font-size:0.84rem;">${idx + 1}. ${s.lokasi}</strong>
          <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">
            ${s.jumlahLampu || 2} Lampu ${s.jenisLampu} • Pemakaian: <strong>~${s.akurasi.lajuPakai.toLocaleString('id-ID')} kWh/hari</strong>
          </div>
        </div>
        <span id="badge-rp-${idx}" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:4px 8px; border-radius:6px; font-weight:800; font-size:0.78rem; white-space:nowrap;">
          Rp ${s.nominal.toLocaleString('id-ID')}
        </span>
      </div>

      <div style="background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px; margin-top:6px; font-size:0.68rem; color:#cbd5e1;">
        <div>📌 Tercatat (${s.akurasi.tglTerakhir}): <strong>${s.akurasi.kwhTerakhir.toLocaleString('id-ID')} kWh</strong></div>
        <div style="color:#38bdf8; margin-top:2px;">
          ⏱️ Est. Sisa Hari Ini: <strong>${s.akurasi.sisaKwhHariIni.toLocaleString('id-ID')} kWh</strong> (Habis ±${s.akurasi.sisaHariDariSekarang} hari lagi)
        </div>
      </div>

      <!-- SIMULASI PILIHAN VOUCHER (100RB = 8.266 KWH) -->
      <div style="margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:4px;">
        <span style="font-size:0.65rem; color:#94a3b8;">Ubah Voucher:</span>
        <div style="display:flex; gap:4px;">
          ${[100000, 200000, 300000, 400000, 500000].map(nom => `
            <button type="button" class="btn-sim-voucher" data-idx="${idx}" data-nom="${nom}" style="padding:3px 6px; font-size:0.65rem; border-radius:4px; border:1px solid rgba(255,255,255,0.15); background:${s.nominal === nom ? '#2563eb' : '#1e293b'}; color:#fff; cursor:pointer;">
              ${nom / 1000}rb
            </button>
          `).join('')}
        </div>
      </div>

      <div id="info-hasil-sim-${idx}" style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.69rem; display:flex; justify-content:space-between;">
        <span style="color:#cbd5e1;">+Dapat: <strong>${s.kwhDidapat.toLocaleString('id-ID')} kWh</strong></span>
        <span style="color:${s.cukupSampaiTgl20 ? '#34d399' : '#fbbf24'}; font-weight:700;">
          ${s.cukupSampaiTgl20 ? `✓ Cukup s/d ${s.labelHabisBaru} (${s.totalHariBertahan} hari)` : `⚠ Sampai ${s.labelHabisBaru} (${s.totalHariBertahan} hari)`}
        </span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(56,189,248,0.3); padding:12px; border-radius:8px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.68rem; color:#93c5fd; font-weight:700;">TARGET: ${res.labelTarget.toUpperCase()} (${res.hariKeTgl20} HARI LAGI)</span>
        <span style="font-size:0.65rem; color:#10b981; background:rgba(16,185,129,0.15); padding:2px 6px; border-radius:4px;">100rb = 8.266 kWh</span>
      </div>
      <div id="total-pengajuan-dinamis" style="font-size:1.4rem; font-weight:800; color:#10b981; margin:4px 0;">
        Rp ${res.totalPengajuan.toLocaleString('id-ID')}
      </div>
      <div style="font-size:0.7rem; color:#cbd5e1;">${res.totalTitikKritis} sarana kritis (<30 hari) diurutkan dari yang paling darurat</div>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button type="button" id="btn-tanya-ai-cfo" style="flex:2; background:linear-gradient(90deg,#0284c7,#2563eb); color:#fff; border:none; padding:8px; border-radius:6px; font-size:0.73rem; font-weight:700; cursor:pointer;">
          🧠 Analisis AI (Target 20 Bulan Depan)
        </button>
        <button type="button" id="btn-suara-anggaran" style="flex:1; background:#0f766e; color:#fff; border:none; padding:8px; border-radius:6px; font-size:0.73rem; font-weight:700; cursor:pointer;">
          🔊 Bacakan
        </button>
      </div>
      <div id="box-hasil-ai-cfo" style="display:none; margin-top:8px; padding:10px; background:rgba(0,0,0,0.45); border:1px solid rgba(56,189,248,0.25); border-radius:6px; font-size:0.72rem; color:#e2e8f0; line-height:1.45; max-height:160px; overflow-y:auto;"></div>
    </div>
    <div style="max-height:240px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
  `;

  modal.style.display = 'flex';

  // Interaksi tombol simulasi nominal voucher per kartu
  container.querySelectorAll('.btn-sim-voucher').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const nomBaru = Number(btn.dataset.nom);
      const item = res.saranaKritis[idx];
      item.nominal = nomBaru;
      item.kwhDidapat = Math.round((nomBaru / 100000) * KWH_PER_100RB);
      item.totalKwhNanti = item.akurasi.sisaKwhHariIni + item.kwhDidapat;
      item.totalHariBertahan = Math.floor(item.totalKwhNanti / item.akurasi.lajuPakai);
      item.cukupSampaiTgl20 = item.totalHariBertahan >= res.hariKeTgl20;

      const tglBaru = new Date();
      tglBaru.setDate(tglBaru.getDate() + item.totalHariBertahan);
      item.labelHabisBaru = tglBaru.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

      // Update tampilan kartu & total
      container.querySelector(`#badge-rp-${idx}`).textContent = `Rp ${nomBaru.toLocaleString('id-ID')}`;
      container.querySelector(`#info-hasil-sim-${idx}`).innerHTML = `
        <span style="color:#cbd5e1;">+Dapat: <strong>${item.kwhDidapat.toLocaleString('id-ID')} kWh</strong></span>
        <span style="color:${item.cukupSampaiTgl20 ? '#34d399' : '#fbbf24'}; font-weight:700;">
          ${item.cukupSampaiTgl20 ? `✓ Cukup s/d ${item.labelHabisBaru} (${item.totalHariBertahan} hari)` : `⚠ Sampai ${item.labelHabisBaru} (${item.totalHariBertahan} hari)`}
        </span>
      `;
      container.querySelectorAll(`.btn-sim-voucher[data-idx="${idx}"]`).forEach(b => {
        b.style.background = Number(b.dataset.nom) === nomBaru ? '#2563eb' : '#1e293b';
      });

      const totalBaru = res.saranaKritis.reduce((sum, x) => sum + x.nominal, 0);
      container.querySelector('#total-pengajuan-dinamis').textContent = `Rp ${totalBaru.toLocaleString('id-ID')}`;
    };
  });

  // Tombol Bacakan Suara Studio ElevenLabs (Rekomendasi #2)
  const btnSuara = container.querySelector('#btn-suara-anggaran');
  if (btnSuara) {
    btnSuara.onclick = () => {
      const totalSekarang = res.saranaKritis.reduce((sum, x) => sum + x.nominal, 0);
      const kalimat = `Laporan estimasi anggaran menuju tanggal 20 bulan depan. Terdapat ${res.saranaKritis.length} titik sarana kritis dengan total pengajuan dana sebesar ${totalSekarang.toLocaleString('id-ID')} rupiah. Prioritas pertama adalah ${res.saranaKritis[0].lokasi} dengan sisa sekitar ${res.saranaKritis[0].akurasi.sisaHariDariSekarang} hari lagi.`;
      ucapkanSuaraStudio(kalimat);
    };
  }

  // Tombol Analisis AI
  const btnAi = container.querySelector('#btn-tanya-ai-cfo');
  const boxAi = container.querySelector('#box-hasil-ai-cfo');
  if (btnAi && boxAi) {
    btnAi.onclick = async () => {
      boxAi.style.display = 'block';
      boxAi.innerHTML = '⏳ Menganalisis kecukupan kWh menuju tanggal 20 bulan depan...';
      try {
        const rincian = res.saranaKritis.map((s, i) =>
          `${i+1}. ${s.lokasi} (${s.jumlahLampu} lampu): Est. sisa hari ini ${s.akurasi.sisaKwhHariIni} kWh (habis ${s.akurasi.sisaHariDariSekarang} HARI lagi), pemakaian ${s.akurasi.lajuPakai} kWh/HARI. Rencana isi Rp ${s.nominal.toLocaleString('id-ID')} (+${s.kwhDidapat} kWh) -> total bertahan ${s.totalHariBertahan} HARI (sampai ${s.labelHabisBaru}).`
        ).join('\n');

        const prompt = `Anda adalah Analis Anggaran Token PLN PT Devis Jaya Bengkulu.
Catatan penting: Semua satuan waktu adalah HARI (bukan jam).
Target: Seluruh sarana di bawah ini harus cukup menyala sampai tanggal 20 bulan depan (${res.labelTarget}, yaitu ${res.hariKeTgl20} HARI dari sekarang).
Patokan mutlak: Rp 100.000 = 8.266 kWh, Rp 200.000 = 16.532 kWh, Rp 300.000 = 24.798 kWh, Rp 500.000 = 41.330 kWh.
Data sarana:
${rincian}

Berikan analisis ringkas dan akurat dalam Bahasa Indonesia (maksimal 5 poin):
1. Urutan prioritas sarana yang wajib diisi paling dulu.
2. Evaluasi apakah nominal masing-masing titik sudah cukup melewati tanggal ${res.labelTarget} (${res.hariKeTgl20} hari). Jika ada yang belum mencapai ${res.hariKeTgl20} hari, sebutkan berapa rupiah yang sebaiknya dibeli.`;

        const hasilAi = await panggilAICerdas([{ role: "user", content: prompt }], 0.2);
        const teksBersih = hasilAi.teks.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        boxAi.innerHTML = `<div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">⚡ Analisis ${hasilAi.provider}:</div>${teksBersih}`;
      } catch (e) {
        boxAi.innerHTML = `<span style="color:#ef4444;">Gagal memanggil AI: ${e.message}</span>`;
      }
    };
  }
}
