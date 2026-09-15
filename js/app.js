import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';
import { dapatkanKoordinatGPS, parsingKoordinatManual } from './gps.js';
import { filterSarana } from './filter.js';
import { kirimLaporanKeWhatsApp } from './export-wa.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const inputKoordinat = document.getElementById('input-koordinat');
const btnAmbilGps = document.getElementById('btn-ambil-gps');
const btnEksporWa = document.getElementById('btn-ekspor-wa');

// Modal Update Token
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

// Modal Edit Sarana
const modalEdit = document.getElementById('modal-edit');
const formEdit = document.getElementById('form-edit');
const btnTutupEdit = document.getElementById('btn-tutup-edit');
const editJenisLampu = document.getElementById('edit-jenisLampu');
const editJumlahLampu = document.getElementById('edit-jumlahLampu');

// Pencarian & Filter
const inputCari = document.getElementById('input-cari');
const tabFilters = document.querySelectorAll('.tab-filter');

let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
let indexSaranaTerpilih = null;
let statusFilterAktif = 'semua';

const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Logika FL vs BL form tambah
selectJenisLampu.addEventListener('change', () => {
  if (selectJenisLampu.value === 'FL') {
    inputJumlahLampu.disabled = false;
    inputJumlahLampu.placeholder = 'Jumlah titik lampu FL';
  } else {
    inputJumlahLampu.disabled = true;
    inputJumlahLampu.value = '0';
  }
});

// Logika FL vs BL modal edit
editJenisLampu.addEventListener('change', () => {
  if (editJenisLampu.value === 'FL') {
    editJumlahLampu.disabled = false;
  } else {
    editJumlahLampu.disabled = true;
    editJumlahLampu.value = '0';
  }
});

// Ambil GPS otomatis ke kolom koordinat
btnAmbilGps.addEventListener('click', async () => {
  btnAmbilGps.textContent = 'Mencari...';
  btnAmbilGps.disabled = true;
  try {
    const coords = await dapatkanKoordinatGPS();
    inputKoordinat.value = `${coords.lat}, ${coords.lng}`;
  } catch (err) {
    alert(err.message);
  } finally {
    btnAmbilGps.textContent = 'GPS Otomatis';
    btnAmbilGps.disabled = false;
  }
});

// Tombol Ekspor WhatsApp
btnEksporWa.addEventListener('click', () => {
  if (dataSarana.length === 0) {
    alert('Belum ada data sarana untuk dilaporkan.');
    return;
  }
  kirimLaporanKeWhatsApp(dataSarana, hitungPrediksiHabis);
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
        <small>Ubah kata kunci pencarian atau tab filter.</small>
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

    let tombolMaps = '';
    if (item.koordinat && item.koordinat.lat) {
      tombolMaps = `
        <a href="https://www.google.com/maps/dir/?api=1&destination=${item.koordinat.lat},${item.koordinat.lng}" target="_blank" class="btn-rute-maps">
          Navigasi Maps
        </a>
      `;
    }

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
        <button class="btn-update" data-index="${originalIndex}">+ Catat Token</button>
        <button class="btn-edit" data-index="${originalIndex}">Edit</button>
        <button class="btn-hapus" data-index="${originalIndex}">Hapus</button>
      </div>
    `;

    containerDaftar.appendChild(kartu);
  });

  // Pasang Event Modal Update
  document.querySelectorAll('.btn-update').forEach(btn => {
    btn.addEventListener('click', (e) => {
      indexSaranaTerpilih = Number(e.target.getAttribute('data-index'));
      const sarana = dataSarana[indexSaranaTerpilih];
      const urut = [...sarana.riwayatToken].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
      const terakhir = urut[urut.length - 1];

      document.getElementById('nama-sarana-modal').innerHTML = `
        <strong>${sarana.lokasi}</strong><br>
        <span style="color:#60a5fa; font-size:0.8rem;">
          Patokan Terakhir: <strong>${terakhir.kwh} kWh</strong> (${terakhir.tanggal})
        </span>
      `;
      modalUpdate.style.display = 'flex';
    });
  });

  // Pasang Event Modal Edit
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      indexSaranaTerpilih = Number(e.target.getAttribute('data-index'));
      const sarana = dataSarana[indexSaranaTerpilih];

      document.getElementById('edit-lokasi').value = sarana.lokasi;
      document.getElementById('edit-tipe').value = sarana.tipe;
      editJenisLampu.value = sarana.jenisLampu || 'FL';
      editJumlahLampu.value = sarana.jumlahLampu || 0;
      editJumlahLampu.disabled = sarana.jenisLampu !== 'FL';

      if (sarana.koordinat && sarana.koordinat.lat) {
        document.getElementById('edit-koordinat').value = `${sarana.koordinat.lat}, ${sarana.koordinat.lng}`;
      } else {
        document.getElementById('edit-koordinat').value = '';
      }

      modalEdit.style.display = 'flex';
    });
  });

  // Event Hapus
  document.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      if (confirm('Hapus sarana ini beserta seluruh riwayatnya?')) {
        dataSarana.splice(idx, 1);
        localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
        renderData();
      }
    });
  });
}

// Event Pencarian & Filter
inputCari.addEventListener('input', () => renderData());
tabFilters.forEach(tab => {
  tab.addEventListener('click', () => {
    tabFilters.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    statusFilterAktif = tab.getAttribute('data-filter');
    renderData();
  });
});

// Simpan Form Sarana Baru
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
  const koordinat = parsingKoordinatManual(inputKoordinat.value);

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
    koordinat,
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

// Simpan Perubahan Edit Sarana
formEdit.addEventListener('submit', (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;

  const lokasi = document.getElementById('edit-lokasi').value.trim();
  const tipe = document.getElementById('edit-tipe').value;
  const jenisLampu = editJenisLampu.value;
  const jumlahLampu = jenisLampu === 'FL' ? Number(editJumlahLampu.value) : 0;
  const koordinat = parsingKoordinatManual(document.getElementById('edit-koordinat').value);

  dataSarana[indexSaranaTerpilih].lokasi = lokasi;
  dataSarana[indexSaranaTerpilih].tipe = tipe;
  dataSarana[indexSaranaTerpilih].jenisLampu = jenisLampu;
  dataSarana[indexSaranaTerpilih].jumlahLampu = jumlahLampu;
  dataSarana[indexSaranaTerpilih].koordinat = koordinat;

  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
  modalEdit.style.display = 'none';
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

btnTutupModal.addEventListener('click', () => { modalUpdate.style.display = 'none'; });
btnTutupEdit.addEventListener('click', () => { modalEdit.style.display = 'none'; });

inisialisasiPenampilFoto();
renderData();
