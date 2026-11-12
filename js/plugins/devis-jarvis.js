// MODUL MANDIRI 3: DEVIS JARVIS VOICE COMMANDER & NLU PARSER (ANTI-GAGAL)
const GROQ_AUDIO_MODEL = "whisper-large-v3-turbo";
const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

let mediaRecorder = null;
let audioChunks = [];

export function dapatkanGroqApiKey() {
  let key = localStorage.getItem('devis_groq_key');
  if (!key || !key.trim().startsWith("gsk_")) {
    key = prompt("Masukkan Groq API Key Anda (diawali gsk_...):");
    if (key && key.trim().startsWith("gsk_")) {
      localStorage.setItem('devis_groq_key', key.trim());
      return key.trim();
    }
    return null;
  }
  return key.trim();
}

export async function mulaiRekamSuara() {
  const apiKey = dapatkanGroqApiKey();
  if (!apiKey) throw new Error("API Key Groq (gsk_...) belum dimasukkan.");
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
  if (!res.ok) throw new Error("Gagal menerjemahkan suara di Groq Whisper.");
  const data = await res.json();
  return data.text || "";
}

export async function ekstrakDataTokenDenganAI(teksUcapan, daftarSarana) {
  const apiKey = dapatkanGroqApiKey();
  if (!apiKey) throw new Error("API Key Groq diperlukan.");

  const daftarLokasi = (daftarSarana || []).map(s => ({ id: s.id, lokasi: s.lokasi }));

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Anda adalah ekstraktor data JSON. Cocokkan ucapan teknisi dengan salah satu lokasi sarana berikut: ${JSON.stringify(daftarLokasi)}.
Kembalikan HANYA objek JSON dengan format persis:
{"idSarana": <number_id_yang_cocok_atau_null>, "kwh": <angka_kwh_tanpa_titik_atau_null>, "error": <string_alasan_jika_tidak_cocok_atau_null>}`
        },
        { role: "user", content: teksUcapan }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Respon Llama gagal: " + errText.slice(0, 80));
  }

  const data = await res.json();
  const rawContent = data.choices[0].message.content;
  return JSON.parse(rawContent);
}

export function bacakanBriefTamu() {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const teks = "Selamat datang di Sistem Monitoring Sarana Reklame PT Devis Jaya Cabang Bengkulu. Aplikasi web ini memantau ketersediaan token listrik P L N, pemetaan radar G I S titik reklame, serta estimasi kebutuhan anggaran operasional secara real time. Anda saat ini berada dalam mode akses tamu.";
  const ut = new SpeechSynthesisUtterance(teks);
  ut.lang = 'id-ID';
  ut.rate = 1.0;
  window.speechSynthesis.speak(ut);
}

export function bacakanMorningBrief(daftarSarana, infoBbm, fnHitungPrediksi) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  let jmlKritis = 0;
  (daftarSarana || []).forEach(s => {
    if (s.jenisLampu === 'NONE' || s.isBerlampu === false) return;
    const st = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu).status;
    if (st === 'kritis' || st === 'waspada') jmlKritis++;
  });
  const teks = `Halo Aditiya. Saat ini terdaftar ${daftarSarana.length} titik sarana di Kota Bengkulu. Terdapat ${jmlKritis} titik sarana yang mendekati batas pengisian token. Sisa saldo B B M mingguan Anda adalah ${infoBbm.sisa.toLocaleString('id-ID')} rupiah. Selamat bertugas dan utamakan keselamatan di jalan.`;
  const ut = new SpeechSynthesisUtterance(teks);
  ut.lang = 'id-ID';
  ut.rate = 1.03;
  window.speechSynthesis.speak(ut);
}
