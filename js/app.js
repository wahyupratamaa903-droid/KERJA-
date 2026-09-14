import { hitungPrediksiHabis } from './token-calc.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const inputFoto = document.getElementById('fotoSarana');
const previewImg = document.getElementById('preview-foto');
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v2') || '[]');
let indexSaranaTerpilih = null;

// Atur tanggal hari ini secara otomatis pada input
const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

function kompresGambar(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let scale = 1;
        if (img.width > MAX_WIDTH) scale = MAX_WIDTH / img.width;
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

inputFoto.addEventListener('change', () => {
  const file = inputFoto.files[0];
  if (file) {
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = 'block';
  } else {
    previewImg.style.display = 'none';
  }
});

function perbaruiStatistik() {
  const total = dataSarana.length;
  const kritis = dataSarana.filter(item => {
    const info = hitungPrediksiHabis(item.riwayatToken);
    return info.status === 'kritis';
  }).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-isi').textContent = kritis;
}

function renderData() {
  containerDaftar.innerHTML = '';
  perbaruiStatistik();

  if (dataSarana.length === 0) {
    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Belum ada titik sarana yang dicatat.</p>
        <small>Data yang kamu simpan akan muncul di sini.</small>
      </div>
    `;
    return;
  }

  dataSarana.forEach((item, index) => {
    const analisa = hitungPrediksiHabis(item.riwayatToken);
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${analisa.status}`;

    let statusBadge = '';
    let kontenAnalisa = '';

    if (analisa.status === 'baru') {
      statusBadge = '<span class="tag-status netral">DATA AWAL</span>';
      kontenAnalisa = `<p class="pesan-info">${analisa.pesan}</p>`;
    } else if (analisa.status === 'topup') {
      statusBadge = '<span class="tag-status netral">DIISI ULANG</span>';
      kontenAnalisa = `<p class="pesan-info">${analisa.pesan}</p>`;
    } else {
      statusBadge = `<span class="tag-status ${analisa.status}">
        ${analisa.status === 'kritis' ? 'SEGERA ISI' : analisa.status === 'waspada' ? 'WASPADA' : 'AMAN'}
      </span>`;
      kontenAnalisa = `
        <div class="info-grid">
          <div class="info-box">
            <span class="label-info">Pemakaian Rata-rata</span>
            <span class="nilai-info">${analisa.kwhPerHari} kWh/hari</span>
          </div>
          <div class="info-box">
            <span class="label-info">Estimasi Bertahan</span>
            <span class="nilai-info sorot">± ${analisa.estimasiHari} Hari</span>
          </div>
        </div>
      `;
    }

    kartu.innerHTML = `
      <div class="kartu-header">
        <div>
          <span class="tipe-sarana">${item.tipe} • ${item.jumlahLampu} Lampu</span>
          <h3 class="lokasi-sarana">${item.lokasi}</h3>
        </div>
        ${statusBadge}
      </div>

      <div class="kartu-body">
        <div class="info-token-terkini">
          <span>Sisa Terakhir: <strong>${analisa.sisaKwh} kWh</strong></span>
          <small>Dicatat: ${analisa.tanggalCatat}</small>
        </div>

        ${kontenAnalisa}

        ${item.foto ? `<img src="${item.foto}" class="foto-sarana" alt="Sarana ${item.lokasi}">` : ''}
      </div>

      <div class="kartu-footer">
        <button class="btn-update" data-index="${index}">+ Catat Token Baru</button>
        <button class="btn-hapus" data-index="${index}">Hapus</button>
      </div>
    `;

    containerDaftar.appendChild(kartu);
  });

  document.querySelectorAll('.btn-update').forEach(btn => {
    btn.addEventListener('click', (e) => {
      indexSaranaTerpilih = Number(e.target.getAttribute('data-index'));
      document.getElementById('nama-sarana-modal').textContent = dataSarana[indexSaranaTerpilih].lokasi;
      modalUpdate.style.display = 'flex';
    });
  });

  document.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      if (confirm('Hapus sarana ini beserta seluruh riwayatnya?')) {
        dataSarana.splice(idx, 1);
        localStorage.setItem('sarana-kerja-v2', JSON.stringify(dataSarana));
        renderData();
      }
    });
  });
}

// Tambah Sarana Baru
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const lokasi = document.getElementById('lokasi').value.trim();
  const tipe = document.getElementById('tipe').value;
  const jumlahLampu = Number(document.getElementById('jumlahLampu').value);
  const tanggal = document.getElementById('tanggalPengecekan').value;
  const kwh = Number(document.getElementById('sisaKwh').value);
  const btnSubmit = form.querySelector('button[type="submit"]');

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';

  let fotoKompres = '';
  if (inputFoto.files && inputFoto.files[0]) {
    fotoKompres = await kompresGambar(inputFoto.files[0]);
  }

  dataSarana.unshift({
    id: Date.now(),
    lokasi,
    tipe,
    jumlahLampu,
    foto: fotoKompres,
    riwayatToken: [{ tanggal, kwh }]
  });

  localStorage.setItem('sarana-kerja-v2', JSON.stringify(dataSarana));
  form.reset();
  document.getElementById('tanggalPengecekan').value = tglHariIni;
  previewImg.style.display = 'none';
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Simpan Sarana';
  renderData();
});

// Update Token Baru untuk Sarana yang Sudah Ada
formUpdate.addEventListener('submit', (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;

  const tgl = document.getElementById('modalTanggal').value;
  const kwh = Number(document.getElementById('modalKwh').value);

  dataSarana[indexSaranaTerpilih].riwayatToken.push({ tanggal: tgl, kwh });
  localStorage.setItem('sarana-kerja-v2', JSON.stringify(dataSarana));

  formUpdate.reset();
  document.getElementById('modalTanggal').value = tglHariIni;
  modalUpdate.style.display = 'none';
  renderData();
});

btnTutupModal.addEventListener('click', () => {
  modalUpdate.style.display = 'none';
});

renderData();
