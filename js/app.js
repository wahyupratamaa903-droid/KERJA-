import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';
import { dapatkanKoordinatGPS, parsingKoordinatManual } from './gps.js';
import { filterSarana } from './filter.js';
import { kirimLaporanKeWhatsApp } from './export-wa.js';

// Elemen Antarmuka
const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const inputKoordinat = document.getElementById('input-koordinat');
const btnAmbilGps = document.getElementById('btn-ambil-gps');
const btnEksporWa = document.getElementById('btn-ekspor-wa');

const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

const modalEdit = document.getElementById('modal-edit');
const formEdit = document.getElementById('form-edit');
const btnTutupEdit = document.getElementById('btn-tutup-edit');
const editJenisLampu = document.getElementById('edit-jenisLampu');
const editJumlahLampu = document.getElementById('edit-jumlahLampu');

const inputCari = document.getElementById('input-cari');
const tabFilters = document.querySelectorAll('.tab-filter');

let dataSarana = [];
let indexSaranaTerpilih = null;
let statusFilterAktif = 'semua';

const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Logika Lampu
selectJenisLampu.addEventListener('change', () => {
  if (selectJenisLampu.value === 'FL') {
    inputJumlahLampu.disabled = false;
    inputJumlahLampu.placeholder = 'Jumlah titik lampu FL';
  } else {
    inputJumlahLampu.disabled = true;
    inputJumlahLampu.value = '0';
  }
});

editJenisLampu.addEventListener('change', () => {
  if (editJenisLampu.value === 'FL') {
    editJumlahLampu.disabled = false;
  } else {
    editJumlahLampu.disabled = true;
    editJumlahLampu.value = '0';
  }
});

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

btnEksporWa.addEventListener('click', async () => {
  if (dataSarana.length === 0) {
    alert('Belum ada data sarana untuk dilaporkan.');
    return;
  }
  const teksAsli = btnEksporWa.textContent;
  btnEksporWa.disabled = true;
  btnEksporWa.textContent = 'Menyiapkan Laporan...';
  try {
    await kirimLaporanKeWhatsApp(dataSarana, hitungPrediksiHabis);
  } catch (err) {
    console.error(err);
  } finally {
    btnEksporWa.disabled = false;
    btnEksporWa.textContent = teksAsli;
  }
});

// Fitur Unduh Cadangan Fisik (Anti Hilang)
function buatTombolCadangan() {
  if (document.getElementById('btn-cadang-file')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-cadang-file';
  btn.textContent = '📥 Unduh Cadangan Data (File JSON)';
  btn.style.cssText = 'width:100%; padding:9px; background:#1e293b; color:#94a3b8; border:1px solid #334155; border-radius:8px; font-size:0.75rem; margin-bottom:14px; cursor:pointer; font-weight:600;';
  btn.addEventListener('click', () => {
    if (dataSarana.length === 0) {
      alert('Belum ada data untuk diunduh.');
      return;
    }
    const blob = new Blob([JSON.stringify(dataSarana, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cadangan_sarana_${tglHariIni}.json`;
    link.click();
  });
  btnEksporWa.insertAdjacentElement('afterend', btn);
}

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
  buatTombolCadangan();

  const dataTersaring = filterSarana(dataSarana, inputCari.value, statusFilterAktif, hitungPrediksiHabis);

  if (dataTersaring.length === 0) {
    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Tidak ada titik sarana yang cocok.</p>
        <small>Penyimpanan lokal terlindungi secara mandiri.</small>
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
      blokAnalisa = `
        <div class="grid-ringkasan">
          <div>${info.keteranganPemakaian}</div>
          <div>Rata-rata: <strong>${info.rataPerHari} kWh/hr</strong></div>
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
      document.getElementById('modalBeliKwh').value = '';
      modalUpdate.style.display = 'flex';
    });
  });

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

  document.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      const targetSarana = dataSarana[idx];
      if (confirm(`Hapus sarana "${targetSarana.lokasi}"?`)) {
        dataSarana.splice(idx, 1);
        localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
        renderData();
      }
    });
  });
}

inputCari.addEventListener('input', () => renderData());
tabFilters.forEach(tab => {
  tab.addEventListener('click', () => {
    tabFilters.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    statusFilterAktif = tab.getAttribute('data-filter');
    renderData();
  });
});

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

  const saranaBaru = {
    id: Date.now(),
    lokasi,
    tipe,
    jenisLampu,
    jumlahLampu,
    koordinat,
    fotos,
    riwayatToken: [{ tanggal, kwh }]
  };

  dataSarana.unshift(saranaBaru);
  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));

  form.reset();
  document.getElementById('tanggalPengecekan').value = tglHariIni;
  inputJumlahLampu.disabled = false;
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Simpan Sarana';
  renderData();
});

formEdit.addEventListener('submit', (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;

  const sarana = dataSarana[indexSaranaTerpilih];
  sarana.lokasi = document.getElementById('edit-lokasi').value.trim();
  sarana.tipe = document.getElementById('edit-tipe').value;
  sarana.jenisLampu = editJenisLampu.value;
  sarana.jumlahLampu = sarana.jenisLampu === 'FL' ? Number(editJumlahLampu.value) : 0;
  sarana.koordinat = parsingKoordinatManual(document.getElementById('edit-koordinat').value);

  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
  modalEdit.style.display = 'none';
  renderData();
});

formUpdate.addEventListener('submit', (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;

  const tgl = document.getElementById('modalTanggal').value;
  const kwh = Number(document.getElementById('modalKwh').value);
  const kwhBeliRaw = document.getElementById('modalBeliKwh').value;
  const sarana = dataSarana[indexSaranaTerpilih];

  const entriBaru = { tanggal: tgl, kwh };
  if (kwhBeliRaw && Number(kwhBeliRaw) > 0) {
    entriBaru.kwhBeli = Number(kwhBeliRaw);
  }

  sarana.riwayatToken.push(entriBaru);
  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));

  formUpdate.reset();
  document.getElementById('modalTanggal').value = tglHariIni;
  modalUpdate.style.display = 'none';
  renderData();
});

btnTutupModal.addEventListener('click', () => { modalUpdate.style.display = 'none'; });
btnTutupEdit.addEventListener('click', () => { modalEdit.style.display = 'none'; });

// Fungsi Penyelamat: Menyisir seluruh memori browser tanpa kecuali
function pulihkanDataSemuaKunci() {
  let hasil = [];

  // 1. Cek semua riwayat kunci nama yang pernah dipakai
  const daftarKunci = ['sarana-kerja-v3', 'sarana-kerja-v2', 'sarana-kerja', 'data-sarana'];
  for (const k of daftarKunci) {
    try {
      const data = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(data) && data.length > hasil.length) {
        hasil = data;
      }
    } catch (e) {}
  }

  // 2. Jika masih kosong, periksa seluruh isi penyimpanan browser
  if (hasil.length === 0) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(val) && val.length > 0 && (val[0].lokasi || val[0].riwayatToken)) {
          if (val.length > hasil.length) {
            hasil = val;
          }
        }
      } catch (e) {}
    }
  }

  // Amankan data yang ditemukan ke kunci permanen
  if (hasil.length > 0) {
    localStorage.setItem('sarana-kerja-v3', JSON.stringify(hasil));
  }
  return hasil;
}

function inisialisasiAplikasi() {
  inisialisasiPenampilFoto();
  dataSarana = pulihkanDataSemuaKunci();
  renderData();
}

inisialisasiAplikasi();
