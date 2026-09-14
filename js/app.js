import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
let indexSaranaTerpilih = null;

// Tanggal hari ini
const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Logika FL (bisa dihitung) vs BL (dalam box / tidak bisa dihitung)
selectJenisLampu.addEventListener('change', () => {
  if (selectJenisLampu.value === 'FL') {
    inputJumlahLampu.disabled = false;
    inputJumlahLampu.placeholder = 'Jumlah titik lampu FL';
    inputJumlahLampu.value = '';
  } else if (selectJenisLampu.value === 'BL') {
    inputJumlahLampu.disabled = true;
    inputJumlahLampu.value = '0';
    inputJumlahLampu.placeholder = 'Lampu di dalam (BL)';
  } else {
    inputJumlahLampu.disabled = true;
    inputJumlahLampu.value = '0';
    inputJumlahLampu.placeholder = 'Tanpa lampu';
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
        <p>Belum ada titik sarana tersimpan.</p>
        <small>Isi formulir di atas untuk mulai mencatat.</small>
      </div>
    `;
    return;
  }

  dataSarana.forEach((item, index) => {
    const info = hitungPrediksiHabis(item.riwayatToken);
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${info.status}`;

    // Format info lampu
    let teksLampu = '';
    if (item.jenisLampu === 'FL') teksLampu = `FL (${item.jumlahLampu} Titik)`;
    else if (item.jenisLampu === 'BL') teksLampu = 'BL (Backlight)';
    else teksLampu = 'Non-Lampu';

    // Rincian riwayat awal vs terakhir
    let blokRiwayat = `
      <div class="baris-riwayat">
        <div class="item-riwayat">
          <span class="label-r">Sisa Terakhir:</span>
          <strong>${info.terakhir.kwh} kWh</strong>
          <small>${info.terakhir.tanggal}</small>
        </div>
    `;

    if (info.sebelumnya) {
      blokRiwayat += `
        <div class="item-riwayat">
          <span class="label-r">Sisa Sebelumnya:</span>
          <strong>${info.sebelumnya.kwh} kWh</strong>
          <small>${info.sebelumnya.tanggal}</small>
        </div>
      `;
    }
    blokRiwayat += `</div>`;

    // Analisa pemakaian
    let blokAnalisa = '';
    if (info.status === 'baru' || info.status === 'topup') {
      blokAnalisa = `<p class="pesan-catatan">${info.pesan}</p>`;
    } else {
      blokAnalisa = `
        <div class="grid-ringkasan">
          <div>Pemakaian: <strong>${info.totalPakai} kWh</strong> (${info.selisihHari} hr)</div>
          <div>Rata-rata: <strong>${info.rataPerHari} kWh/hr</strong></div>
          <div class="sorot-hari">Estimasi: <strong>± ${info.estimasiHari} Hari Lagi</strong></div>
        </div>
      `;
    }

    // Tampilan banyak foto
    let galeriHtml = '';
    if (item.fotos && item.fotos.length > 0) {
      galeriHtml = `
        <div class="galeri-sarana">
          ${item.fotos.map(foto => `<img src="${foto}" class="foto-klik" alt="Sarana">`).join('')}
        </div>
      `;
    }

    kartu.innerHTML = `
      <div class="kartu-header">
        <div>
          <span class="tipe-sarana">${item.tipe} • ${teksLampu}</span>
          <h3 class="lokasi-sarana">${item.lokasi}</h3>
        </div>
        <span class="tag-status ${info.status}">
          ${info.status === 'kritis' ? 'PERLU DIISI' : info.status === 'waspada' ? 'WASPADA' : info.status === 'aman' ? 'AMAN' : 'AKTIF'}
        </span>
      </div>

      <div class="kartu-body">
        ${blokRiwayat}
        ${blokAnalisa}
        ${galeriHtml}
      </div>

      <div class="kartu-footer">
        <button class="btn-update" data-index="${index}">+ Catat Token Baru</button>
        <button class="btn-hapus" data-index="${index}">Hapus</button>
      </div>
    `;

    containerDaftar.appendChild(kartu);
  });

  // Event listener tombol
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
      if (confirm('Hapus sarana ini beserta riwayatnya?')) {
        dataSarana.splice(idx, 1);
        localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
        renderData();
      }
    });
  });
}

// Simpan Sarana Baru
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnSubmit = form.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Memproses foto...';

  const lokasi = document.getElementById('lokasi').value.trim();
  const tipe = document.getElementById('tipe').value;
  const jenisLampu = selectJenisLampu.value;
  const jumlahLampu = jenisLampu === 'FL' ? Number(inputJumlahLampu.value) : 0;
  const tanggal = document.getElementById('tanggalPengecekan').value;
  const kwh = Number(document.getElementById('sisaKwh').value);

  let fotos = [];
  if (inputFoto.files && inputFoto.files.length > 0) {
    fotos = await kompresBanyakFoto(inputFoto.files);
  }

  dataSarana.unshift({
    id: Date.now(),
    lokasi,
    tipe,
    jenisLampu,
    jumlahLampu,
    fotos,
    riwayatToken: [{ tanggal, kwh }]
  });

  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
  form.reset();
  document.getElementById('tanggalPengecekan').value = tglHariIni;
  inputJumlahLampu.disabled = false;
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Simpan Sarana';
  renderData();
});

// Update Token Baru
formUpdate.addEventListener('submit', (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;

  const tgl = document.getElementById('modalTanggal').value;
  const kwh = Number(document.getElementById('modalKwh').value);

  dataSarana[indexSaranaTerpilih].riwayatToken.push({ tanggal: tgl, kwh });
  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));

  formUpdate.reset();
  document.getElementById('modalTanggal').value = tglHariIni;
  modalUpdate.style.display = 'none';
  renderData();
});

btnTutupModal.addEventListener('click', () => {
  modalUpdate.style.display = 'none';
});

// Inisialisasi
inisialisasiPenampilFoto();
renderData();
