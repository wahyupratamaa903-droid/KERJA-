// MODUL MANDIRI 2: ESTIMASI ANGGARAN TOKEN & AI FINANCIAL ADVISOR (TARGET TGL 10)
import { dapatkanGroqApiKey } from './devis-jarvis.js';

const KWH_PER_500RB = 41330; // Patokan riil lapangan: Rp 500.000 = 41.330 kWh

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

    // Filter sarana yang akan habis di bawah 30 hari
    if (sisaHari < 30) {
      const jmlLampu = Number(s.jumlahLampu) || 2;
      const lajuHarian = Number(info.rataPerHari) || 500;
      const kebutuhanKwhSampaiTgl10 = Math.max(0, (hariKeTgl10 * lajuHarian) - sisaKwhSekarang);

      let nominal = 200000;
      if (jmlLampu >= 8) {
        nominal = 500000;
      } else {
        // Lampu 2-4: pilih 200rb, 300rb, atau 500rb agar cukup sampai tanggal 10 bulan depan
        const kwhDari200rb = Math.round((200000 / 500000) * KWH_PER_500RB); // 16.532 kWh
        const kwhDari300rb = Math.round((300000 / 500000) * KWH_PER_500RB); // 24.798 kWh
        if (kebutuhanKwhSampaiTgl10 <= kwhDari200rb) nominal = 200000;
        else if (kebutuhanKwhSampaiTgl10 <= kwhDari300rb) nominal = 300000;
        else nominal = 500000;
      }

      const kwhDidapat = Math.round((nominal / 500000) * KWH_PER_500RB);
      const totalKwhSetelahIsi = sisaKwhSekarang + kwhDidapat;
      const tambahHari = lajuHarian > 0 ? Math.floor(kwhDidapat / lajuHarian) : 30;
      const cukupSampaiTgl10 = (sisaHari + tambahHari) >= hariKeTgl10;

      totalPengajuan += nominal;
      saranaKritis.push({
        ...s,
        info,
        nominal,
        kwhDidapat,
        totalKwhSetelahIsi,
        sisaHari,
        totalHariSetelahIsi: sisaHari + tambahHari,
        cukupSampaiTgl10,
        lajuHarian
      });
    }
  });

  // Urutkan dari yang paling kritis (sisa hari paling sedikit)
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
            ${s.jumlahLampu || 0} Lampu ${s.jenisLampu} • Sisa: <strong>${s.info.terakhir ? s.info.terakhir.kwh.toLocaleString('id-ID') : 0} kWh</strong> (±${s.sisaHari} hr)
          </div>
        </div>
        <span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:4px 8px; border-radius:6px; font-weight:800; font-size:0.78rem; white-space:nowrap;">
          Rp ${s.nominal.toLocaleString('id-ID')}
        </span>
      </div>
      <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.68rem; color:#cbd5e1; display:flex; justify-content:space-between;">
        <span>+Dapat: <strong>~${s.kwhDidapat.toLocaleString('id-ID')} kWh</strong></span>
        <span style="color:${s.cukupSampaiTgl10 ? '#34d399' : '#fbbf24'};">
          ${s.cukupSampaiTgl10 ? `✓ Cukup s/d ${res.labelTarget} (±${s.totalHariSetelahIsi} hr)` : `⚠ Bertahan ±${s.totalHariSetelahIsi} hr`}
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
      <button type="button" id="btn-tanya-ai-cfo" style="margin-top:8px; width:100%; background:linear-gradient(90deg,#0284c7,#2563eb); color:#fff; border:none; padding:7px; border-radius:6px; font-size:0.74rem; font-weight:700; cursor:pointer;">
        🧠 Analisis Kecukupan kWh dengan AI Llama 3.3
      </button>
      <div id="box-hasil-ai-cfo" style="display:none; margin-top:8px; padding:8px; background:rgba(0,0,0,0.35); border-radius:6px; font-size:0.72rem; color:#e2e8f0; line-height:1.45;"></div>
    </div>
    <div style="max-height:250px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
  `;

  modal.style.display = 'flex';

  const btnAi = container.querySelector('#btn-tanya-ai-cfo');
  const boxAi = container.querySelector('#box-hasil-ai-cfo');
  if (btnAi && boxAi) {
    btnAi.onclick = async () => {
      const apiKey = dapatkanGroqApiKey();
      if (!apiKey) return;
      boxAi.style.display = 'block';
      boxAi.innerHTML = '⏳ AI Llama 3.3 sedang menghitung kecukupan kWh menuju tanggal 10 bulan depan...';
      try {
        const ringkasanData = res.saranaKritis.map(s => ({
          lokasi: s.lokasi,
          lampu: `${s.jumlahLampu} ${s.jenisLampu}`,
          sisaKwh: s.info.terakhir ? s.info.terakhir.kwh : 0,
          sisaHari: s.sisaHari,
          lajuKwhPerHari: s.lajuHarian,
          rekomendasiIsiRp: s.nominal,
          tambahanKwh: s.kwhDidapat
        }));
        const prompt = `Anda adalah asisten teknis & finansial PT Devis Jaya Bengkulu.
Target kita: Semua sarana di bawah 30 hari harus cukup menyala sampai tanggal 10 bulan depan (${res.hariKeTgl10} hari lagi).
Patokan mutlak: Isi Rp 500.000 mendapat 41.330 kWh (Rp 200.000 mendapat 16.532 kWh, Rp 300.000 mendapat 24.798 kWh).
Data sarana kritis: ${JSON.stringify(ringkasanData)}
Berikan ulasan singkat, padat, dan taktis (maksimal 5 poin pendek) mengenai urutan prioritas pengisian dan apakah nominal rekomendasi tersebut sudah aman mencapai tanggal 10 bulan depan.`;

        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }]
          })
        });
        const json = await resp.json();
        const teks = json.choices[0].message.content.replace(/\n/g, '<br>');
        boxAi.innerHTML = `<strong style="color:#38bdf8;">💡 Rekomendasi AI Llama 3.3:</strong><br>${teks}`;
      } catch (e) {
        boxAi.innerHTML = `<span style="color:#ef4444;">Gagal memanggil AI: ${e.message}</span>`;
      }
    };
  }
}
