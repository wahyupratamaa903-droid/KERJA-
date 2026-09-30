// js/app.js - Otak Operasional Terintegrasi Penuh
import { analisaDayaDanEstimasi } from './plugins/power-engine.js';
import { dapatkanKoordinatGPS } from './gps.js';
import { filterSarana } from './filter.js';
import { inisialisasiPeta, perbaruiPinPeta, perbaikiUkuranPeta } from './map.js';
import { dapatkanMisiHariIni, getStatusBBM, catatIsiBbm } from './mission.js';
import { kirimDataKeServer, ambilDataDariServer } from './cloud-sync.js';
import { rekamSnapshotWaktu, ambilDaftarSnapshot, jalankanBackupGitHub } from './vault.js';
import { bukaModalOptimasiBBM } from './plugins/fuel-optimizer.js';
import { buatAnalisisAnggaranAI } from './plugins/ai-advisor.js';
import { generatePDFLaporan } from './pdf-report.js';
import { eksporRekapWhatsApp } from './export-wa.js';
import { prosesOcrMeteran } from './ocr.js';
import { mulaiRekamSuara, hentikanDanProsesSuara, ekstrakDataTokenDenganAI, bacakanMorningBrief, bacakanBriefTamu } from './plugins/devis-jarvis.js';

const hitungPrediksiHabis = analisaDayaDanEstimasi;

let isPetugas = localStorage.getItem('devis_petugas_auth') === 'granted';
let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');
let statusFilterAktif = 'semua';
let indexSaranaTerpilih = null;

// ELEMEN DOM
const containerDaftar = document.getElementById('daftar-sarana');
const inputCari = document.getElementById('input-cari');
const filterTipe = document.getElementById('filter-tipe');
const filterLampu = document.getElementById('filter-lampu');
const formSarana = document.getElementById('form-sarana');

// 1. KONTROL MODE TAMU VS PETUGAS
function sesuaikanTampilanAkses() {
  const tabMisi = document.getElementById('nav-tab-misi');
  const fabVoice = document.getElementById('fab-voice-cmd');
  const btnVault = document.getElementById('btn-buka-vault');
  const boxBbm = document.getElementById('box-aksi-bbm');
  const btnAuth = document.getElementById('btn-toggle-auth');

  if (isPetugas) {
    btnAuth.textContent = "👑 Petugas";
    btnAuth.className = "btn-header-action auth active";
    formSarana.style.display = "block";
    if (tabMisi) tabMisi.style.display = "flex";
    if (fabVoice) fabVoice.style.display = "flex";
    if (btnVault) btnVault.style.display = "block";
    if (boxBbm) boxBbm.style.display = "block";
  } else {
    btnAuth.textContent = "🔐 Tamu";
    btnAuth.className = "btn-header-action auth";
    formSarana.style.display = "none";
    if (tabMisi) tabMisi.style.display = "none";
    if (fabVoice) fabVoice.style.display = "none";
    if (btnVault) btnVault.style.display = "none";
    if (boxBbm) boxBbm.style.display = "none";
  }
}

// 2. RENDER DAFTAR KARTU SARANA DENGAN SEMUA EVENT
function renderData() {
  containerDaftar.innerHTML = '';
  
  let totalKritis = 0;
  dataSarana.forEach(s => {
    const info = hitungPrediksiHabis(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    if (info.status === 'kritis' || info.status === 'waspada') totalKritis++;
  });

  document.getElementById('stat-total').textContent = dataSarana.length;
  document.getElementById('stat-isi').textContent = totalKritis;

  const dataTersaring = filterSarana(dataSarana, inputCari.value, statusFilterAktif, hitungPrediksiHabis, filterTipe.value, filterLampu.value);

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

  // Sambungkan Event Listener Tombol Kartu
  containerDaftar.querySelectorAll('.btn-catat-kartu').forEach(btn => {
    btn.onclick = () => {
      indexSaranaTerpilih = Number(btn.dataset.index);
      const s = dataSarana[indexSaranaTerpilih];
      const terakhir = s.riwayatToken[s.riwayatToken.length - 1];
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
  perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
}

// 3. EVENT MODAL CATAT TOKEN BARU
document.getElementById('form-update').onsubmit = (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;
  const tgl = document.getElementById('modalTanggal').value;
  const kwh = Number(document.getElementById('modalKwh').value);
  
  dataSarana[indexSaranaTerpilih].riwayatToken.push({ tanggal: tgl, kwh: kwh });
  simpanKeStorage();
  document.getElementById('modal-update').style.display = 'none';
  renderData();
};
document.getElementById('btn-tutup-modal').onclick = () => {
  document.getElementById('modal-update').style.display = 'none';
};

// 4. EVENT MODAL EDIT SARANA
document.getElementById('form-edit').onsubmit = (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;
  const item = dataSarana[indexSaranaTerpilih];
  item.lokasi = document.getElementById('edit-lokasi').value;
  item.tipe = document.getElementById('edit-tipe').value;
  item.jenisLampu = document.getElementById('edit-jenisLampu').value;
  item.jumlahLampu = Number(document.getElementById('edit-jumlahLampu').value);

  const koordinatStr = document.getElementById('edit-koordinat').value;
  if (koordinatStr.includes(',')) {
    const [lat, lng] = koordinatStr.split(',').map(n => parseFloat(n.trim()));
    if (!isNaN(lat) && !isNaN(lng)) item.koordinat = { lat, lng };
  }

  simpanKeStorage();
  document.getElementById('modal-edit').style.display = 'none';
  renderData();
};
document.getElementById('btn-tutup-edit').onclick = () => {
  document.getElementById('modal-edit').style.display = 'none';
};

// 5. EVENT FORM SARANA BARU
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
  if (kStr.includes(',')) {
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

// 6. EVENT TOOLBAR
document.getElementById('btn-tool-rute').onclick = async () => {
  let pos = { lat: -3.8000, lng: 102.2650 };
  try { pos = await dapatkanKoordinatGPS(); } catch (e) {}
  bukaModalOptimasiBBM(dataSarana, pos, hitungPrediksiHabis);
};

document.getElementById('btn-tool-anggaran').onclick = () => {
  document.getElementById('modal-anggaran').style.display = 'flex';
  document.getElementById('konten-rincian-anggaran').innerHTML = `<div style="text-align:center; padding:20px; color:#60a5fa;">⏳ Menganalisis kondisi cuaca & kebutuhan dana...</div>`;
  buatAnalisisAnggaranAI(dataSarana, hitungPrediksiHabis).then(html => {
    document.getElementById('konten-rincian-anggaran').innerHTML = html;
  });
};
document.getElementById('btn-tutup-anggaran').onclick = () => {
  document.getElementById('modal-anggaran').style.display = 'none';
};

document.getElementById('btn-tool-pdf').onclick = () => {
  generatePDFLaporan(dataSarana, hitungPrediksiHabis);
};

document.getElementById('btn-ekspor-wa').onclick = () => {
  eksporRekapWhatsApp(dataSarana, hitungPrediksiHabis);
};

document.getElementById('btn-tool-jarvis-brief').onclick = () => {
  if (isPetugas) bacakanMorningBrief(dataSarana, getStatusBBM(), hitungPrediksiHabis);
  else bacakanBriefTamu();
};

// 7. EVENT FILTER
inputCari.oninput = renderData;
filterTipe.onchange = renderData;
filterLampu.onchange = renderData;
document.querySelectorAll('.tab-filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    statusFilterAktif = btn.dataset.filter;
    renderData();
  };
});

// 8. EVENT AUTENTIKASI PIN
const modalAuth = document.getElementById('modal-auth');
document.getElementById('btn-toggle-auth').onclick = () => {
  if (isPetugas) {
    if (confirm("Keluar dari Mode Petugas dan beralih ke Mode Tamu?")) {
      isPetugas = false;
      localStorage.removeItem('devis_petugas_auth');
      sesuaikanTampilanAkses();
      renderData();
    }
  } else {
    modalAuth.style.display = 'flex';
  }
};
document.getElementById('btn-tutup-auth').onclick = () => { modalAuth.style.display = 'none'; };
document.getElementById('form-auth-pin').onsubmit = (e) => {
  e.preventDefault();
  const pin = document.getElementById('input-pin-petugas').value;
  if (pin === '1234' || pin === '903' || pin === '2026') {
    isPetugas = true;
    localStorage.setItem('devis_petugas_auth', 'granted');
    modalAuth.style.display = 'none';
    sesuaikanTampilanAkses();
    renderData();
    alert("Selamat datang, Petugas PT DEVIS JAYA!");
  } else {
    alert("PIN Petugas Salah!");
  }
};

// 9. EVENT TAB NAVIGASI BAWAH & INISIALISASI PETA
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    const targetView = document.getElementById(btn.dataset.tab);
    targetView.classList.add('active');

    if (btn.dataset.tab === 'view-peta') {
      inisialisasiPeta();
      perbaikiUkuranPeta();
      perbaruiPinPeta(dataSarana, hitungPrediksiHabis);
    } else if (btn.dataset.tab === 'view-misi') {
      renderMisiDanBBM();
    }
  };
});

// 10. RENDER MISI & BBM
function renderMisiDanBBM() {
  const containerMisi = document.getElementById('container-list-misi');
  const misi = dapatkanMisiHariIni();
  containerMisi.innerHTML = misi.map(m => `
    <div style="background:rgba(15,23,42,0.6); padding:10px; border-radius:8px; border-left:3px solid #ef4444; margin-bottom:8px;">
      <span style="font-size:0.68rem; color:#ef4444; font-weight:700;">${m.kategori}</span>
      <h4 style="color:#fff; font-size:0.85rem; margin:2px 0;">${m.judul}</h4>
      <p style="font-size:0.72rem; color:#94a3b8; margin:0;">${m.detail}</p>
    </div>
  `).join('');

  const bbm = getStatusBBM();
  document.getElementById('bbm-sisa-rp').textContent = `Rp ${bbm.sisa.toLocaleString('id-ID')}`;
  document.getElementById('bbm-terpakai-rp').textContent = `Rp ${bbm.terpakai.toLocaleString('id-ID')}`;
  const pct = Math.max(0, Math.min(100, (bbm.sisa / bbm.plafon) * 100));
  document.getElementById('bbm-progress-fill').style.width = `${pct}%`;

  const listBbm = document.getElementById('list-riwayat-bbm');
  listBbm.innerHTML = bbm.riwayat.map(r => `
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.75rem;">
      <span style="color:#94a3b8;">⛽ ${r.tanggal}</span>
      <strong style="color:#10b981;">Rp ${r.nominal.toLocaleString('id-ID')}</strong>
    </div>
  `).join('');
}

document.querySelectorAll('.btn-preset-bbm').forEach(btn => {
  btn.onclick = () => {
    catatIsiBbm(Number(btn.dataset.nominal));
    renderMisiDanBBM();
  };
});
document.getElementById('form-catat-bbm').onsubmit = (e) => {
  e.preventDefault();
  const val = Number(document.getElementById('input-nominal-bbm').value);
  if (val > 0) {
    catatIsiBbm(val);
    document.getElementById('input-nominal-bbm').value = '';
    renderMisiDanBBM();
  }
};

// 11. GPS & OCR
document.getElementById('btn-ambil-gps').onclick = async () => {
  try {
    const pos = await dapatkanKoordinatGPS();
    document.getElementById('input-koordinat').value = `${pos.lat}, ${pos.lng}`;
  } catch (e) { alert("GPS: " + e.message); }
};

// 12. INISIALISASI SISTEM
sesuaikanTampilanAkses();
renderData();
