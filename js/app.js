import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';
import { dapatkanKoordinatGPS, parsingKoordinatManual } from './gps.js';
import { filterSarana } from './filter.js';
import { kirimLaporanKeWhatsApp } from './export-wa.js';
import { hitungJarakKm, urutkanRuteTerdekat } from './patrol-route.js';
import { hitungEstimasiBiaya } from './budget-calc.js';
import { cetakDokumenPdfResmi } from './pdf-report.js';
import { scanAngkaMeteranDariFile } from './ocr.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const inputKoordinat = document.getElementById('input-koordinat');
const btnAmbilGps = document.getElementById('btn-ambil-gps');
const btnEksporWa = document.getElementById('btn-ekspor-wa');

// Toolbar Tombol Baru
const btnToolRute = document.getElementById('btn-tool-rute');
const btnToolAnggaran = document.getElementById('btn-tool-anggaran');
const btnToolPdf = document.getElementById('btn-tool-pdf');

// Elemen OCR
const inputFileOcr = document.getElementById('input-file-ocr');
const btnScanForm = document.getElementById('btn-scan-form');
const btnScanModal = document.getElementById('btn-scan-modal');
let targetInputOcr = null;

// Modal Update Token
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

// Modal Anggaran
const modalAnggaran = document.getElementById('modal-anggaran');
const kontenRincianAnggaran = document.getElementById('konten-rincian-anggaran');
const btnTutupAnggaran = document.getElementById('btn-tutup-anggaran');

// Modal Edit Sarana
const modalEdit = document.getElementById('modal-edit');
const formEdit = document.getElementById('form-edit');
const btnTutupEdit = document.getElementById('btn-tutup-edit');
const editJenisLampu = document.getElementById('edit-jenisLampu');
const editJumlahLampu = document.getElementById('edit-jumlahLampu');

// Pencarian & Filter
const inputCari = document.getElementById('input-cari');
const tabFilters = document.querySelectorAll('.tab-filter');

let dataSarana = [];
let indexSaranaTerpilih = null;
let statusFilterAktif = 'semua';
let posisiUserSekarang = null;
let modeRuteAktif = false;

const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Logika Lampu Form Tambah & Edit
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

// Fitur GPS Otomatis Form
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

// Fitur 1: Optimasi Rute Patroli
btnToolRute.addEventListener('click', async () => {
  if (modeRuteAktif) {
    modeRuteAktif = false;
    btnToolRute.classList.remove('active-route');
    renderData();
    return;
  }

  btnToolRute.innerHTML = `<span>⏳</span><span>Mencari GPS...</span>`;
  try {
    posisiUserSekarang = await dapatkanKoordinatGPS();
    modeRuteAktif = true;
    btnToolRute.classList.add('active-route');
    btnToolRute.innerHTML = `<span>🧭</span><span>Rute Aktif</span>`;
    renderData();
  } catch (err) {
    alert('Gagal membaca lokasi Anda: ' + err.message);
    btnToolRute.innerHTML = `<span>🧭</span><span>Rute Patroli</span>`;
  }
});

// Fitur 2: Estimasi Anggaran
btnToolAnggaran.addEventListener('click', () => {
  const hasil = hitungEstimasiBiaya(dataSarana, hitungPrediksiHabis);

  let rincianHtml = `
    <div style="background:#0f172a; padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid #1e293b;">
      <div style="font-size:0.8rem; color:#94a3b8;">Total Kebutuhan Anggaran:</div>
      <div style="font-size:1.3rem; font-weight:800; color:#10b981;">Rp ${hasil.totalEstimasiBiaya.toLocaleString('id-ID')}</div>
      <div style="font-size:0.75rem; color:#60a5fa; margin-top:2px;">Cadangan 30 hari untuk ${hasil.saranaKritis.length} sarana kritis</div>
    </div>
  `;

  if (hasil.saranaKritis.length === 0) {
    rincianHtml += `<p style="font-size:0.85rem; color:#10b981;">Semua sarana dalam kondisi aman.</p>`;
  } else {
    rincianHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;
    hasil.saranaKritis.forEach(item => {
      rincianHtml += `
        <div style="background:#1a2336; padding:8px 10px; border-radius:6px; border-left:3px solid #ef4444; font-size:0.8rem;">
          <strong>${item.lokasi}</strong><br>
          <span style="color:#94a3b8;">Sisa: ${item.sisaKwh} kWh • Habis: ±${item.estimasiHari} hr</span><br>
          <span style="color:#f59e0b; font-weight:600;">Perkiraan Beli: Rp ${item.estimasiRp.toLocaleString('id-ID')} (${item.kebutuhanKwh} kWh)</span>
        </div>
      `;
    });
    rincianHtml += `</div>`;
  }

  kontenRincianAnggaran.innerHTML = rincianHtml;
  modalAnggaran.style.display = 'flex';
});

btnTutupAnggaran.addEventListener('click', () => {
  modalAnggaran.style.display = 'none';
});

// Fitur 3: Ekspor Dokumen PDF Resmi
btnToolPdf.addEventListener('click', () => {
  if (dataSarana.length === 0) {
    alert('Belum ada data untuk dicetak.');
    return;
  }
  const hasilAnggaran = hitungEstimasiBiaya(dataSarana, hitungPrediksiHabis);
  cetakDokumenPdfResmi(dataSarana, hitungPrediksiHabis, hasilAnggaran);
});

// Fitur 4: Scan Kamera Meteran (OCR)
btnScanForm.addEventListener('click', () => {
  targetInputOcr = document.getElementById('sisaKwh');
  inputFileOcr.click();
});

btnScanModal.addEventListener('click', () => {
  targetInputOcr = document.getElementById('modalKwh');
  inputFileOcr.click();
});

inputFileOcr.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !targetInputOcr) return;

  const btnAsal = targetInputOcr.id === 'sisaKwh' ? btnScanForm : btnScanModal;
  const teksAsli = btnAsal.textContent;
  btnAsal.disabled = true;

  try {
    const angkaTerbaca = await scanAngkaMeteranDariFile(file, (pesan) => {
      btnAsal.textContent = 'Memindai...';
    });
    targetInputOcr.value = angkaTerbaca;
    alert(`Berhasil memindai angka meteran: ${angkaTerbaca} kWh`);
  } catch (err) {
    alert('OCR: ' + err.message);
  } finally {
    btnAsal.disabled = false;
    btnAsal.textContent = teksAsli;
    inputFileOcr.value = '';
  }
});

// WhatsApp Share
btnEksporWa.addEventListener('click', async () => {
  if (dataSarana.length === 0) {
    alert('Belum ada data sarana untuk dilaporkan.');
    return;
  }
  const teksAsli = btnEksporWa.textContent;
  btnEksporWa.disabled = true;
  btnEksporWa.textContent = 'Menyiapkan Foto & Laporan...';
  try {
    await kirimLaporanKeWhatsApp(dataSarana, hitungPrediksiHabis);
  } catch (err) {
    console.error(err);
  } finally {
    btnEksporWa.disabled = false;
    btnEksporWa.textContent = teksAsli;
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

  let daftarTampil = [...dataSarana];

  // Jika tombol optimasi rute patroli sedang aktif
  if (modeRuteAktif && posisiUserSekarang) {
    daftarTampil = urutkanRuteTerdekat(daftarTampil, posisiUserSekarang);
  }

  const dataTersaring = filterSarana(daftarTampil, inputCari.value, statusFilterAktif, hitungPrediksiHabis);

  if (dataTersaring.length === 0) {
    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Tidak ada titik sarana yang cocok.</p>
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

    // Label jarak dari user jika rute patroli aktif
    let infoJarakHtml = '';
    if (modeRuteAktif && posisiUserSekarang && item.koordinat && item.koordinat.lat) {
      const jarak = hitungJarakKm(posisiUserSekarang.lat, posisiUserSekarang.lng, item.koordinat.lat, item.koordinat.lng);
      infoJarakHtml = `<span class="badge-jarak">📍 ± ${jarak.toFixed(2)} km dari posisi Anda</span>`;
    }

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
          ${infoJarakHtml}
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

function inisialisasiAplikasi() {
  inisialisasiPenampilFoto();
  dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
  renderData();
}

inisialisasiAplikasi();
