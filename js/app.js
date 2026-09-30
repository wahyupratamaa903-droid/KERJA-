import { hitungPrediksiHabis } from './token-calc.js';
import { filterSarana } from './filter.js';
import { getStatusBBM, catatIsiBbm } from './mission.js';
import { buatAnalisisAnggaranAI } from './plugins/ai-advisor.js';
import { mulaiRekamSuara, hentikanDanProsesSuara, ekstrakDataTokenDenganAI, bacakanMorningBrief } from './plugins/devis-jarvis.js';

let isPetugas = localStorage.getItem('devis_petugas_auth') === 'granted';
let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja-v3') || '[]');

const containerDaftar = document.getElementById('daftar-sarana');
const inputCari = document.getElementById('input-cari');
const filterTipe = document.getElementById('filter-tipe');
const filterLampu = document.getElementById('filter-lampu');
let statusFilterAktif = 'semua';

function sesuaikanTampilanAkses() {
  const tabMisi = document.getElementById('nav-tab-misi');
  const fabVoice = document.getElementById('fab-voice-cmd');
  const boxVault = document.getElementById('btn-buka-vault');
  const boxBbm = document.getElementById('box-aksi-bbm');
  
  if (isPetugas) {
    document.getElementById('btn-toggle-auth').textContent = "👑 Petugas";
    if(tabMisi) tabMisi.style.display = "flex";
    if(fabVoice) fabVoice.style.display = "flex";
    if(boxVault) boxVault.style.display = "block";
    if(boxBbm) boxBbm.style.display = "block";
  } else {
    document.getElementById('btn-toggle-auth').textContent = "🔐 Tamu";
    if(tabMisi) tabMisi.style.display = "none";
    if(fabVoice) fabVoice.style.display = "none";
    if(boxVault) boxVault.style.display = "none";
    if(boxBbm) boxBbm.style.display = "none";
  }
}

function renderData() {
  containerDaftar.innerHTML = '';
  let totalKritis = 0;
  dataSarana.forEach(s => {
    if (hitungPrediksiHabis(s.riwayatToken, s.jumlahLampu, s.jenisLampu).status === 'kritis') totalKritis++;
  });
  
  document.getElementById('stat-total').textContent = dataSarana.length;
  document.getElementById('stat-isi').textContent = totalKritis;

  const tersaring = filterSarana(dataSarana, inputCari.value, statusFilterAktif, hitungPrediksiHabis, filterTipe.value, filterLampu.value);
  
  tersaring.forEach((item) => {
    const info = hitungPrediksiHabis(item.riwayatToken, item.jumlahLampu, item.jenisLampu);
    const kartu = document.createElement('article');
    kartu.className = `kartu-sarana status-${info.status}`;
    
    kartu.innerHTML = `
      <div class="kartu-header">
        <div><span style="font-size:0.75rem; color:#94a3b8;">${item.tipe} • ${item.jenisLampu}</span><h3 style="margin:2px 0;">${item.lokasi}</h3></div>
        <span class="tag-status ${info.status}">${info.status.toUpperCase()}</span>
      </div>
      <div class="kartu-body">
        <div class="grid-ringkasan">
          <div>Laju: <strong>${info.rataPerHari} kWh/hr</strong> (Beban: ±${info.wattTerdeteksi} W)</div>
          <div style="font-size:0.75rem;">Sisa: <strong>${item.riwayatToken[item.riwayatToken.length-1].kwh} kWh</strong></div>
          <div class="sorot-hari">Estimasi: <strong>± ${info.estimasiHari} Hari (${info.tanggalHabis})</strong></div>
        </div>
      </div>
    `;
    containerDaftar.appendChild(kartu);
  });
}

// Event Tamu vs Petugas
document.getElementById('btn-tool-jarvis-brief').addEventListener('click', () => {
  if (isPetugas) {
    bacakanMorningBrief(dataSarana, getStatusBBM(), hitungPrediksiHabis);
  } else {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance("Selamat datang di Radar Digital PT Devis Jaya. Ini adalah sistem kecerdasan buatan untuk memonitor kelistrikan. Anda berada dalam mode tamu.");
      ut.lang = 'id-ID'; window.speechSynthesis.speak(ut);
    }
  }
});

// Event Anggaran AI
document.getElementById('btn-tool-anggaran').addEventListener('click', () => {
  document.getElementById('modal-anggaran').style.display = 'flex';
  buatAnalisisAnggaranAI(dataSarana, hitungPrediksiHabis).then(html => {
    document.getElementById('konten-rincian-anggaran').innerHTML = html;
  });
});
document.getElementById('btn-tutup-anggaran').onclick = () => document.getElementById('modal-anggaran').style.display = 'none';

inputCari.addEventListener('input', renderData);
filterTipe.addEventListener('change', renderData);
filterLampu.addEventListener('change', renderData);

// Navigasi Bawah
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

sesuaikanTampilanAkses();
renderData();
