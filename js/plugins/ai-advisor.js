import { dapatkanGroqApiKey } from './devis-jarvis.js';

async function dapatkanCuacaBengkulu() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-3.8004&longitude=102.2599&current_weather=true");
    const data = await res.json();
    return { suhu: data.current_weather.temperature, deskripsi: data.current_weather.weathercode >= 60 ? "Hujan/Buruk ⛈️" : "Cerah/Berawan ⛅" };
  } catch (err) {
    return { suhu: "-", deskripsi: "Tidak diketahui" };
  }
}

export async function buatAnalisisAnggaranAI(daftarSarana, fnPrediksi) {
  const apiKey = dapatkanGroqApiKey();
  if (!apiKey) return alert("Groq API Key diperlukan.");

  const cuaca = await dapatkanCuacaBengkulu();
  const now = new Date();
  let tgtBulan = now.getMonth() + 1;
  let tgtTahun = now.getFullYear();
  if (tgtBulan > 11) { tgtBulan = 0; tgtTahun++; }
  const tglTarget = new Date(tgtTahun, tgtBulan, 10);
  const selisihHari = Math.ceil((tglTarget - now) / (1000 * 60 * 60 * 24));

  const saranaKritis = daftarSarana.map(s => ({ ...s, info: fnPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu) }))
                                   .filter(s => s.info.estimasiHari < 30);

  if (saranaKritis.length === 0) {
    return `<div style="text-align:center; color:#10b981; padding:20px;">✅ Seluruh sarana aman (Cuaca: ${cuaca.deskripsi})</div>`;
  }

  document.getElementById('konten-rincian-anggaran').innerHTML = `<div style="color:#60a5fa; text-align:center;">⏳ Llama 3.3 memproses cuaca & anggaran...</div>`;

  const prompt = `Bertindaklah sebagai CFO AI. Hitung anggaran token PLN agar sarana berikut bertahan selama ${selisihHari} hari ke depan (Tgl 10 bulan depan).
Aturan:
1. Harga PLN: Rp 500.000 = 41.330 kWh.
2. Kebutuhan kWh = (${selisihHari} - Sisa Hari Saat Ini) x Laju Harian.
3. JIKA sarana >4 lampu (misal 8 FL), wajib isi Rp 500.000. JIKA 2-4 lampu, isi Rp 200.000 atau Rp 500.000.
Cuaca Bengkulu saat ini: ${cuaca.deskripsi} (${cuaca.suhu}C).

Data: ${JSON.stringify(saranaKritis.map(s => ({lokasi: s.lokasi, lampu: s.jumlahLampu, sisaHari: s.info.estimasiHari, laju: s.info.rataPerHari})))}

Hasilkan HANYA output HTML <div>...</div> estetik bergaya cyberpunk. Rincikan lokasi, nominal rupiah, dan total.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.1, messages: [{ role: "user", content: prompt }] })
    });
    let htmlOutput = (await res.json()).choices[0].message.content;
    return htmlOutput.replace(/```html/g, '').replace(/```/g, '').trim();
  } catch (err) {
    return `<div style="color:#ef4444;">Error AI: ${err.message}</div>`;
  }
}
