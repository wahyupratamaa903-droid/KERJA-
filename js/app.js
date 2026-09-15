import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';
import { dapatkanKoordinatGPS } from './gps.js';
import { filterSarana } from './filter.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

// Elemen GPS & Pencarian
const btnAmbilGps = document.getElementById('btn-ambil-gps');
const statusGpsText = document.getElementById('status-gps');
const inputCari = document.getElementById('input-cari');
const tabFilters = document.querySelectorAll('.tab-filter');

let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
let indexSaranaTerpilih = null;
let koordinatTersimpanForm = null;
let statusFilterAktif = 'semua';

// Tanggal hari ini
const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Logika FL vs BL
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

// Aksi Ambil GPS di Form
btnAmbilGps.addEventListener('click', async () => {
  statusGpsText.textContent = 'Mencari sinyal satelit...';
  btnAmbilGps.disabled = true;
  try {
    const coords = await dapatkanKoordinatGPS();
    koordinatTersimpanForm = coords;
    statusGpsText.innerHTML = `<span style="color:#10b981;">Terkunci: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</span>`;
  } catch (err) {
    statusGpsText.innerHTML = `<span style="color:#ef4444;">${err.message}</span>`;
  } finally {
    btnAmbilGps.disabled = false;
  }
});

function perbaruiStatistik() {
  const total = dataSarana.length;
  const kritis = dataSarana.filter(item => {
    const info = hitungPrediksiHabis(item.riwayatToken);
    return info.status === 'kritis' || info.status === 'waspada';
  }).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-isi').textContent = kritis;
}

function renderData() {
  containerDaftar.innerHTML = '';
  perbaruiStatistik();

  const dataTersaring = filterSarana(dataSarana, inputCari.value, statusFilterAktif, hitungPrediksiHabis);

  if (dataTersaring.length === 0) {
    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Tidak ada data sarana yang cocok.</p>
        <small>Coba ubah kata kunci pencarian atau filter status.</small>
      </div>
    `;
    return;
  }

  dataTersaring.forEach((item) => {
    const originalIndex = dataSarana.findIndex(s => s.id === item.id);
    const info = hitungPrediksiHabis(item.riwayatToken);
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${info.status}`;

    let teksLampu = '';
    if (item.jenisLampu === 'FL') teksLampu = `FL (${item.jumlahLampu} Titik)`;
    else if (item.jenisLampu === 'BL') teksLampu = 'BL (Backlight)';
    else teksLampu = 'Non-Lampu';

    // Rincian Riwayat
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

    // Analisa Pemakaian & Prediksi
    let blokAnalisa = '';
    if (info.pesan) {
      blokAnalisa = `<p class="pesan-catatan">${info.pesan}</p>`;
    } else {
      const teksPemakaian = info.isTopUp 
        ? `<span style="color:#10b981; font-weight:600;">Status: Diisi Ulang</span>`
        : `Pemakaian: <strong>${info.totalPakai} kWh</strong> (${info.selisihHari} hr)`;

      blokAnalisa = `
        <div class="grid-ringkasan">
          <div>${teksPemakaian}</div>
          <div>Rata-rata: <strong>${info.rataPerHari} kWh/hr</strong> ${info.isTopUp ? '(riwayat)' : ''}</div>
          <div class="sorot-hari">
            Estimasi: <strong>± ${info.estimasiHari} Hari Lagi (${info.tanggalHabis})</strong>
          </div>
        </div>
      `;
    }

    // Tombol Rute Maps
    let tombolMaps = '';
    if (item.koordinat && item.koordinat.lat) {
      tombolMaps = `
        <a href="https://www.google.com/maps/dir/?api=1&destination=${item.koordinat.lat},${item.koordinat.lng}" target="_blank" class="btn-rute-maps">
          Navigasi Maps
        </a>
      `;
    }

    // Galeri Foto
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
          ${info.isTopUp ? 'DIISI ULANG' : info.status === 'kritis' ? 'PERLU DIISI' : info.status === 'waspada' ? 'WASPADA' : info.status === 'aman' ? 'AMAN' : 'AKTIF'}
        </span>
      </div>

      <div class="kartu-body">
        ${blokRiwayat}
        ${blokAnalisa}
        ${tombolMaps}
        ${galeriHtml}
      </div>

      <div class="kartu-footer">
        <button class="btn-update" data-index="${originalIndex}">+ Catat Token Baru</button>
        <button class="btn-hapus" data-index="${originalIndex}">Hapus</button>
      </div>
    `;

    containerDaftar.appendChild(kartu);
  });

  // Pasang Event Tombol
  document.querySelectorAll('.btn-update').forEach(btn => {
    btn.addEventListener('click', (e) => {
      indexSaranaTerpilih = Number(e.target.getAttribute('data-index'));
      const sarana = dataSarana[indexSaranaTerpilih];
      const riwayatUrut = [...sarana.riwayatToken].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
      const terakhir = riwayatUrut[riwayatUrut.length - 1];

      document.getElementById('nama-sarana-modal').innerHTML = `
        <strong>${sarana.lokasi}</strong><br>
        <span style="color: #60a5fa; font-size: 0.8rem;">
          Patokan Terakhir: <strong>${terakhir.kwh} kWh</strong> (${terakhir.tanggal})
        </span>
      `;
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

// Event Pencarian & Filter Status
inputCari.addEventListener('input', () => renderData());

tabFilters.forEach(tab => {
  tab.addEventListener('click', () => {
    tabFilters.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    statusFilterAktif = tab.getAttribute('data-filter');
    renderData();
  });
});

// Simpan Sarana Baru
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnSubmit = form.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';

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
    koordinat: koordinatTersimpanForm,
    fotos,
    riwayatToken: [{ tanggal, kwh }]
  });

  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
  form.reset();
  document.getElementById('tanggalPengecekan').value = tglHariIni;
  inputJumlahLampu.disabled = false;
  koordinatTersimpanForm = null;
  statusGpsText.textContent = 'Belum diambil';
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Simpan Sarana';
  renderData();
});

// Update Catatan Token Baru
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

inisialisasiPenampilFoto();
renderData();
