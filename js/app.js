// js/app.js - Mesin Utama Stabil & Anti-Crash PT DEVIS JAYA
import { analisaDayaDanEstimasi } from './plugins/power-engine.js';
import { filterSarana } from './filter.js';
import { getStatusBBM, catatIsiBbm, dapatkanMisiHariIni } from './mission.js';
import { ambilDataDariServer, kirimDataKeServer } from './cloud-sync.js';
import { inisialisasiPeta, perbaruiPinPeta, perbaikiUkuranPeta } from './map.js';

const hitungPrediksiHabis = analisaDayaDanEstimasi;

let isPetugas = localStorage.getItem('devis_petugas_auth') === 'granted';
let dataSarana = [];
let statusFilterAktif = 'semua';
let indexSaranaTerpilih = null;

// ELEMEN DOM
const containerDaftar = document.getElementById('daftar-sarana');
const inputCari = document.getElementById('input-cari');
const filterTipe = document.getElementById('filter-tipe');
const filterLampu = document.getElementById('filter-lampu');
const formSarana = document.getElementById('form-sarana');
const elTotal = document.getElementById('stat-total');
const elIsi = document.getElementById('stat-isi');

// 1. PENARIKAN DATA OTOMATIS (FIREBASE & STORAGE)
async function muatDataUtama() {
  // Coba baca dari penyimpanan lokal HP
  const lokal = localStorage.getItem('sarana-kerja-v3');
  if (lokal) {
    try {
      const parsed = JSON.parse(lokal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dataSarana = parsed;
        renderData();
      }
    } catch (e) {}
  }

  // Tarik data 19 sarana dari Google Firebase Cloud
  try {
    const dariServer = await ambilDataDariServer();
    if (dariServer && Array.isArray(dariServer) && dariServer.length > 0) {
      dataSarana = dariServer;
      localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
      renderData();
    }
  } catch (err) {
    console.warn("Gagal tarik cloud:", err);
  }

  // Perbarui Peta jika koordinat tersedia
  if (typeof perbaruiPinPeta === 'function') {
    perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
  }
}

// 2. KONTROL AKSES TAMU VS PETUGAS
function sesuaikanTampilanAkses() {
  const tabMisi = document.getElementById('nav-tab-misi');
  const fabVoice = document.getElementById('fab-voice-cmd');
  const btnVault = document.getElementById('btn-buka-vault');
  const boxBbm = document.getElementById('box-aksi-bbm');
  const btnAuth = document.getElementById('btn-toggle-auth');

  if (isPetugas) {
    btnAuth.textContent = "👑 Petugas";
    btnAuth.className = "btn-header-action auth active";
    if (formSarana) formSarana.style.display = "block";
    if (tabMisi) tabMisi.style.display = "flex";
    if (fabVoice) fabVoice.style.display = "flex";
    if (btnVault) btnVault.style.display = "block";
    if (boxBbm) boxBbm.style.display = "block";
  } else {
    btnAuth.textContent = "🔐 Tamu";
    btnAuth.className = "btn-header-action auth";
    if (formSarana) formSarana.style.display = "none";
    if (tabMisi) tabMisi.style.display = "none";
    if (fabVoice) fabVoice.style.display = "none";
    if (btnVault) btnVault.style.display = "none";
    if (boxBbm) boxBbm.style.display = "none";
  }
}

// 3. RENDER KARTU SARANA & STATISTIK
function renderData() {
  if (!containerDaftar) return;
  containerDaftar.innerHTML = '';

  let totalKritis = 0;
  dataSarana.forEach(s => {
    const info = hitungPrediksiHabis(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    if (info.status === 'kritis' || info.status === 'waspada') totalKritis++;
  });

  if (elTotal) elTotal.textContent = dataSarana.length;
  if (elIsi) elIsi.textContent = totalKritis;

  const dataTersaring = filterSarana(
    dataSarana,
    inputCari ? inputCari.value : '',
    statusFilterAktif,
    hitungPrediksiHabis,
    filterTipe ? filterTipe.value : '',
    filterLampu ? filterLampu.value : ''
  );

  dataTersaring.forEach((item) => {
    const originalIndex = dataSarana.findIndex(s => s.id === item.id);
    const info = hitungPrediksiHabis(item.riwayatToken, item.jumlahLampu, item.jenisLampu);
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${info.status}`;

    let infoHariBerjalan = '';
    if (info.hariBerlalu > 0) {
      infoHariBerjalan = ` • <span style="color:#60a5fa;">Est. Riil: ±${info.sisaKwhEstimasiSekarang.toLocaleString('id-ID')} kWh (${info.hariBerlalu} hr lalu)</span>`;
    }

    const sisaTerakhir = item.riwayatToken && item.riwayatToken.length > 0
      ? item.riwayatToken[item.riwayatToken.length - 1].kwh.toLocaleString('id-ID')
      : '-';

    let tombolAksiPetugas = '';
    if (isPetugas) {
      tombolAksiPetugas = `
        <div class="kartu-footer" style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn-update btn-catat-kartu" data-index="${originalIndex}" style="flex:2; background:#2563eb; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:700; cursor:pointer;">+ Catat Token</button>
          <button type="button" class="btn-edit btn-edit-kartu" data-index="${originalIndex}" style="flex:1; background:#334155; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer;">Edit</button>
          <button type="button" class="btn-hapus btn-hapus-kartu" data-index="${originalIndex}" style="flex:1; background:#ef4444; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer;">Hapus</button>
        </div>
      `;
    }

    kartu.innerHTML = `
      <div class="kartu-header">
        <div>
          <span style="font-size:0.75rem; color:#94a3b8; font-weight:800;">${item.tipe} • ${item.jenisLampu} (${item.jumlahLampu || 0} Titik)</span>
          <h3 class="lokasi-sarana" style="margin:2px 0; color:#fff;">${item.lokasi}</h3>
        </div>
        <span class="tag-status ${info.status}">${info.status.toUpperCase()}</span>
      </div>
      <div class="kartu-body">
        <div class="grid-ringkasan">
          <div>Laju: <strong>${info.rataPerHari} kWh/hr</strong> (Beban: ±${info.wattTerdeteksi || 0} Watt)</div>
          <div style="font-size:0.75rem; color:#cbd5e1; margin-top:2px;">
            Sisa Tercatat: <strong>${sisaTerakhir} kWh</strong>${infoHariBerjalan}
          </div>
          <div class="sorot-hari" style="margin-top:4px;">
            Estimasi: <strong>± ${info.estimasiHari} Hari (${info.tanggalHabis})</strong>
          </div>
        </div>
        ${item.koordinat && item.koordinat.lat ? `
          <a href="https://www.google.com/maps/dir/?api=1&destination=${item.koordinat.lat},${item.koordinat.lng}" target="_blank" class="btn-rute-maps" style="display:block; text-align:center; background:#065f46; color:#34d399; text-decoration:none; padding:7px; border-radius:6px; font-size:0.75rem; font-weight:700; margin-top:8px;">
            Navigasi Google Maps ➔
          </a>
        ` : ''}
      </div>
      ${tombolAksiPetugas}
    `;

    containerDaftar.appendChild(kartu);
  });

  // Pasang Listener Tombol di Tiap Kartu
  containerDaftar.querySelectorAll('.btn-catat-kartu').forEach(btn => {
    btn.onclick = () => {
      indexSaranaTerpilih = Number(btn.dataset.index);
      const s = dataSarana[indexSaranaTerpilih];
      document.getElementById('nama-sarana-modal').textContent = s.lokasi;
      document.getElementById('modalTanggal').value = new Date().toISOString().split('T')[0];
      document.getElementById('modalKwh').value = '';
      document.getElementById('modal-update').style.display = 'flex';
    };
  });

  containerDaftar.querySelectorAll('.btn-edit-kartu').forEach(btn => {
    btn.onclick = () => {
      indexSaranaTerpilih = Number(btn.dataset.index);
      const s = dataSarana[indexSaranaTerpilih];
      document.getElementById('edit-lokasi').value = s.lokasi;
      document.getElementById('edit-tipe').value = s.tipe;
      document.getElementById('edit-jenisLampu').value = s.jenisLampu;
      document.getElementById('edit-jumlahLampu').value = s.jumlahLampu || 0;
      document.getElementById('edit-koordinat').value = s.koordinat ? `${s.koordinat.lat}, ${s.koordinat.lng}` : '';
      document.getElementById('modal-edit').style.display = 'flex';
    };
  });

  containerDaftar.querySelectorAll('.btn-hapus-kartu').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.index);
      if (confirm(`Yakin ingin menghapus sarana "${dataSarana[idx].lokasi}"?`)) {
        dataSarana.splice(idx, 1);
        simpanKeStorage();
        renderData();
      }
    };
  });
}

function simpanKeStorage() {
  localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
  kirimDataKeServer(dataSarana).catch(() => {});
  if (typeof perbaruiPinPeta === 'function') {
    perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
  }
}

// 4. EVENT FORM UPDATE TOKEN
const formUpdate = document.getElementById('form-update');
if (formUpdate) {
  formUpdate.onsubmit = (e) => {
    e.preventDefault();
    if (indexSaranaTerpilih === null) return;
    const tgl = document.getElementById('modalTanggal').value;
    const kwh = Number(document.getElementById('modalKwh').value);
    dataSarana[indexSaranaTerpilih].riwayatToken.push({ tanggal: tgl, kwh: kwh });
    simpanKeStorage();
    document.getElementById('modal-update').style.display = 'none';
    renderData();
  };
}
const btnTutupModal = document.getElementById('btn-tutup-modal');
if (btnTutupModal) btnTutupModal.onclick = () => { document.getElementById('modal-update').style.display = 'none'; };

// 5. EVENT FORM EDIT SARANA
const formEdit = document.getElementById('form-edit');
if (formEdit) {
  formEdit.onsubmit = (e) => {
    e.preventDefault();
    if (indexSaranaTerpilih === null) return;
    const item = dataSarana[indexSaranaTerpilih];
    item.lokasi = document.getElementById('edit-lokasi').value;
    item.tipe = document.getElementById('edit-tipe').value;
    item.jenisLampu = document.getElementById('edit-jenisLampu').value;
    item.jumlahLampu = Number(document.getElementById('edit-jumlahLampu').value);
    const kStr = document.getElementById('edit-koordinat').value;
    if (kStr.includes(',')) {
      const [lat, lng] = kStr.split(',').map(n => parseFloat(n.trim()));
      if (!isNaN(lat) && !isNaN(lng)) item.koordinat = { lat, lng };
    }
    simpanKeStorage();
    document.getElementById('modal-edit').style.display = 'none';
    renderData();
  };
}
const btnTutupEdit = document.getElementById('btn-tutup-edit');
if (btnTutupEdit) btnTutupEdit.onclick = () => { document.getElementById('modal-edit').style.display = 'none'; };

// 6. EVENT FORM SARANA BARU
if (formSarana) {
  formSarana.onsubmit = (e) => {
    e.preventDefault();
    const lokasi = document.getElementById('lokasi').value;
    const tipe = document.getElementById('tipe').value;
    const jenisLampu = document.getElementById('jenisLampu').value;
    const jumlahLampu = Number(document.getElementById('jumlahLampu').value) || 0;
    const tanggal = document.getElementById('tanggalPengecekan').value;
    const kwh = Number(document.getElementById('sisaKwh').value);

    let koordinat = { lat: -3.8000, lng: 102.2650 };
    const kStr = document.getElementById('input-koordinat').value;
    if (kStr && kStr.includes(',')) {
      const [lat, lng] = kStr.split(',').map(n => parseFloat(n.trim()));
      if (!isNaN(lat) && !isNaN(lng)) koordinat = { lat, lng };
    }

    dataSarana.unshift({
      id: Date.now(),
      lokasi,
      tipe,
      jenisLampu,
      jumlahLampu,
      koordinat,
      riwayatToken: [{ tanggal, kwh }]
    });

    simpanKeStorage();
    formSarana.reset();
    renderData();
    alert("Sarana baru berhasil disimpan!");
  };
}

// 7. EVENT TOOLBAR (AMAN DARI CRASH DENGAN DYNAMIC IMPORT)
const btnAnggaran = document.getElementById('btn-tool-anggaran');
if (btnAnggaran) {
  btnAnggaran.onclick = async () => {
    const modalAnggaran = document.getElementById('modal-anggaran');
    const kontenAnggaran = document.getElementById('konten-rincian-anggaran');
    modalAnggaran.style.display = 'flex';
    kontenAnggaran.innerHTML = `<div style="text-align:center; padding:20px; color:#60a5fa;">⏳ Menganalisis kondisi cuaca & kebutuhan dana...</div>`;
    try {
      const { buatAnalisisAnggaranAI } = await import('./plugins/ai-advisor.js');
      const html = await buatAnalisisAnggaranAI(dataSarana, hitungPrediksiHabis);
      kontenAnggaran.innerHTML = html;
    } catch (err) {
      kontenAnggaran.innerHTML = `<div style="color:#ef4444; padding:10px;">Gagal memuat AI: ${err.message}</div>`;
    }
  };
}
const btnTutupAnggaran = document.getElementById('btn-tutup-anggaran');
if (btnTutupAnggaran) btnTutupAnggaran.onclick = () => { document.getElementById('modal-anggaran').style.display = 'none'; };

const btnBrief = document.getElementById('btn-tool-jarvis-brief');
if (btnBrief) {
  btnBrief.onclick = async () => {
    try {
      const { bacakanMorningBrief, bacakanBriefTamu } = await import('./plugins/devis-jarvis.js');
      if (isPetugas) bacakanMorningBrief(dataSarana, getStatusBBM(), hitungPrediksiHabis);
      else bacakanBriefTamu();
    } catch (e) {
      alert("Brief Suara: " + e.message);
    }
  };
}

const btnRute = document.getElementById('btn-tool-rute');
if (btnRute) {
  btnRute.onclick = async () => {
    try {
      const { bukaModalOptimasiBBM } = await import('./plugins/fuel-optimizer.js');
      let pos = { lat: -3.8000, lng: 102.2650 };
      try {
        const { dapatkanKoordinatGPS } = await import('./gps.js');
        pos = await dapatkanKoordinatGPS();
      } catch (e) {}
      bukaModalOptimasiBBM(dataSarana, pos, hitungPrediksiHabis);
    } catch (e) {
      alert("Rute BBM: " + e.message);
    }
  };
}

const btnPdf = document.getElementById('btn-tool-pdf');
if (btnPdf) {
  btnPdf.onclick = async () => {
    try {
      const modPdf = await import('./pdf-report.js');
      const fn = modPdf.generatePDFLaporan || modPdf.buatLaporanPDF || modPdf.exportPDF;
      if (fn) fn(dataSarana, hitungPrediksiHabis);
      else alert("Modul PDF sedang diperbarui.");
    } catch (e) {
      alert("PDF: " + e.message);
    }
  };
}

const btnWa = document.getElementById('btn-ekspor-wa');
if (btnWa) {
  btnWa.onclick = async () => {
    try {
      const modWa = await import('./export-wa.js');
      const fn = modWa.eksporRekapWhatsApp || modWa.eksporKeWhatsApp;
      if (fn) fn(dataSarana, hitungPrediksiHabis);
      else alert("Rekap WhatsApp siap dikirim.");
    } catch (e) {
      alert("WhatsApp: " + e.message);
    }
  };
}

// 8. EVENT FILTER PENCARIAN
if (inputCari) inputCari.oninput = renderData;
if (filterTipe) filterTipe.onchange = renderData;
if (filterLampu) filterLampu.onchange = renderData;
document.querySelectorAll('.tab-filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    statusFilterAktif = btn.dataset.filter;
    renderData();
  };
});

// 9. EVENT PIN PETUGAS
const modalAuth = document.getElementById('modal-auth');
const btnAuthToggle = document.getElementById('btn-toggle-auth');
if (btnAuthToggle) {
  btnAuthToggle.onclick = () => {
    if (isPetugas) {
      if (confirm("Beralih ke Mode Tamu?")) {
        isPetugas = false;
        localStorage.removeItem('devis_petugas_auth');
        sesuaikanTampilanAkses();
        renderData();
      }
    } else {
      if (modalAuth) modalAuth.style.display = 'flex';
    }
  };
}
const btnTutupAuth = document.getElementById('btn-tutup-auth');
if (btnTutupAuth) btnTutupAuth.onclick = () => { modalAuth.style.display = 'none'; };

const formAuthPin = document.getElementById('form-auth-pin');
if (formAuthPin) {
  formAuthPin.onsubmit = (e) => {
    e.preventDefault();
    const pin = document.getElementById('input-pin-petugas').value;
    if (pin === '1234' || pin === '903' || pin === '2026') {
      isPetugas = true;
      localStorage.setItem('devis_petugas_auth', 'granted');
      modalAuth.style.display = 'none';
      sesuaikanTampilanAkses();
      renderData();
      alert("Akses Petugas Diberikan!");
    } else {
      alert("PIN Petugas Salah!");
    }
  };
}

// 10. NAVIGASI TAB BAWAH
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const targetView = document.getElementById(btn.dataset.tab);
    if (targetView) targetView.classList.add('active');

    if (btn.dataset.tab === 'view-peta') {
      inisialisasiPeta();
      perbaikiUkuranPeta();
      perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
    } else if (btn.dataset.tab === 'view-misi') {
      renderMisiDanBBM();
    }
  };
});

// 11. MISI & BBM
function renderMisiDanBBM() {
  const containerMisi = document.getElementById('container-list-misi');
  if (containerMisi) {
    const misi = dapatkanMisiHariIni();
    containerMisi.innerHTML = misi.map(m => `
      <div style="background:rgba(15,23,42,0.6); padding:10px; border-radius:8px; border-left:3px solid #ef4444; margin-bottom:8px;">
        <span style="font-size:0.68rem; color:#ef4444; font-weight:700;">${m.kategori}</span>
        <h4 style="color:#fff; font-size:0.85rem; margin:2px 0;">${m.judul}</h4>
        <p style="font-size:0.72rem; color:#94a3b8; margin:0;">${m.detail}</p>
      </div>
    `).join('');
  }

  const bbm = getStatusBBM();
  const elSisa = document.getElementById('bbm-sisa-rp');
  const elPakai = document.getElementById('bbm-terpakai-rp');
  const elFill = document.getElementById('bbm-progress-fill');
  if (elSisa) elSisa.textContent = `Rp ${bbm.sisa.toLocaleString('id-ID')}`;
  if (elPakai) elPakai.textContent = `Rp ${bbm.terpakai.toLocaleString('id-ID')}`;
  if (elFill) {
    const pct = Math.max(0, Math.min(100, (bbm.sisa / bbm.plafon) * 100));
    elFill.style.width = `${pct}%`;
  }

  const listBbm = document.getElementById('list-riwayat-bbm');
  if (listBbm) {
    listBbm.innerHTML = bbm.riwayat.map(r => `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.75rem;">
        <span style="color:#94a3b8;">⛽ ${r.tanggal}</span>
        <strong style="color:#10b981;">Rp ${r.nominal.toLocaleString('id-ID')}</strong>
      </div>
    `).join('');
  }
}

document.querySelectorAll('.btn-preset-bbm').forEach(btn => {
  btn.onclick = () => {
    catatIsiBbm(Number(btn.dataset.nominal));
    renderMisiDanBBM();
  };
});
const formBbm = document.getElementById('form-catat-bbm');
if (formBbm) {
  formBbm.onsubmit = (e) => {
    e.preventDefault();
    const val = Number(document.getElementById('input-nominal-bbm').value);
    if (val > 0) {
      catatIsiBbm(val);
      document.getElementById('input-nominal-bbm').value = '';
      renderMisiDanBBM();
    }
  };
}

// 12. FLOATING MIC COMMANDER
const fabVoice = document.getElementById('fab-voice-cmd');
if (fabVoice) {
  let sedangRekam = false;
  fabVoice.onclick = async () => {
    try {
      const { mulaiRekamSuara, hentikanDanProsesSuara, ekstrakDataTokenDenganAI } = await import('./plugins/devis-jarvis.js');
      const hud = document.getElementById('hud-voice');
      const teksHud = document.getElementById('teks-hud-voice');

      if (!sedangRekam) {
        await mulaiRekamSuara();
        sedangRekam = true;
        fabVoice.classList.add('recording');
        fabVoice.textContent = '⏹️';
        if (hud) {
          hud.style.display = 'flex';
          teksHud.textContent = 'Mendengarkan... Ucapkan: Lokasi & Sisa kWh';
        }
      } else {
        sedangRekam = false;
        fabVoice.classList.remove('recording');
        fabVoice.textContent = '🎙️';
        if (teksHud) teksHud.textContent = 'AI sedang memproses...';

        const teksHasil = await hentikanDanProsesSuara();
        const dataEkstrak = await ekstrakDataTokenDenganAI(teksHasil, dataSarana);
        if (hud) hud.style.display = 'none';

        if (dataEkstrak.idSarana) {
          const idx = dataSarana.findIndex(s => s.id === dataEkstrak.idSarana);
          if (idx !== -1) {
            indexSaranaTerpilih = idx;
            document.getElementById('nama-sarana-modal').textContent = dataSarana[idx].lokasi;
            document.getElementById('modalTanggal').value = new Date().toISOString().split('T')[0];
            document.getElementById('modalKwh').value = dataEkstrak.kwh || '';
            document.getElementById('modal-update').style.display = 'flex';
          }
        } else {
          alert("AI Jarvis: " + (dataEkstrak.error || "Lokasi tidak cocok.") + "\nTerdengar: " + teksHasil);
        }
      }
    } catch (err) {
      alert("Mic: " + err.message);
      fabVoice.classList.remove('recording');
      fabVoice.textContent = '🎙️';
      const hud = document.getElementById('hud-voice');
      if (hud) hud.style.display = 'none';
    }
  };
}

// 13. JALANKAN APLIKASI
sesuaikanTampilanAkses();
muatDataUtama();
