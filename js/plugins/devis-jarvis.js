// js/plugins/devis-jarvis.js - Devis Jarvis Voice Commander & Morning Brief (Groq AI)
const GROQ_AUDIO_MODEL = "whisper-large-v3-turbo";
const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

let mediaRecorder = null;
let audioChunks = [];

export function dapatkanGroqApiKey() {
  let key = localStorage.getItem('devis_groq_key');
  if (!key) {
    key = prompt("Masukkan Groq API Key Anda (gsk_...):");
    if (key && key.trim().startsWith("gsk_")) {
      localStorage.setItem('devis_groq_key', key.trim());
      return key.trim();
    } else {
      alert("Kunci Groq dibatalkan atau tidak valid.");
      return null;
    }
  }
  return key;
}

export async function mulaiRekamSuara() {
  const apiKey = dapatkanGroqApiKey();
  if (!apiKey) throw new Error("Groq API Key belum dimasukkan.");

  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
}

export function hentikanDanProsesSuara() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) return reject(new Error("Perekam belum aktif"));

    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        const apiKey = dapatkanGroqApiKey();
        const teksSuara = await transkripGroqWhisper(audioBlob, apiKey);
        resolve(teksSuara);
      } catch (err) {
        reject(err);
      }
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

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Gagal memproses suara di Groq Whisper");
  }

  const data = await res.json();
  return data.text;
}

export async function ekstrakDataTokenDenganAI(teksUcapan, daftarSarana) {
  const apiKey = dapatkanGroqApiKey();
  if (!apiKey) throw new Error("Groq API Key diperlukan.");

  const daftarLokasi = daftarSarana.map(s => ({ id: s.id, lokasi: s.lokasi }));

  const promptSystem = `Anda adalah Devis Jarvis, AI pemroses suara teknisi reklame di Bengkulu.
Tugas Anda: Mengekstrak ID Sarana yang dimaksud dan Angka Sisa kWh dari kalimat ucapan pengguna.

Daftar Sarana yang terdaftar:
${JSON.stringify(daftarLokasi)}

Format Respon WAJIB HANYA JSON murni tanpa markdown/backticks, contoh:
{"idSarana": 12345, "kwh": 32500, "lokasi": "Simpang 4 Lingkar Barat"}

Jika angka desimal disebut (misal: tiga puluh dua koma lima), jadikan: 32.5.
Jika tidak menemukan kecocokan sarana, berikan: {"error": "Sarana tidak dikenali"}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: teksUcapan }
      ]
    })
  });

  if (!res.ok) throw new Error("Gagal mengekstrak data lewat Llama 3.3");

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export function bacakanMorningBrief(daftarSarana, infoBbm, fnHitungPrediksi) {
  if (!('speechSynthesis' in window)) {
    alert("Peramban HP ini tidak mendukung audio speech.");
    return;
  }

  window.speechSynthesis.cancel();

  let totalKritis = 0;
  let totalWaspada = 0;

  daftarSarana.forEach(s => {
    const info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    if (info.status === 'kritis') totalKritis++;
    else if (info.status === 'waspada') totalWaspada++;
  });

  let teksStatusToken = "Semua titik sarana dalam kondisi token aman.";
  if (totalKritis > 0) {
    teksStatusToken = `Perhatian, ada ${totalKritis} sarana berstatus kritis perlu pengisian segera.`;
  } else if (totalWaspada > 0) {
    teksStatusToken = `Ada ${totalWaspada} sarana berstatus waspada.`;
  }

  const teksBrief = `Halo Aditiya, selamat bertugas di lapangan. Total pemantauan saat ini 19 titik sarana reklame. ${teksStatusToken} Sisa saldo BBM operasional mingguanmu sebesar ${infoBbm.sisa.toLocaleString('id-ID')} rupiah. Tetap utamakan keselamatan berkendara di jalan.`;

  const utterance = new SpeechSynthesisUtterance(teksBrief);
  utterance.lang = 'id-ID';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}
