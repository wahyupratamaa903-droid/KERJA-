// MODUL MANDIRI 3: DEVIS JARVIS VOICE COMMANDER & ELEVENLABS BRIEF
import { bukaKunci, panggilAICerdas, ucapkanSuaraStudio } from './ai-router.js';

const GROQ_AUDIO_MODEL = "whisper-large-v3-turbo";

let mediaRecorder = null;
let audioChunks = [];

export function dapatkanGroqApiKey() {
  return localStorage.getItem('devis_groq_key') || bukaKunci('groq');
}

export async function mulaiRekamSuara() {
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.start();
}

export function hentikanDanProsesSuara() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) return reject(new Error("Perekam belum aktif"));
    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        const teksSuara = await transkripGroqWhisper(audioBlob, dapatkanGroqApiKey());
        resolve(teksSuara);
      } catch (err) { reject(err); }
    };
    mediaRecorder.stop();
  });
}

async function transkripGroqWhisper(blob, apiKey) {
  const formData = new FormData();
  formData.append("file", blob, "suara_patroli.webm");
  formData.append("model", GROQ_AUDIO_MODEL);
  formData.append("language", "id");
  formData.append("temperature", "0");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData
  });
  if (!res.ok) throw new Error("Gagal menerjemahkan suara di Whisper.");
  const data = await res.json();
  return data.text || "";
}

// Pencocok Lokal Cerdas (Cadangan Instan Jika Format JSON AI Meleset)
function ekstrakLokalDariUcapan(teksUcapan, daftarSarana) {
  const teks = (teksUcapan || "").toLowerCase();
  const angkaMatch = teks.replace(/\./g, '').match(/\d+/g);
  const kwh = angkaMatch ? Number(angkaMatch[angkaMatch.length - 1]) : null;

  let bestSarana = null;
  let skorTertinggi = 0;

  (daftarSarana || []).forEach(s => {
    const kataLokasi = s.lokasi.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(k => k.length > 2 && k !== 'bkl' && k !== 'kota' && k !== 'bengkulu');
    let skor = 0;
    kataLokasi.forEach(kata => {
      if (teks.includes(kata)) skor += kata.length;
    });
    if (skor > skorTertinggi) {
      skorTertinggi = skor;
      bestSarana = s;
    }
  });

  if (bestSarana && skorTertinggi >= 3) {
    return { idSarana: bestSarana.id, kwh: kwh, error: null };
  }
  return { idSarana: null, kwh: kwh, error: "Lokasi tidak dikenali dari ucapan" };
}

export async function ekstrakDataTokenDenganAI(teksUcapan, daftarSarana) {
  const daftarLokasi = (daftarSarana || []).map(s => ({ id: s.id, lokasi: s.lokasi }));

  try {
    const promptSistem = `Anda adalah ekstraktor JSON. Cocokkan kalimat pengguna dengan salah satu lokasi sarana berikut: ${JSON.stringify(daftarLokasi)}.
Balas HANYA dengan JSON murni tanpa teks tambahan:
{"idSarana": <id_angka_yang_cocok_atau_null>, "kwh": <angka_kwh_tanpa_titik_atau_null>}`;

    const hasilAi = await panggilAICerdas([
      { role: "system", content: promptSistem },
      { role: "user", content: teksUcapan }
    ], 0);

    const matchJson = hasilAi.teks.match(/\{[\s\S]*\}/);
    if (matchJson) {
      const parsed = JSON.parse(matchJson[0]);
      if (parsed && parsed.idSarana) return parsed;
    }
  } catch (e) {
    console.warn("Beralih ke pencocok suara lokal:", e.message);
  }

  return ekstrakLokalDariUcapan(teksUcapan, daftarSarana);
}

export function bacakanBriefTamu() {
  const teks = "Selamat datang di Sistem Monitoring Sarana Reklame PT Devis Jaya Cabang Bengkulu. Aplikasi ini memantau ketersediaan token listrik P L N, pemetaan radar titik reklame, serta estimasi kebutuhan anggaran operasional secara real time. Anda saat ini berada dalam mode akses tamu.";
  ucapkanSuaraStudio(teks);
}

export function bacakanMorningBrief(daftarSarana, infoBbm, fnHitungPrediksi) {
  let jmlKritis = 0;
  (daftarSarana || []).forEach(s => {
    if (s.jenisLampu === 'NONE' || s.isBerlampu === false) return;
    const st = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu).status;
    if (st === 'kritis' || st === 'waspada') jmlKritis++;
  });
  const teks = `Halo Aditiya. Saat ini terdaftar ${daftarSarana.length} titik sarana di Kota Bengkulu. Terdapat ${jmlKritis} titik sarana yang perlu pengisian token. Sisa saldo B B M mingguan Anda adalah ${infoBbm.sisa.toLocaleString('id-ID')} rupiah. Selamat bertugas dan utamakan keselamatan di jalan.`;
  ucapkanSuaraStudio(teks);
}
