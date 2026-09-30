import { dapatkanGroqApiKey } from './devis-jarvis.js';

async function dapatkanCuacaBengkulu() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-3.8004&longitude=102.2599&current_weather=true");
    const data = await res.json();
    const kode = data.current_weather.weathercode;
    return {
      suhu: data.current_weather.temperature,
      deskripsi: kode >= 60 ? "Hujan/Badai ⛈️" : kode >= 1 ? "Berawan ⛅" : "Cerah ☀️"
    };
  } catch (e) {
    return { suhu: "-", deskripsi: "Cerah/Berawan ⛅" };
  }
}

export async function buatAnalisisAnggaranAI(daftarSarana, fnPrediksi) {
  const cuaca = await dapatkanCuacaBengkulu();
  
  // Hitung target tanggal 10 bulan depan
  const now = new Date();
  let tgtBulan = now.getMonth() + 1;
  let tgtTahun = now.getFullYear();
  if (tgtBulan > 11) { tgtBulan = 0; tgtTahun++; }
  const tglTarget = new Date(tgtTahun, tgtBulan, 10);
  const selisihHari = Math.max(1, Math.ceil((tglTarget - now) / (1000 * 60 * 60 * 24)));

  const saranaKritis = daftarSarana.map(s => {
    const info = fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    return { ...s, info };
  }).filter(s => s.info.estimasiHari < 30);

  if (saranaKritis.length === 0) {
    return `
      <div style="padding:16px; text-align:center;">
        <div style="font-size:1.8rem; margin-bottom:8px;">✅</div>
        <h4 style="color:#10b981; margin-bottom:6px;">Semua Sarana Masih Aman!</h4>
        <p style="font-size:0.75rem; color:#94a3b8; line-height:1.4;">
          Tidak ada sarana dengan sisa token di bawah 30 hari.<br>
          Kondisi Cuaca Bengkulu: <strong>${cuaca.deskripsi} (${cuaca.suhu}°C)</strong>
        </p>
      </div>
    `;
  }

  // Kalkulasi CFO Presisi (Patokan: Rp 500.000 = 41.330 kWh -> Rp 12,098 per kWh)
  const BIAYA_PER_KWH = 500000 / 41330;
  let totalEstimasiBiaya = 0;

  const barisHtml = saranaKritis.map((s, idx) => {
    const sisaHariIni = Math.max(0, s.info.estimasiHari);
    const defisitHari = Math.max(0, selisihHari - sisaHariIni);
    const laju = s.info.rataPerHari || 10;
    const kebutuhanKwh = defisitHari * laju;
    
    // Logika Alokasi Biaya Lapangan
    let nominalBeli = 200000;
    const jmlLampu = Number(s.jumlahLampu) || 0;
    if (jmlLampu >= 8 || s.jenisLampu === 'FL' && jmlLampu > 4) {
      nominalBeli = 500000;
    } else {
      const hitungMurni = kebutuhanKwh * BIAYA_PER_KWH;
      if (hitungMurni > 350000) nominalBeli = 500000;
      else if (hitungMurni > 200000) nominalBeli = 300000;
      else nominalBeli = 200000;
    }

    const estimasiKwhDapat = Math.round((nominalBeli / 500000) * 41330);
    totalEstimasiBiaya += nominalBeli;

    return `
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); padding:10px; border-radius:8px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong style="color:#fff; font-size:0.85rem;">${idx + 1}. ${s.lokasi}</strong>
            <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">
              Beban: ${s.tipe} • ${s.jenisLampu} (${jmlLampu} Lampu) | Laju: ${laju} kWh/hr
            </div>
          </div>
          <span style="font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(239,68,68,0.2); color:#ef4444;">
            Sisa ±${sisaHariIni} Hari
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
          <span style="font-size:0.72rem; color:#cbd5e1;">Rekomendasi Beli Token:</span>
          <span style="font-size:0.85rem; font-weight:800; color:#38bdf8;">
            Rp ${nominalBeli.toLocaleString('id-ID')} <small style="font-size:0.65rem; color:#94a3b8;">(~${estimasiKwhDapat.toLocaleString('id-ID')} kWh)</small>
          </span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div>
      <div style="background:linear-gradient(135deg, rgba(30,58,138,0.3), rgba(15,23,42,0.8)); border:1px solid rgba(59,130,246,0.3); padding:12px; border-radius:10px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; color:#93c5fd; font-weight:700;">PROYEKSI TARGET TGL 10 BULAN DEPAN</span>
          <span style="font-size:0.7rem; color:#38bdf8; background:rgba(56,189,248,0.15); padding:2px 6px; border-radius:4px;">${cuaca.deskripsi} ${cuaca.suhu}°C</span>
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:0.75rem; color:#94a3b8;">Total Anggaran Yang Dibutuhkan:</div>
          <div style="font-size:1.3rem; font-weight:800; color:#10b981;">Rp ${totalEstimasiBiaya.toLocaleString('id-ID')}</div>
        </div>
        <p style="font-size:0.68rem; color:#cbd5e1; margin-top:6px; line-height:1.3;">
          Target durasi operasional: <strong>${selisihHari} hari ke depan</strong>. Dioptimalkan berdasarkan kapasitas lampu dan riwayat harian agar lampu tidak padam sebelum tanggal gajian token.
        </p>
      </div>

      <div style="font-size:0.75rem; font-weight:700; color:#fff; margin-bottom:6px;">Daftar Titik Perlu Pengisian:</div>
      <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
        ${barisHtml}
      </div>
    </div>
  `;
}
