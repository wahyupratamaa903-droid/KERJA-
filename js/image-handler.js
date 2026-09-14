// js/image-handler.js - Modul multi-foto & penampil popup

export async function kompresBanyakFoto(fileList) {
  const hasilKompres = [];

  for (const file of fileList) {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; // Ukuran optimal untuk HP
          let scale = 1;
          if (img.width > MAX_WIDTH) scale = MAX_WIDTH / img.width;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve('');
      };
      reader.onerror = () => resolve('');
    });

    if (dataUrl) hasilKompres.push(dataUrl);
  }

  return hasilKompres;
}

export function inisialisasiPenampilFoto() {
  const modalFoto = document.getElementById('modal-foto');
  const imgZoom = document.getElementById('img-zoom');

  // Buka foto saat diklik
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('foto-klik')) {
      imgZoom.src = e.target.src;
      modalFoto.style.display = 'flex';
    }
  });

  // Tutup popup saat disentuh di mana saja
  modalFoto.addEventListener('click', () => {
    modalFoto.style.display = 'none';
    imgZoom.src = '';
  });
}
