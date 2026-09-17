// js/ocr.js - Scan angka meteran digital PLN via kamera (OCR)

let tesseractReady = false;

async function muatPustakaOCR() {
  if (window.Tesseract) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat sistem OCR Tesseract.'));
    document.head.appendChild(script);
  });
}

export async function scanAngkaMeteranDariFile(berkasFoto, callbackStatus) {
  if (callbackStatus) callbackStatus('Menyiapkan pemindai OCR...');
  await muatPustakaOCR();

  if (callbackStatus) callbackStatus('Memindai angka pada meteran PLN...');
  
  const worker = await window.Tesseract.createWorker('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.,'
  });

  const hasil = await worker.recognize(berkasFoto);
  await worker.terminate();

  const teks = hasil.data.text.replace(/,/g, '.');
  const cocok = teks.match(/\d+(\.\d+)?/g);

  if (!cocok || cocok.length === 0) {
    throw new Error('Angka meteran tidak terbaca jelas. Pastikan foto tegak lurus dan cukup cahaya.');
  }

  // Ambil angka dengan digit paling realistis untuk sisa kWh
  const kandidat = cocok.map(Number).filter(n => n > 0 && n < 1000000);
  if (kandidat.length === 0) {
    throw new Error('Tidak ditemukan angka kWh yang valid pada foto.');
  }

  return kandidat[0];
}
