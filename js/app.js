import { hitungKetahananToken } from './token-calc.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const inputFoto = document.getElementById('fotoSarana');
const previewImg = document.getElementById('preview-foto');
const totalTitikEl = document.getElementById('stat-total');
const perluIsiEl = document.getElementById('stat-isi');

let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja') || '[]');

// Kompres foto dari galeri agar tidak melebihi kuota penyimpanan browser
function kompresGambar(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_LEBAR = 800;
        let scale = 1;
        if (img.width > MAX_LEBAR) {
          scale = MAX_LEBAR / img.width;
        }
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve('');
    };
    reader.onerror = () => resolve('');
  });
}

// Pratinjau gambar saat user memilih file dari galeri
inputFoto.addEventListener('change', () => {
  const file = inputFoto.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.style.display = 'block';
  } else {
    previewImg.style.display = 'none';
  }
});

function perbaruiStatistik() {
  const total = dataSarana.length;
  const perluIsi = dataSarana.filter(item => item.hasilToken.butuhIsi).length;
  totalTitikEl.textContent = total;
  perluIsiEl.textContent = perluIsi;
}

function renderData() {
  containerDaftar.innerHTML = '';
  perbaruiStatistik();

  if (dataSarana.length === 0) {
    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Belum ada titik sarana yang tersimpan.</p>
        <small>Silakan isi formulir di atas untuk mencatat.</small>
      </div>
    `;
    return;
  }

  dataSarana.forEach((item, index) => {
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${item.hasilToken.status}`;

    kartu.innerHTML = `
      <div class="kartu-header">
        <div>
          <span class="tipe-sarana">${item.tipe}</span>
          <h3 class="lokasi-sarana">${item.lokasi}</h3>
        </div>
        <span class="tag-status ${item.hasilToken.status}">
          ${item.hasilToken.status === 'kritis' ? 'SEGERA ISI' : item.hasilToken.status === 'waspada' ? 'WASPADA' : 'AMAN'}
        </span>
      </div>

      <div class="kartu-body">
        <div class="info-grid">
          <div class="info-box">
            <span class="label-info">Jumlah Lampu</span>
            <span class="nilai-info">${item.jumlahLampu} Titik</span>
          </div>
          <div class="info-box">
            <span class="label-info">Sisa Token</span>
            <span class="nilai-info">${item.sisaKwh} kWh</span>
          </div>
          <div class="info-box full">
            <span class="label-info">Estimasi Bertahan</span>
            <span class="nilai-info sorot">± ${item.hasilToken.estimasiHari} Hari</span>
          </div>
        </div>

        ${item.foto ? `<img src="${item.foto}" class="foto-sarana" alt="Dokumentasi ${item.lokasi}">` : ''}
      </div>

      <div class="kartu-footer">
        <button class="btn-hapus" data-index="${index}">Hapus Data</button>
      </div>
    `;

    containerDaftar.appendChild(kartu);
  });

  document.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      if (confirm('Hapus data sarana ini?')) {
        dataSarana.splice(idx, 1);
        localStorage.setItem('sarana-kerja', JSON.stringify(dataSarana));
        renderData();
      }
    });
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const lokasi = document.getElementById('lokasi').value.trim();
  const tipe = document.getElementById('tipe').value;
  const jumlahLampu = Number(document.getElementById('jumlahLampu').value);
  const sisaKwh = Number(document.getElementById('sisaKwh').value);
  const btnSubmit = form.querySelector('button[type="submit"]');

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Memproses...';

  let fotoKompres = '';
  if (inputFoto.files && inputFoto.files[0]) {
    fotoKompres = await kompresGambar(inputFoto.files[0]);
  }

  const hasilToken = hitungKetahananToken(jumlahLampu, sisaKwh);

  dataSarana.unshift({
    lokasi,
    tipe,
    jumlahLampu,
    sisaKwh,
    foto: fotoKompres,
    hasilToken
  });

  try {
    localStorage.setItem('sarana-kerja', JSON.stringify(dataSarana));
    form.reset();
    previewImg.style.display = 'none';
    renderData();
  } catch (err) {
    alert('Memori penyimpanan penuh. Coba hapus beberapa data lama.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Simpan & Hitung Status';
  }
});

renderData();
