import { hitungPrediksiHabis } from './token-calc.js';
import { kompresBanyakFoto, inisialisasiPenampilFoto } from './image-handler.js';
import { dapatkanKoordinatGPS, parsingKoordinatManual } from './gps.js';
import { filterSarana } from './filter.js';
import { kirimLaporanKeWhatsApp } from './export-wa.js';
import { hitungJarakKm, urutkanRuteTerdekat } from './patrol-route.js';
import { hitungEstimasiBiaya } from './budget-calc.js';
import { cetakDokumenPdfResmi } from './pdf-report.js';
import { scanAngkaMeteranDariFile } from './ocr.js';
import { inisialisasiPeta, perbaruiPinPeta, perbaruiLokasiUserDiPeta, perbaikiUkuranPeta } from './map.js';
import { pasangAlarmTokenHabis } from './calendar-sync.js';
import { dapatkanMisiHariIni, getStatusBBM, catatIsiBbm } from './mission.js';
import { siarkanDataKeCloud, ambilDataSiaranCloud } from './db.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.log('SW Gagal:', err));
  });
}

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');
const selectJenisLampu = document.getElementById('jenisLampu');
const inputJumlahLampu = document.getElementById('jumlahLampu');
const inputFoto = document.getElementById('fotoSarana');
const inputKoordinat = document.getElementById('input-koordinat');
const btnAmbilGps = document.getElementById('btn-ambil-gps');
const btnEksporWa = document.getElementById('btn-ekspor-wa');

// Toolbar
const btnToolRute = document.getElementById('btn-tool-rute');
const btnToolAnggaran = document.getElementById('btn-tool-anggaran');
const btnToolPdf = document.getElementById('btn-tool-pdf');
const btnToolKalender = document.getElementById('btn-tool-kalender');

// OCR
const inputFileOcr = document.getElementById('input-file-ocr');
const btnScanForm = document.getElementById('btn-scan-form');
const btnScanModal = document.getElementById('btn-scan-modal');
let targetInputOcr = null;

// Modal
const modalUpdate = document.getElementById('modal-update');
const formUpdate = document.getElementById('form-update');
const btnTutupModal = document.getElementById('btn-tutup-modal');

const modalAnggaran = document.getElementById('modal-anggaran');
const kontenRincianAnggaran = document.getElementById('konten-rincian-anggaran');
const btnTutupAnggaran = document.getElementById('btn-tutup-anggaran');

const modalEdit = document.getElementById('modal-edit');
const formEdit = document.getElementById('form-edit');
const btnTutupEdit = document.getElementById('btn-tutup-edit');
const editJenisLampu = document.getElementById('edit-jenisLampu');
const editJumlahLampu = document.getElementById('edit-jumlahLampu');

// Elemen Sakelar Siaran & Banner Tamu
const toggleSiar = document.getElementById('toggle-siar-cloud');
const siarStatusText = document.getElementById('siar-status-text');
const panelSakelar = document.getElementById('panel-sakelar-siar');
const bannerTamu = document.getElementById('banner-tamu');
const labelTglSiaran = document.getElementById('label-tgl-siaran');
const btnLoginPetugas = document.getElementById('btn-login-petugas');

// Pencarian & Filter
const inputCari = document.getElementById('input-cari');
const tabFilters = document.querySelectorAll('.tab-filter');

let dataSarana = [];
let indexSaranaTerpilih = null;
let statusFilterAktif = 'semua';
let posisiUserSekarang = null;
let modeRuteAktif = false;
let isModeTamu = false;

const tglHariIni = new Date().toISOString().split('T')[0];
document.getElementById('tanggalPengecekan').value = tglHariIni;
document.getElementById('modalTanggal').value = tglHariIni;

// Navigasi Bawah
const navButtons = document.querySelectorAll('.nav-bottom .nav-item');
const tabViews = document.querySelectorAll('.tab-view');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    tabViews.forEach(v => v.classList.remove('active'));

    btn.classList.add('active');
    const tabTarget = btn.getAttribute('data-tab');
    const viewTarget = document.getElementById(tabTarget);
    if (viewTarget) viewTarget.classList.add('active');

    if (tabTarget === 'view-peta') {
      inisialisasiPeta();
      perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
      if (posisiUserSekarang) {
        perbaruiLokasiUserDiPeta(posisiUserSekarang.lat, posisiUserSekarang.lng);
      }
      perbaikiUkuranPeta();
    } else if (tabTarget === 'view-misi') {
      renderMisiDanBBM();
    }
  });
});

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

btnToolRute.addEventListener('click', async () => {
  if (modeRuteAktif) {
    modeRuteAktif = false;
    btnToolRute.classList.remove('active-route');
    renderData();
    return;
  }

  btnToolRute.innerHTML = `<span>⏳</span><span>GPS...</span>`;
  try {
    posisiUserSekarang = await dapatkanKoordinatGPS();
    modeRuteAktif = true;
    btnToolRute.classList.add('active-route');
    btnToolRute.innerHTML = `<span>🧭</span><span>Rute Aktif</span>`;
    renderData();
    perbaruiLokasiUserDiPeta(posisiUserSekarang.lat, posisiUserSekarang.lng);
  } catch (err) {
    alert('Gagal membaca GPS: ' + err.message);
    btnToolRute.innerHTML = `<span>🧭</span><span>Rute Urut</span>`;
  }
});

btnToolAnggaran.addEventListener('click', () => {
  const hasil = hitungEstimasiBiaya(dataSarana, hitungPrediksiHabis);

  let rincianHtml = `
    <div style="background:#0f172a; padding:12px; border-radius:8px; margin-bottom:12px; border:1px solid #1e293b;">
      <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Total Pengajuan Dana Disarankan:</div>
      <div style="font-size:1.45rem; font-weight:800; color:#10b981; margin:2px 0;">Rp ${hasil.totalEstimasiBiaya.toLocaleString('id-ID')}</div>
      <div style="font-size:0.75rem; color:#60a5fa;">Terdapat ${hasil.daftarPengajuan.length} titik masuk batas pengajuan Bu Reni</div>
    </div>
  `;

  if (hasil.daftarPengajuan.length === 0) {
    rincianHtml += `<p style="font-size:0.85rem; color:#10b981; text-align:center; padding:10px;">Semua titik sarana masih memiliki saldo aman di atas ambang batas pengajuan.</p>`;
  } else {
    rincianHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;
    hasil.daftarPengajuan.forEach(item => {
      rincianHtml += `
        <div style="background:#1a2336; padding:10px; border-radius:8px; border-left:3px solid #f59e0b; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <strong style="color:#fff;">${item.lokasi}</strong>
            <span style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:700; padding:2px 6px; border-radius:4px;">
              Rp ${item.nominalRekomendasi.toLocaleString('id-ID')}
            </span>
          </div>
          <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:2px;">
            Sisa: <strong>${item.sisaKwh.toLocaleString('id-ID')} kWh</strong> • Habis: ±${item.estimasiHari} hari (${item.tanggalHabis})
          </div>
          <div style="font-size:0.72rem; color:#fcd34d;">
            📌 ${item.alasan}
          </div>
        </div>
      `;
    });
    rincianHtml += `</div>`;
  }

  kontenRincianAnggaran.innerHTML = rincianHtml;
  modalAnggaran.style.display = 'flex';
});

btnTutupAnggaran.addEventListener('click', () => { modalAnggaran.style.display = 'none'; });

btnToolPdf.addEventListener('click', () => {
  if (dataSarana.length === 0) {
    alert('Belum ada data untuk dicetak.');
    return;
  }
  const hasilAnggaran = hitungEstimasiBiaya(dataSarana, hitungPrediksiHabis);
  cetakDokumenPdfResmi(dataSarana, hitungPrediksiHabis, hasilAnggaran);
});

btnToolKalender.addEventListener('click', () => {
  pasangAlarmTokenHabis(dataSarana, hitungPrediksiHabis);
});

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
    const angkaTerbaca = await scanAngkaMeteranDariFile(file, () => {
      btnAsal.textContent = 'Memindai...';
    });
    targetInputOcr.value = angkaTerbaca;
    alert(`Berhasil memindai: ${angkaTerbaca} kWh`);
  } catch (err) {
    alert('OCR: ' + err.message);
  } finally {
    btnAsal.disabled = false;
    btnAsal.textContent = teksAsli;
    inputFileOcr.value = '';
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

// LOGIKA SAKELAR SIARAN CLOUD (LIVE TOGGLE)
toggleSiar.addEventListener('change', async () => {
  if (toggleSiar.checked) {
    siarStatusText.textContent = "Mengunggah data ke Cloud...";
    toggleSiar.disabled = true;
    try {
      const meta = await siarkanDataKeCloud(dataSarana);
      localStorage.setItem('status_siar_aktif', 'true');
      siarStatusText.textContent = `🟢 Aktif: ${dataSarana.length} sarana disiarkan`;
      alert("✅ Seluruh data sarana berhasil disiarkan! Siapa pun yang membuka web sekarang dapat melihat seluruh data secara langsung.");
    } catch (err) {
      alert("Gagal menyiarkan: " + err.message);
      toggleSiar.checked = false;
      siarStatusText.textContent = "Gagal menyiarkan";
    } finally {
      toggleSiar.disabled = false;
    }
  } else {
    localStorage.removeItem('status_siar_aktif');
    siarStatusText.textContent = "Matang: Data hanya tersimpan di HP ini";
  }
});

// Tombol Masuk Mode Petugas (Jika membuka dari perangkat baru)
btnLoginPetugas.addEventListener('click', () => {
  const pin = prompt("Masukkan PIN Petugas untuk mengaktifkan mode edit:");
  if (pin === "2026" || pin === "admin") {
    localStorage.setItem('mode_petugas', 'admin');
    location.reload();
  } else {
    alert("PIN salah.");
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

    let infoJarakHtml = '';
    if (modeRuteAktif && posisiUserSekarang && item.koordinat && item.koordinat.lat) {
      const jarak = hitungJarakKm(posisiUserSekarang.lat, posisiUserSekarang.lng, item.koordinat.lat, item.koordinat.lng);
      infoJarakHtml = `<span class="badge-jarak">📍 ± ${jarak.toFixed(2)} km dari posisi Anda</span>`;
    }

    let blokRiwayat = `
      <div class="baris-riwayat">
        <div class="item-riwayat">
          <span class="label-r">Sisa Terakhir:</span>
          <strong>${info.terakhir.kwh.toLocaleString('id-ID')} kWh</strong>
          <small>${info.terakhir.tanggal}</small>
        </div>
    `;

    if (info.sebelumnya) {
      blokRiwayat += `
        <div class="item-riwayat">
          <span class="label-r">Sisa Sebelumnya:</span>
          <strong>${info.sebelumnya.kwh.toLocaleString('id-ID')} kWh</strong>
          <small>${info.sebelumnya.tanggal}</small>
        </div>
      `;
    }
    blokRiwayat += `</div>`;

    const riwayatUrutTerbalik = [...item.riwayatToken].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const barisHistoriHtml = riwayatUrutTerbalik.map((h) => `
      <div class="baris-histori-item" style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
        <span>📅 ${h.tanggal}: <strong>${h.kwh.toLocaleString('id-ID')} kWh</strong></span>
        ${(!isModeTamu && item.riwayatToken.length > 1) ? `<button class="btn-hapus-entri" data-sarana-id="${item.id}" data-tgl="${h.tanggal}" data-kwh="${h.kwh}" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:0.8rem; padding:0 4px;" title="Hapus catatan salah ini">✕</button>` : ''}
      </div>
    `).join('');

    const blokHistoriLengkap = `
      <details class="panel-histori-token">
        <summary style="cursor:pointer; color:#60a5fa; font-weight:600;">Riwayat Pencatatan (${item.riwayatToken.length} Catatan)</summary>
        <div class="daftar-histori-box">
          ${barisHistoriHtml}
        </div>
      </details>
    `;

    let blokAnalisa = '';
    if (info.pesan) {
      blokAnalisa = `<p class="pesan-catatan">${info.pesan}</p>`;
    } else if (info.isAnomali) {
      blokAnalisa = `
        <div class="grid-ringkasan" style="border:1px solid #ef4444; background:rgba(239,68,68,0.1);">
          <div style="color:#ef4444; font-weight:700;">⚠️ TERDETEKSI SALAH KETIK ANGKA:</div>
          <div>${info.keteranganPemakaian}</div>
          <div style="font-size:0.75rem; color:#cbd5e1;">Laju ${info.rataPerHari} kWh/hr tidak realistis untuk ${item.tipe}.</div>
        </div>
      `;
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

    // Tombol aksi hanya tampil untuk petugas
    let footerHtml = '';
    if (!isModeTamu) {
      footerHtml = `
        <div class="kartu-footer">
          <button class="btn-update" data-index="${originalIndex}">+ Catat Token</button>
          <button class="btn-edit" data-index="${originalIndex}">Edit</button>
          <button class="btn-hapus" data-index="${originalIndex}">Hapus</button>
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
          ${info.isAnomali ? 'SALAH INPUT' : info.isTopUp ? 'DIISI ULANG' : info.status === 'kritis' ? 'PERLU DIISI' : info.status === 'waspada' ? 'WASPADA' : info.status === 'aman' ? 'AMAN' : 'AKTIF'}
        </span>
      </div>

      <div class="kartu-body">
        ${blokRiwayat}
        ${blokHistoriLengkap}
        ${blokAnalisa}
        ${tombolMaps}
        ${galeriHtml}
      </div>

      ${footerHtml}
    `;

    containerDaftar.appendChild(kartu);
  });

  if (!isModeTamu) {
    pasangEventTombolPetugas();
  }
}

function pasangEventTombolPetugas() {
  document.querySelectorAll('.btn-hapus-entri').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sId = Number(btn.getAttribute('data-sarana-id'));
      const tgl = btn.getAttribute('data-tgl');
      const kwh = Number(btn.getAttribute('data-kwh'));

      const sarana = dataSarana.find(s => s.id === sId);
      if (!sarana) return;

      if (confirm(`Hapus catatan salah ini (${tgl} - ${kwh} kWh)?`)) {
        const idxEntri = sarana.riwayatToken.findIndex(r => r.tanggal === tgl && Number(r.kwh) === kwh);
        if (idxEntri !== -1) {
          sarana.riwayatToken.splice(idxEntri, 1);
          localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
          renderData();
        }
      }
    });
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
          Patokan Terakhir: <strong>${terakhir.kwh.toLocaleString('id-ID')} kWh</strong> (${terakhir.tanggal})
        </span>
      `;
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
  const sarana = dataSarana[indexSaranaTerpilih];

  sarana.riwayatToken.push({ tanggal: tgl, kwh });
  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));

  formUpdate.reset();
  document.getElementById('modalTanggal').value = tglHariIni;
  modalUpdate.style.display = 'none';
  renderData();
});

btnTutupModal.addEventListener('click', () => { modalUpdate.style.display = 'none'; });
btnTutupEdit.addEventListener('click', () => { modalEdit.style.display = 'none'; });

function renderMisiDanBBM() {
  const containerMisi = document.getElementById('container-list-misi');
  const labelTgl = document.getElementById('label-tgl-misi');
  const sekarang = new Date();

  labelTgl.textContent = sekarang.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  const daftarMisi = dapatkanMisiHariIni();
  containerMisi.innerHTML = daftarMisi.map(m => `
    <div class="misi-item ${m.urgent ? 'urgent' : ''}">
      <div class="misi-top">
        <span class="misi-tag">${m.kategori}</span>
      </div>
      <div class="misi-judul">${m.judul}</div>
      <div class="misi-detail">${m.detail}</div>
      <div class="misi-target">🎯 ${m.target}</div>
    </div>
  `).join('');

  const infoBbm = getStatusBBM();
  document.getElementById('bbm-rentang-text').textContent = infoBbm.rentangPeriode;
  document.getElementById('bbm-sisa-rp').textContent = `Rp ${infoBbm.sisa.toLocaleString('id-ID')}`;
  document.getElementById('bbm-terpakai-rp').textContent = `Rp ${infoBbm.terpakai.toLocaleString('id-ID')}`;

  const persenSisa = Math.max(0, Math.min(100, (infoBbm.sisa / infoBbm.plafon) * 100));
  const elFill = document.getElementById('bbm-progress-fill');
  elFill.style.width = `${persenSisa}%`;
  elFill.style.background = persenSisa <= 20 ? '#ef4444' : persenSisa <= 50 ? '#f59e0b' : '#10b981';

  const boxRiwayat = document.getElementById('list-riwayat-bbm');
  if (infoBbm.riwayat.length === 0) {
    boxRiwayat.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Belum ada pengisian bensin periode ini.</span>`;
  } else {
    boxRiwayat.innerHTML = infoBbm.riwayat.map(r => `
      <div class="bbm-riwayat-item">
        <span>⛽ ${r.tanggal}</span>
        <strong style="color:#fff;">Rp ${r.nominal.toLocaleString('id-ID')}</strong>
      </div>
    `).join('');
  }
}

document.querySelectorAll('.btn-preset-bbm').forEach(btn => {
  btn.addEventListener('click', () => {
    const nominal = Number(btn.getAttribute('data-nominal'));
    catatIsiBbm(nominal);
    renderMisiDanBBM();
  });
});

document.getElementById('form-catat-bbm').addEventListener('submit', (e) => {
  e.preventDefault();
  const inputNominal = document.getElementById('input-nominal-bbm');
  const val = Number(inputNominal.value);
  if (val > 0) {
    catatIsiBbm(val);
    inputNominal.value = '';
    renderMisiDanBBM();
  }
});

// INISIALISASI CERDAS: DETEKSI ADMIN / PENONTON (VIEWER)
async function inisialisasiAplikasi() {
  inisialisasiPenampilFoto();

  const dataLokal = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
  const isExplicitAdmin = localStorage.getItem('mode_petugas') === 'admin';

  // JIKA DI HP KAMU (ADA DATA LOKAL / ADMIN)
  if (dataLokal.length > 0 || isExplicitAdmin) {
    isModeTamu = false;
    dataSarana = dataLokal;
    panelSakelar.style.display = 'flex';
    form.style.display = 'block';
    bannerTamu.style.display = 'none';

    // Cek status toggle lokal
    const siarAktif = localStorage.getItem('status_siar_aktif') === 'true';
    toggleSiar.checked = siarAktif;
    if (siarAktif) {
      siarStatusText.textContent = `🟢 Aktif: ${dataSarana.length} sarana disiarkan`;
    }
    renderData();
  } 
  // JIKA DIBUKA DI HP/LAPTOP ORANG LAIN (MODE TAMU / PENONTON)
  else {
    isModeTamu = true;
    panelSakelar.style.display = 'none';
    form.style.display = 'none'; // Sembunyikan form input agar tidak diubah tamu
    bannerTamu.style.display = 'flex';

    containerDaftar.innerHTML = `
      <div class="state-kosong">
        <p>Menghubungkan ke Siaran Live PT DEVIS JAYA...</p>
      </div>
    `;

    try {
      const dataCloud = await ambilDataSiaranCloud();
      if (dataCloud.daftarSarana.length > 0) {
        dataSarana = dataCloud.daftarSarana;
        labelTglSiaran.textContent = `Pembaruan: ${new Date(dataCloud.infoMeta.waktuUpdate || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        renderData();
      } else {
        containerDaftar.innerHTML = `
          <div class="state-kosong">
            <p>Petugas lapangan belum mengaktifkan sakelar siaran publik.</p>
          </div>
        `;
      }
    } catch (err) {
      containerDaftar.innerHTML = `
        <div class="state-kosong">
          <p>Gagal memuat siaran live: ${err.message}</p>
        </div>
      `;
    }
  }
}

inisialisasiAplikasi();
