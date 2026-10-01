// js/app.js - Mesin Utama Stabil & Pulih Sempurna PT DEVIS JAYA
import { analisaDayaDanEstimasi } from './plugins/power-engine.js';
import { filterSarana } from './filter.js';
import { getStatusBBM, catatIsiBbm, dapatkanMisiHariIni } from './mission.js';
import { ambilDataDariServer, kirimDataKeServer } from './cloud-sync.js';
import { inisialisasiPeta, perbaruiPinPeta, perbaikiUkuranPeta } from './map.js';
import { bukaModalAnggaran } from './plugins/budget-calculator.js';
import { generatePDFLaporan } from './pdf-report.js';
import { rekamSnapshotWaktu, ambilDaftarSnapshot, unduhCadanganJson, kirimCadanganWhatsApp } from './vault.js';

const hitungPrediksiHabis = analisaDayaDanEstimasi;

let isPetugas = localStorage.getItem('devis_petugas_auth') === 'granted';
let dataSarana = [];
let statusFilterAktif = 'semua';
let indexSaranaTerpilih = null;

// DOM
const containerDaftar = document.getElementById('daftar-sarana');
const inputCari = document.getElementById('input-cari');
const filterTipe = document.getElementById('filter-tipe');
const filterLampu = document.getElementById('filter-lampu');
const formSarana = document.getElementById('form-sarana');
const elTotal = document.getElementById('stat-total');
const elIsi = document.getElementById('stat-isi');

// 1. CUACA MANDIRI TERPISAH (BMKG BENGKULU)
async function muatCuacaMandiri() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-3.8004&longitude=102.2599&current_weather=true");
    const d = await res.json();
    const kode = d.current_weather.weathercode;
    const desc = kode >= 60 ? "Hujan ⛈️" : kode >= 1 ? "Berawan ⛅" : "Cerah ☀️";
    const pill = document.getElementById('pill-cuaca-bengkulu');
    if (pill) pill.textContent = `${desc} ${d.current_weather.temperature}°C`;
  } catch (e) {
    const pill = document.getElementById('pill-cuaca-bengkulu');
    if (pill) pill.textContent = "⛅ Bengkulu 27°C";
  }
}

// 2. PENARIKAN DATA 19 SARANA
async function muatDataUtama() {
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

  try {
    const dariServer = await ambilDataDariServer();
    if (dariServer && Array.isArray(dariServer) && dariServer.length > 0) {
      dataSarana = dariServer;
      localStorage.setItem('sarana-kerja-v3', JSON.stringify(dataSarana));
      rekamSnapshotWaktu(dataSarana);
      renderData();
    }
  } catch (err) {}
}

// 3. AKSES TAMU VS PETUGAS
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

// 4. RENDER KARTU SARANA FORMAT ASLI (2 KOLOM SISA + DROPDOWN RIWAYAT)
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

    const historiUrut = [...(item.riwayatToken || [])].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    const ter = historiUrut[0] || { kwh: '-', tanggal: '-' };
    const seb = historiUrut[1] || { kwh: '-', tanggal: '-' };

    // Dropdown Riwayat
    const listRiwayatHtml = historiUrut.map(h => `
      <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dashed rgba(255,255,255,0.06); font-size:0.7rem; color:#94a3b8;">
        <span>${h.tanggal}</span>
        <strong style="color:#cbd5e1;">${Number(h.kwh).toLocaleString('id-ID')} kWh</strong>
      </div>
    `).join('');

    let footerPetugas = '';
    if (isPetugas) {
      footerPetugas = `
        <div class="kartu-footer" style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn-catat-kartu" data-index="${originalIndex}" style="flex:2; background:#2563eb; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:700; cursor:pointer;">+ Catat Token</button>
          <button type="button" class="btn-edit-kartu" data-index="${originalIndex}" style="flex:1; background:#334155; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer;">Edit</button>
          <button type="button" class="btn-hapus-kartu" data-index="${originalIndex}" style="flex:1; background:#ef4444; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer;">Hapus</button>
        </div>
      `;
    }

    kartu.innerHTML = `
      <div class="kartu-header">
        <div>
          <span style="font-size:0.75rem; color:#94a3b8; font-weight:800;">${item.tipe} • ${item.jenisLampu} (${item.jumlahLampu || 0} TITIK)</span>
          <h3 class="lokasi-sarana" style="margin:2px 0; color:#fff;">${item.lokasi}</h3>
          ${item.koordinat && item.koordinat.lat ? `<div style="font-size:0.7rem; color:#60a5fa;">📍 Koordinat GPS Terdaftar</div>` : ''}
        </div>
        <span class="tag-status ${info.status}">${info.status.toUpperCase()}</span>
      </div>

      <div class="kartu-body">
        <!-- GRID DUA KOLOM ASLI -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; margin-bottom:8px;">
          <div>
            <div style="font-size:0.68rem; color:#94a3b8;">Sisa Terakhir:</div>
            <strong style="color:#fff; font-size:0.9rem;">${typeof ter.kwh === 'number' ? ter.kwh.toLocaleString('id-ID') : ter.kwh} kWh</strong>
            <div style="font-size:0.65rem; color:#64748b;">${ter.tanggal}</div>
          </div>
          <div>
            <div style="font-size:0.68rem; color:#94a3b8;">Sisa Sebelumnya:</div>
            <strong style="color:#fff; font-size:0.9rem;">${typeof seb.kwh === 'number' ? seb.kwh.toLocaleString('id-ID') : seb.kwh} kWh</strong>
            <div style="font-size:0.65rem; color:#64748b;">${seb.tanggal}</div>
          </div>
        </div>

        <!-- COLLAPSIBLE DROPDOWN RIWAYAT -->
        <details style="margin-bottom:8px; font-size:0.72rem; color:#93c5fd;">
          <summary style="cursor:pointer; font-weight:700;">▶ Riwayat Pencatatan (${historiUrut.length} Catatan)</summary>
          <div style="margin-top:6px; padding:6px; background:rgba(0,0,0,0.25); border-radius:6px;">
            ${listRiwayatHtml}
          </div>
        </details>

        <div class="grid-ringkasan" style="font-size:0.75rem;">
          <div>Laju: <strong>${info.rataPerHari} kWh/hr</strong> (Beban: ±${info.wattTerdeteksi || 0} Watt)</div>
          <div class="sorot-hari" style="margin-top:3px;">
            Estimasi: <strong>± ${info.estimasiHari} Hari Lagi (${info.tanggalHabis})</strong>
          </div>
        </div>

        ${item.koordinat && item.koordinat.lat ? `
          <a href="https://www.google.com/maps/dir/?api=1&destination=${item.koordinat.lat},${item.koordinat.lng}" target="_blank" class="btn-rute-maps" style="display:block; text-align:center; background:#065f46; color:#34d399; text-decoration:none; padding:8px; border-radius:6px; font-size:0.75rem; font-weight:700; margin-top:8px;">
            Navigasi Google Maps ➔
          </a>
        ` : ''}
      </div>

      ${footerPetugas}
    `;

    containerDaftar.appendChild(kartu);
  });

  // Listener Tombol Kartu
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
      if (confirm(`Hapus sarana "${dataSarana[idx].lokasi}"?`)) {
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
  rekamSnapshotWaktu(dataSarana);
}

// 5. EVENT FORM UPDATE TOKEN
document.getElementById('form-update').onsubmit = (e) => {
  e.preventDefault();
  if (indexSaranaTerpilih === null) return;
  const tgl = document.getElementById('modalTanggal').value;
  const kwh = Number(document.getElementById('modalKwh').value);
  dataSarana[indexSaranaTerpilih].riwayatToken.push({ tanggal: tgl, kwh });
  simpanKeStorage();
  document.getElementById('modal-update').style.display = 'none';
  renderData();
};
document.getElementById('btn-tutup-modal').onclick = () => { document.getElementById('modal-update').style.display = 'none'; };

// 6. EVENT FORM EDIT
document.getElementById('form-edit').onsubmit = (e) => {
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
document.getElementById('btn-tutup-edit').onclick = () => { document.getElementById('modal-edit').style.display = 'none'; };

// 7. EVENT TOOLBAR
document.getElementById('btn-tool-anggaran').onclick = () => {
  bukaModalAnggaran(dataSarana, hitungPrediksiHabis);
};
document.getElementById('btn-tutup-anggaran').onclick = () => { document.getElementById('modal-anggaran').style.display = 'none'; };
document.getElementById('btn-tutup-anggaran-x').onclick = () => { document.getElementById('modal-anggaran').style.display = 'none'; };

document.getElementById('btn-tool-pdf').onclick = () => {
  generatePDFLaporan(dataSarana, hitungPrediksiHabis);
};

document.getElementById('btn-tool-rute').onclick = async () => {
  try {
    const { bukaModalOptimasiBBM } = await import('./plugins/fuel-optimizer.js');
    bukaModalOptimasiBBM(dataSarana, { lat: -3.8000, lng: 102.2650 }, hitungPrediksiHabis);
  } catch (e) { alert("Rute: " + e.message); }
};

document.getElementById('btn-tool-jarvis-brief').onclick = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const infoBbm = getStatusBBM();
    const teks = isPetugas 
      ? `Halo Aditiya, patroli siap. 19 sarana terpantau. Saldo BBM tersisa Rp ${infoBbm.sisa.toLocaleString('id-ID')}. Periksa jadwal misi hari ini.`
      : `Selamat datang di Radar Digital PT Devis Jaya. Ini adalah sistem pemantauan sarana reklame Kota Bengkulu. Anda berada pada mode tamu.`;
    const ut = new SpeechSynthesisUtterance(teks);
    ut.lang = 'id-ID';
    window.speechSynthesis.speak(ut);
  }
};

// 8. BRANKAS DATA & MESIN WAKTU EVENT
const modalVault = document.getElementById('modal-vault');
document.getElementById('btn-buka-vault').onclick = () => {
  modalVault.style.display = 'flex';
  const kontainer = document.getElementById('kontainer-snapshot');
  const sn = ambilDaftarSnapshot();
  if (sn.length === 0) {
    kontainer.innerHTML = `<span style="color:#64748b; font-size:0.72rem;">Belum ada snapshot waktu.</span>`;
  } else {
    kontainer.innerHTML = sn.map((item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px; margin-bottom:6px;">
        <div>
          <strong style="color:#fff; font-size:0.75rem;">${item.waktu}</strong>
          <div style="font-size:0.65rem; color:#94a3b8;">${item.total} Titik Sarana</div>
        </div>
        <button type="button" class="btn-pulihkan-sn" data-idx="${idx}" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.68rem; cursor:pointer;">
          Pulihkan
        </button>
      </div>
    `).join('');

    kontainer.querySelectorAll('.btn-pulihkan-sn').forEach(b => {
      b.onclick = () => {
        const terpilih = sn[Number(b.dataset.idx)];
        if (confirm(`Kembalikan data ke snapshot: ${terpilih.waktu}?`)) {
          dataSarana = terpilih.data;
          simpanKeStorage();
          renderData();
          modalVault.style.display = 'none';
          alert("Data berhasil dipulihkan!");
        }
      };
    });
  }
};
document.getElementById('btn-tutup-vault').onclick = () => { modalVault.style.display = 'none'; };
document.getElementById('btn-vault-unduh').onclick = () => unduhCadanganJson(dataSarana);
document.getElementById('btn-vault-wa').onclick = () => kirimCadanganWhatsApp(dataSarana);
document.getElementById('btn-vault-pulihkan-file').onclick = () => document.getElementById('input-file-restore').click();
document.getElementById('input-file-restore').onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (Array.isArray(data) && data.length > 0) {
        dataSarana = data;
        simpanKeStorage();
        renderData();
        modalVault.style.display = 'none';
        alert("Data berhasil dipulihkan dari file JSON!");
      }
    } catch (err) { alert("File JSON tidak valid."); }
  };
  reader.readAsText(f);
};

// 9. EVENT PIN PETUGAS
const modalAuth = document.getElementById('modal-auth');
document.getElementById('btn-toggle-auth').onclick = () => {
  if (isPetugas) {
    if (confirm("Beralih ke Mode Tamu?")) {
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
    alert("PIN Salah!");
  }
};

// 10. FILTER PENCARIAN
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

// 11. NAVIGASI TAB BAWAH
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

// 12. RENDER MISI & BBM
function renderMisiDanBBM() {
  const containerMisi = document.getElementById('container-list-misi');
  const misi = dapatkanMisiHariIni();
  if (containerMisi) {
    containerMisi.innerHTML = misi.map(m => `
      <div style="background:rgba(15,23,42,0.7); padding:10px 12px; border-radius:8px; border-left:4px solid #ef4444; margin-bottom:8px;">
        <span style="font-size:0.68rem; color:#ef4444; font-weight:800; text-transform:uppercase;">${m.kategori}</span>
        <h4 style="color:#fff; font-size:0.88rem; margin:2px 0;">${m.judul}</h4>
        <p style="font-size:0.72rem; color:#cbd5e1; margin:0; line-height:1.4; white-space:pre-line;">${m.detail}</p>
        <div style="margin-top:6px; font-size:0.68rem; color:#38bdf8;">🎯 Target: ${m.target}</div>
      </div>
    `).join('');
  }

  const bbm = getStatusBBM();
  document.getElementById('bbm-sisa-rp').textContent = `Rp ${bbm.sisa.toLocaleString('id-ID')}`;
  document.getElementById('bbm-terpakai-rp').textContent = `Rp ${bbm.terpakai.toLocaleString('id-ID')}`;
  const pct = Math.max(0, Math.min(100, (bbm.sisa / bbm.plafon) * 100));
  document.getElementById('bbm-progress-fill').style.width = `${pct}%`;

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
document.getElementById('form-catat-bbm').onsubmit = (e) => {
  e.preventDefault();
  const val = Number(document.getElementById('input-nominal-bbm').value);
  if (val > 0) {
    catatIsiBbm(val);
    document.getElementById('input-nominal-bbm').value = '';
    renderMisiDanBBM();
  }
};

// JALANKAN AWAL
sesuaikanTampilanAkses();
muatDataUtama();
muatCuacaMandiri();
