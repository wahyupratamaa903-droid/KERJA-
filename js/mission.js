// MODUL MANDIRI 2: MANAJEMEN MISI LAPANGAN (OTOMATIS + KUSTOM FLEKSIBEL) & RIWAYAT BBM

export function ambilMisiKustom() {
  return JSON.parse(localStorage.getItem('devis_custom_missions_v1') || '[]');
}

export function simpanMisiKustom(daftar) {
  localStorage.setItem('devis_custom_missions_v1', JSON.stringify(daftar));
}

export function tambahMisiKustomBaru(misiObj) {
  const daftar = ambilMisiKustom();
  daftar.unshift({
    id: 'misi_' + Date.now(),
    kategori: misiObj.kategori || 'Misi Tambahan',
    judul: misiObj.judul,
    detail: misiObj.detail || '',
    target: misiObj.target || 'Lapangan',
    jadwalTipe: misiObj.jadwalTipe || 'harian', // 'sekali', 'harian', 'mingguan', 'bulanan'
    jadwalNilai: misiObj.jadwalNilai || '',     // angka hari (0-6) atau tanggal (1-31)
    selesaiHariIni: false,
    tglSelesai: ''
  });
  simpanMisiKustom(daftar);
}

export function hapusMisiKustom(idMisi) {
  const daftar = ambilMisiKustom().filter(m => m.id !== idMisi);
  simpanMisiKustom(daftar);
}

export function toggleSelesaiMisiKustom(idMisi) {
  const hariIniStr = new Date().toISOString().split('T')[0];
  const daftar = ambilMisiKustom().map(m => {
    if (m.id === idMisi) {
      const statusBaru = !(m.tglSelesai === hariIniStr);
      return { ...m, tglSelesai: statusBaru ? hariIniStr : '' };
    }
    return m;
  });
  simpanMisiKustom(daftar);
}

export function dapatkanMisiHariIni() {
  const now = new Date();
  const hari = now.getDay(); // 0: Mgg, 1: Sen, ..., 6: Sab
  const tgl = now.getDate();
  const hariIniStr = now.toISOString().split('T')[0];
  const daftarMisi = [];

  // A. MASUKKAN MISI KUSTOM YANG COCOK DENGAN JADWAL HARI INI
  const kustom = ambilMisiKustom();
  kustom.forEach(m => {
    let tampil = false;
    if (m.jadwalTipe === 'sekali' || m.jadwalTipe === 'harian') tampil = true;
    else if (m.jadwalTipe === 'mingguan' && Number(m.jadwalNilai) === hari) tampil = true;
    else if (m.jadwalTipe === 'bulanan') {
      const angkaTgl = String(m.jadwalNilai).split(',').map(x => Number(x.trim()));
      if (angkaTgl.includes(tgl)) tampil = true;
    }

    if (tampil) {
      const sudahSelesai = (m.tglSelesai === hariIniStr);
      daftarMisi.push({
        id: m.id,
        isCustom: true,
        sudahSelesai,
        kategori: `${m.kategori} ${sudahSelesai ? '✅ (SELESAI)' : ''}`,
        judul: m.judul,
        detail: m.detail,
        target: m.target,
        urgent: !sudahSelesai
      });
    }
  });

  // B. JADWAL INTI TETAP PT DEVIS JAYA
  if (tgl >= 1 && tgl <= 2) {
    daftarMisi.push({
      kategori: 'Dokumentasi Awal Bulan',
      judul: 'Foto Seluruh Sarana (Berlampu & Non-Lampu)',
      detail: 'Ambil dokumentasi seluruh sarana untuk laporan bulanan ke atasan via Album WA.',
      target: 'Seluruh Titik Reklame Bengkulu',
      urgent: true
    });
  }

  const isRentangHms = (tgl >= 1 && tgl <= 4) || (tgl >= 10 && tgl <= 14) || (tgl >= 20 && tgl <= 24);
  if (isRentangHms) {
    daftarMisi.push({
      kategori: `Patroli HMS (Tgl ${tgl})`,
      judul: 'Foto HMS Siang & Malam (4 Lokasi)',
      detail: 'Wajib 2 versi foto (Kamera Timestamp & Kamera Biasa) Siang & Malam di 4 titik:\n1. Jl. Adam Malik\n2. Simpang Skip\n3. Rawa Makmur\n4. Simpang Brimob',
      target: 'Adam Malik, Skip, Rawa Makmur, Brimob',
      urgent: true
    });
  }

  if (hari === 1) {
    daftarMisi.push({
      kategori: 'Rutin Mingguan (Senin)',
      judul: 'Foto BYD Siang & Malam',
      detail: 'Wajib ambil 2 versi dokumentasi: Kamera Timestamp & Kamera Biasa (Siang & Malam).',
      target: 'Sarana Billboard BYD',
      urgent: true
    });
  }

  if (hari === 3) {
    daftarMisi.push({
      kategori: 'Pelaporan Mingguan (Rabu)',
      judul: 'Setor Foto Kegiatan & KM Motor',
      detail: 'Kirim rekap dokumentasi pekerjaan dari Kamis minggu lalu s/d Rabu ini ke kantor cabang.',
      target: 'Kantor Cabang',
      urgent: true
    });
  }

  if (daftarMisi.length === 0) {
    daftarMisi.push({
      kategori: 'Patroli Reguler',
      judul: 'Monitoring Kelistrikan & KWH Tiang',
      detail: 'Pengecekan rutin sisa token listrik tiang reklame dan kondisi visual tiang di lapangan.',
      target: 'Sarana Prioritas Lapangan',
      urgent: false
    });
  }

  return daftarMisi;
}

// Pasang UI Pembuat Misi Kustom secara otomatis di dalam Tab Misi
export function pasangPanelMisiKustom(fnRenderUlang) {
  const containerMisi = document.getElementById('container-list-misi');
  if (!containerMisi) return;

  let panelBox = document.getElementById('box-kontrol-misi-kustom');
  if (!panelBox) {
    panelBox = document.createElement('div');
    panelBox.id = 'box-kontrol-misi-kustom';
    panelBox.style.marginBottom = '12px';
    containerMisi.parentNode.insertBefore(panelBox, containerMisi);
  }

  panelBox.innerHTML = `
    <button type="button" id="btn-buka-form-misi" style="width:100%; background:linear-gradient(90deg,#2563eb,#1d4ed8); color:#fff; border:none; padding:9px; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer; margin-bottom:8px;">
      ➕ Tambah Misi / Jadwal Patroli Sendiri
    </button>
    <form id="form-tambah-misi-kustom" style="display:none; background:rgba(15,23,42,0.9); border:1px solid rgba(59,130,246,0.4); padding:12px; border-radius:8px; margin-bottom:10px;">
      <h4 style="color:#fff; font-size:0.85rem; margin:0 0 8px 0;">📝 Buat Misi Kerja Baru</h4>
      <div style="margin-bottom:8px;">
        <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:3px;">Kategori / Jenis Tugas</label>
        <input type="text" id="misi-kustom-kategori" placeholder="Contoh: Perbaikan Lampu / Pasang Banner / Patroli" required style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:3px;">Judul Misi</label>
        <input type="text" id="misi-kustom-judul" placeholder="Contoh: Cek Kontaktor & Timer Simpang Skip" required style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:3px;">Rincian / Catatan Kerja</label>
        <textarea id="misi-kustom-detail" rows="2" placeholder="Contoh: Foto 2 versi siang malam & cek kabel..." style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem;"></textarea>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <div>
          <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:3px;">Target Lokasi</label>
          <input type="text" id="misi-kustom-target" placeholder="Contoh: Jl. S. Parman" style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem;">
        </div>
        <div>
          <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:3px;">Jadwal Berulang</label>
          <select id="misi-kustom-tipe" style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem;">
            <option value="sekali">Hari Ini / Sekali Saja</option>
            <option value="harian">Setiap Hari</option>
            <option value="mingguan">Mingguan (Pilih Hari)</option>
            <option value="bulanan">Tanggal Tertentu</option>
          </select>
        </div>
      </div>
      <div id="box-nilai-jadwal" style="display:none; margin-bottom:8px;">
        <label id="lbl-nilai-jadwal" style="font-size:0.7rem; color:#38bdf8; display:block; margin-bottom:3px;">Masukkan Nilai Jadwal</label>
        <input type="text" id="misi-kustom-nilai" placeholder="Contoh: 1 (Senin) atau tanggal 5,15,25" style="width:100%; padding:7px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #38bdf8; font-size:0.78rem;">
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" id="btn-batal-misi" style="flex:1; padding:8px; border-radius:6px; background:#334155; color:#fff; border:none; font-size:0.75rem; cursor:pointer;">Batal</button>
        <button type="submit" style="flex:2; padding:8px; border-radius:6px; background:#10b981; color:#fff; border:none; font-size:0.75rem; font-weight:700; cursor:pointer;">Simpan Misi</button>
      </div>
    </form>
  `;

  const btnBuka = panelBox.querySelector('#btn-buka-form-misi');
  const formMisi = panelBox.querySelector('#form-tambah-misi-kustom');
  const selTipe = panelBox.querySelector('#misi-kustom-tipe');
  const boxNilai = panelBox.querySelector('#box-nilai-jadwal');
  const lblNilai = panelBox.querySelector('#lbl-nilai-jadwal');

  btnBuka.onclick = () => {
    formMisi.style.display = formMisi.style.display === 'none' ? 'block' : 'none';
  };
  panelBox.querySelector('#btn-batal-misi').onclick = () => { formMisi.style.display = 'none'; };

  selTipe.onchange = () => {
    if (selTipe.value === 'mingguan') {
      boxNilai.style.display = 'block';
      lblNilai.textContent = 'Ketik Angka Hari (1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 0=Minggu):';
    } else if (selTipe.value === 'bulanan') {
      boxNilai.style.display = 'block';
      lblNilai.textContent = 'Ketik Tanggal Setiap Bulan (pisahkan koma, misal: 1,10,20):';
    } else {
      boxNilai.style.display = 'none';
    }
  };

  formMisi.onsubmit = (e) => {
    e.preventDefault();
    tambahMisiKustomBaru({
      kategori: document.getElementById('misi-kustom-kategori').value,
      judul: document.getElementById('misi-kustom-judul').value,
      detail: document.getElementById('misi-kustom-detail').value,
      target: document.getElementById('misi-kustom-target').value,
      jadwalTipe: selTipe.value,
      jadwalNilai: document.getElementById('misi-kustom-nilai').value
    });
    formMisi.reset();
    formMisi.style.display = 'none';
    if (fnRenderUlang) fnRenderUlang();
  };
}

export function getStatusBBM() {
  const PLAFON = 50000;
  const sekarang = new Date();
  const hariIni = sekarang.getDay();
  const hariKeKamis = (hariIni >= 4) ? (hariIni - 4) : (hariIni + 3);
  const tglKamis = new Date(sekarang);
  tglKamis.setDate(sekarang.getDate() - hariKeKamis);
  const tglRabu = new Date(tglKamis);
  tglRabu.setDate(tglKamis.getDate() + 6);

  const rentangPeriode = `${tglKamis.getDate()} ${tglKamis.toLocaleString('id-ID', {month:'short'})} s/d ${tglRabu.getDate()} ${tglRabu.toLocaleString('id-ID', {month:'short'})}`;
  const kunciPeriode = `BBM_${tglKamis.getFullYear()}_${tglKamis.getMonth()}_${tglKamis.getDate()}`;

  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  const terpakai = historiSemua
    .filter(x => x.periode === kunciPeriode)
    .reduce((sum, item) => sum + Number(item.nominal), 0);

  return {
    plafon: PLAFON,
    terpakai,
    sisa: Math.max(0, PLAFON - terpakai),
    rentangPeriode,
    kunciPeriode,
    riwayat: historiSemua
  };
}

export function catatIsiBbm(nominal) {
  const status = getStatusBBM();
  const historiSemua = JSON.parse(localStorage.getItem('devis_bbm_history_all') || '[]');
  const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

  historiSemua.unshift({
    id: Date.now(),
    tanggal: tgl,
    nominal: Number(nominal),
    periode: status.kunciPeriode
  });

  localStorage.setItem('devis_bbm_history_all', JSON.stringify(historiSemua));
}
