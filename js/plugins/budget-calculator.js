// MODUL MANDIRI 2: ESTIMASI ANGGARAN TOKEN & AI FINANCIAL ADVISOR (MULTI-PROVIDER)
import { panggilAICerdas } from './ai-router.js';

const KWH_PER_500RB = 41330; // Patokan riil: Rp 500.000 = 41.330 kWh

export function hitungEstimasiAnggaranToken(daftarSarana, fnPrediksi) {
  const now = new Date();
  let tgtBulan = now.getMonth() + 1;
  let tgtTahun = now.getFullYear();
  if (tgtBulan > 11) { tgtBulan = 0; tgtTahun++; }
  const tglTarget10 = new Date(tgtTahun, tgtBulan, 10);
  const hariKeTgl10 = Math.max(1, Math.ceil((tglTarget10 - now) / (1000 * 60 * 60 * 24)));
  const labelTarget = tglTarget10.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const saranaKritis = [];
  let totalPengajuan = 0;

  (daftarSarana || []).forEach(s => {
    if (s.jenisLampu === 'NONE' || s.isBerlampu === false) return;
    const info = fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const sisaHari = info.estimasiHari !== undefined ? info.estimasiHari : 999;
    const sisaKwhSekarang = info.terakhir ? Number(info.terakhir.kwh) : 0;

    if (sisaHari < 30) {
      const jmlLampu = Number(s.jumlahLampu) || 2;
      const lajuHarian = Number(info.rataPerHari) || 400;
      const kebutuhanKwhSampaiTgl10 = Math.max(0, (hariKeTgl10 * lajuHarian) - sisaKwhSekarang);

      let nominal = 200000;
      if (jmlLampu >= 8) {
        nominal = 500000;
      } else {
        const kwh200 = Math.round((200000 / 500000) * KWH_PER_500RB); // 16.532 kWh
        const kwh300 = Math.round((300000 / 500000) * KWH_PER_500RB); // 24.798 kWh
        if (kebutuhanKwhSampaiTgl10 <= kwh200) nominal = 200000;
        else if (kebutuhanKwhSampaiTgl10 <= kwh300) nominal = 300000;
        else nominal = 500000;
      }

      const kwhDidapat = Math.round((nominal / 500000) * KWH_PER_500RB);
      const tambahHari = lajuHarian > 0 ? Math.floor(kwhDidapat / lajuHarian) : 30;
      const totalHariSetelahIsi = sisaHari + tambahHari;
      const cukupSampaiTgl10 = totalHariSetelahIsi >= hariKeTgl10;

      totalPengajuan += nominal;
      saranaKritis.push({
        ...s,
        info,
        nominal,
        kwhDidapat,
        sisaKwhSekarang,
        kebutuhanKwhSampaiTgl10: Math.round(kebutuhanKwhSampaiTgl10),
        sisaHari,
        totalHariSetelahIsi,
        cukupSampaiTgl10,
        lajuHarian
      });
    }
  });

  saranaKritis.sort((a, b) => a.sisaHari - b.sisaHari);

  return {
    saranaKritis,
    totalPengajuan,
    totalTitikKritis: saranaKritis.length,
    hariKeTgl10,
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
        <p style="font-size:0.75rem; color:#94a3b8;">Tidak ada sarana dengan sisa token di bawah 30 hari menuju ${res.labelTarget}.</p>
      </div>
    `;
    modal.style.display = 'flex';
    return;
  }

  const listHtml = res.saranaKritis.map((s, idx) => `
    <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(245,158,11,0.3); border-left:4px solid ${s.sisaHari <= 7 ? '#ef4444' : '#f59e0b'}; padding:10px 12px; border-radius:8px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <strong style="color:#fff; font-size:0.84rem;">${idx + 1}. ${s.lokasi}</strong>
          <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">
            ${s.jumlahLampu || 0} Lampu ${s.jenisLampu} • Sisa: <strong>${s.sisaKwhSekarang.toLocaleString('id-ID')} kWh</strong> (±${s.sisaHari} hr)
          </div>
        </div>
        <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:4px 8px; border-radius:6px; font-weight:800; font-size:0.78rem; white-space:nowrap;">
          Rp ${s.nominal.toLocaleString('id-ID')}
        </span>
      </div>
      <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.68rem; color:#cbd5e1; display:flex; justify-content:space-between;">
        <span>+Dapat: <strong>~${s.kwhDidapat.toLocaleString('id-ID')} kWh</strong></span>
        <span style="color:${s.cukupSampaiTgl10 ? '#34d399' : '#fbbf24'};">
          ${s.cukupSampaiTgl10 ? `✓ Cukup s/d ${res.labelTarget} (±${s.totalHariSetelahIsi} hr)` : `⚠ Bertahan ±${s.totalHariSetelahIsi} hr (Perlu Pantau)`}
        </span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.25); padding:12px; border-radius:8px; margin-bottom:10px;">
      <span style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase;">TOTAL PENGAJUAN (TARGET ${res.labelTarget.toUpperCase()} - ${res.hariKeTgl10} HARI LAGI):</span>
      <div style="font-size:1.4rem; font-weight:800; color:#10b981; margin:2px 0;">
        Rp ${res.totalPengajuan.toLocaleString('id-ID')}
      </div>
      <div style="font-size:0.72rem; color:#38bdf8;">${res.totalTitikKritis} titik kritis diurutkan dari prioritas terendah</div>
      <button type="button" id="btn-tanya-ai-cfo" style="margin-top:8px; width:100%; background:linear-gradient(90deg,#0284c7,#2563eb); color:#fff; border:none; padding:8px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
        🧠 Analisis Kecukupan kWh dengan Multi-AI Advisor
      </button>
      <div id="box-hasil-ai-cfo" style="display:none; margin-top:8px; padding:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(56,189,248,0.2); border-radius:6px; font-size:0.72rem; color:#e2e8f0; line-height:1.45; max-height:160px; overflow-y:auto;"></div>
    </div>
    <div style="max-height:230px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
  `;

  modal.style.display = 'flex';

  const btnAi = container.querySelector('#btn-tanya-ai-cfo');
  const boxAi = container.querySelector('#box-hasil-ai-cfo');
  if (btnAi && boxAi) {
    btnAi.onclick = async () => {
      boxAi.style.display = 'block';
      boxAi.innerHTML = '⏳ Menghubungi Multi-AI Engine (Groq / Cerebras / OpenRouter)...';
      try {
        const ringkasan = res.saranaKritis.map((s, i) =>
          `${i+1}. ${s.lokasi} (${s.jumlahLampu} ${s.jenisLampu}): Sisa ${s.sisaKwhSekarang} kWh (${s.sisaHari} hr), Laju ${s.lajuHarian} kWh/hr, Isi Rp ${s.nominal.toLocaleString('id-ID')} (+${s.kwhDidapat} kWh) -> Bertahan ${s.totalHariSetelahIsi} hr`
        ).join('\n');

        const prompt = `Anda adalah Analis Anggaran Token PLN PT Devis Jaya Bengkulu.
Target: Semua sarana kritis di bawah ini harus bertahan menyala sampai tanggal 10 bulan depan (${res.labelTarget}, yaitu ${res.hariKeTgl10} hari lagi).
Patokan harga: Rp 500.000 = 41.330 kWh, Rp 300.000 = 24.798 kWh, Rp 200.000 = 16.532 kWh.
Data titik kritis saat ini:
${ringkasan}

Berikan analisis singkat dalam Bahasa Indonesia (maksimal 5 poin padat):
1. Sebutkan titik mana yang paling darurat harus diisi hari ini.
2. Jelaskan apakah pengisian nominal tersebut sudah cukup mencapai ${res.labelTarget} (${res.hariKeTgl10} hari). Jika ada titik yang masih kurang dari ${res.hariKeTgl10} hari setelah diisi, beri peringatan berapa tambahan rupiah yang disarankan.`;

        const hasilAi = await panggilAICerdas([{ role: "user", content: prompt }], 0.2);
        const teksBersih = hasilAi.teks.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        boxAi.innerHTML = `<div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">⚡ Dijawab oleh ${hasilAi.provider}:</div>${teksBersih}`;
      } catch (e) {
        // Fallback Analisis Matematis Lokal jika seluruh jaringan terputus
        const ulasanLokal = res.saranaKritis.map((s, i) =>
          `• <strong>${s.lokasi}</strong>: Sisa ${s.sisaHari} hr. Diisi Rp ${s.nominal.toLocaleString('id-ID')} (+${s.kwhDidapat.toLocaleString('id-ID')} kWh) akan bertahan <strong>±${s.totalHariSetelahIsi} hari</strong> (${s.cukupSampaiTgl10 ? 'Aman melewati ' + res.labelTarget : 'Perlu tambah voucher bulan depan'}).`
        ).join('<br>');
        boxAi.innerHTML = `<div style="color:#10b981; font-weight:700; margin-bottom:4px;">📊 Hasil Kalkulasi Analis Presisi:</div>${ulasanLokal}`;
      }
    };
  }
}
