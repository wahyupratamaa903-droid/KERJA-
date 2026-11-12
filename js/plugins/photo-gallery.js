// MODUL MANDIRI: GALERI DOKUMENTASI BULANAN & ANTREAN WHATSAPP BERURUTAN OTOMATIS

const DB_NAME = 'DevisPhotoGalleryDB';
const STORE_NAME = 'album_foto_sarana';

// Menyimpan posisi antrean kirim agar tidak pernah mengulang dari nomor 1
let indexAntreanAktif = 0;
let daftarSudahTerkirimSesiIni = new Set();

function bukaDbFoto() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function simpanAlbumKeDb(itemAlbum) {
  const db = await bukaDbFoto();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(itemAlbum);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function ambilSemuaAlbumDariDb() {
  const db = await bukaDbFoto();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function hapusAlbumDariDb(id) {
  const db = await bukaDbFoto();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

function prosesFileKeDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 1280;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) { h = Math.round((h * MAX_W) / w); w = MAX_W; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Menempelkan pita keterangan lokasi di bagian bawah foto khusus saat kirim gabungan massal
function buatFotoDenganLabelLokasi(dataUrl, teksLokasi, nomorUrut) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const tinggiBar = Math.max(42, Math.round(img.height * 0.065));
      ctx.fillStyle = 'rgba(6, 9, 17, 0.82)';
      ctx.fillRect(0, img.height - tinggiBar, img.width, tinggiBar);

      const ukuranFont = Math.max(16, Math.round(tinggiBar * 0.46));
      ctx.font = `bold ${ukuranFont}px sans-serif`;
      ctx.fillStyle = '#38bdf8';
      ctx.textBaseline = 'middle';
      ctx.fillText(`📍 [${nomorUrut}] ${teksLokasi}`, 16, img.height - (tinggiBar / 2));

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

function dataUrlKeFileCepat(dataUrl, namaFile) {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], namaFile, { type: mime });
}

export async function bukaModalGaleriWA(daftarSarana) {
  let modal = document.getElementById('modal-galeri-wa');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-galeri-wa';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const sekarang = new Date();
  const bulanDefault = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}`;

  modal.style.display = 'flex';

  async function renderGaleri(filterBulan, filterKategori, filterStatus) {
    const semuaAlbum = await ambilSemuaAlbumDariDb();
    const albumBulanIni = semuaAlbum.filter(a => a.bulan === filterBulan);

    const daftarStatusSarana = (daftarSarana || []).map(s => {
      const koleksi = albumBulanIni.filter(a => Number(a.idSarana) === Number(s.id));
      const cocokKat = filterKategori === 'SEMUA'
        ? koleksi
        : koleksi.filter(a => a.kategori === filterKategori);
      const totalFoto = cocokKat.reduce((sum, item) => sum + (item.fotoList ? item.fotoList.length : 0), 0);
      return {
        sarana: s,
        koleksi: cocokKat,
        sudahDifoto: totalFoto > 0,
        totalFoto,
        sudahDikirimWA: daftarSudahTerkirimSesiIni.has(Number(s.id))
      };
    });

    const daftarSudahDifoto = daftarStatusSarana.filter(x => x.sudahDifoto);
    const jmlSudah = daftarSudahDifoto.length;
    const jmlBelum = daftarStatusSarana.length - jmlSudah;
    const totalSeluruhFoto = daftarSudahDifoto.reduce((sum, x) => sum + x.totalFoto, 0);

    // Pastikan indexAntreanAktif selalu menunjuk ke lokasi yang belum dikirim
    if (indexAntreanAktif >= jmlSudah) indexAntreanAktif = 0;

    let daftarTampil = daftarStatusSarana;
    if (filterStatus === 'SUDAH') daftarTampil = daftarSudahDifoto;
    else if (filterStatus === 'BELUM') daftarTampil = daftarStatusSarana.filter(x => !x.sudahDifoto);

    const kartuHtml = daftarTampil.map(item => {
      const s = item.sarana;
      const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false);
      const semuaFotoTitik = item.koleksi.flatMap(k => k.fotoList || []);
      const urutanDiAntrean = daftarSudahDifoto.findIndex(x => Number(x.sarana.id) === Number(s.id));

      const previewFotoHtml = semuaFotoTitik.length > 0 ? `
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; margin-top:8px;">
          ${semuaFotoTitik.slice(0, 4).map((src, i) => `
            <div style="position:relative; height:54px; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15);">
              <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
              ${i === 3 && semuaFotoTitik.length > 4 ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.65); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.75rem;">+${semuaFotoTitik.length - 3}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div style="background:rgba(15,23,42,0.8); border:1px solid ${urutanDiAntrean === indexAntreanAktif && item.sudahDifoto ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; border-left:4px solid ${item.sudahDikirimWA ? '#38bdf8' : item.sudahDifoto ? '#10b981' : '#ef4444'}; padding:10px; border-radius:8px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
            <div>
              <span style="font-size:0.65rem; color:${isNonLampu ? '#06b6d4' : '#94a3b8'}; font-weight:700;">
                ${urutanDiAntrean !== -1 ? `[Album #${urutanDiAntrean + 1}] ` : ''}${s.tipe} • ${isNonLampu ? 'NON-LAMPU' : s.jenisLampu}
              </span>
              <div style="color:#fff; font-weight:700; font-size:0.82rem; margin-top:1px;">${s.lokasi}</div>
            </div>
            <span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:700; background:${item.sudahDikirimWA ? 'rgba(56,189,248,0.2)' : item.sudahDifoto ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${item.sudahDikirimWA ? '#38bdf8' : item.sudahDifoto ? '#10b981' : '#ef4444'}; white-space:nowrap;">
              ${item.sudahDikirimWA ? `☑️ Terkirim (${item.totalFoto})` : item.sudahDifoto ? `✅ ${item.totalFoto} Foto` : '❌ Belum Foto'}
            </span>
          </div>

          ${previewFotoHtml}

          <div style="display:flex; gap:6px; margin-top:8px;">
            <button type="button" class="btn-upload-foto-titik" data-id="${s.id}" style="flex:1; background:#1e293b; color:#38bdf8; border:1px solid rgba(56,189,248,0.35); padding:6px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">
              📷 + Tambah Foto
            </button>
            ${item.sudahDifoto ? `
              <button type="button" class="btn-share-wa-titik" data-id="${s.id}" data-urut="${urutanDiAntrean}" style="flex:1.3; background:${item.sudahDikirimWA ? '#334155' : '#059669'}; color:#fff; border:none; padding:6px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">
                ${item.sudahDikirimWA ? '🔄 Kirim Ulang' : '📲 Kirim Album ke WA'}
              </button>
              <button type="button" class="btn-hapus-foto-titik" data-id="${s.id}" style="background:#ef4444; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:0.7rem; cursor:pointer;">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const itemAntreanSekarang = daftarSudahDifoto[indexAntreanAktif];
    const jmlTerkirimSesi = daftarSudahDifoto.filter(x => x.sudahDikirimWA).length;

    modal.innerHTML = `
      <div class="modal-konten" style="max-width:420px; z-index:10000;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="color:#fff; font-size:0.95rem;">📸 Album Dokumentasi & Laporan WA</h3>
          <button type="button" id="btn-tutup-galeri-wa" style="background:transparent; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
          <input type="month" id="galeri-filter-bulan" value="${filterBulan}" style="padding:6px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.75rem;">
          <select id="galeri-filter-kategori" style="padding:6px; border-radius:6px; background:#0f172a; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:0.75rem;">
            <option value="SEMUA" ${filterKategori === 'SEMUA' ? 'selected' : ''}>Semua Kategori</option>
            <option value="AWAL_BULAN" ${filterKategori === 'AWAL_BULAN' ? 'selected' : ''}>Awal Bulan (Semua Sarana)</option>
            <option value="HMS" ${filterKategori === 'HMS' ? 'selected' : ''}>HMS Siang & Malam</option>
            <option value="BYD" ${filterKategori === 'BYD' ? 'selected' : ''}>BYD Senin</option>
          </select>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:10px;">
          <button type="button" class="tab-stat-foto" data-st="SEMUA" style="flex:1; padding:6px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer; background:${filterStatus === 'SEMUA' ? '#2563eb' : '#1e293b'}; color:#fff; border:none;">
            Semua (${daftarStatusSarana.length})
          </button>
          <button type="button" class="tab-stat-foto" data-st="SUDAH" style="flex:1; padding:6px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer; background:${filterStatus === 'SUDAH' ? '#059669' : '#1e293b'}; color:#fff; border:none;">
            ✅ Sudah (${jmlSudah})
          </button>
          <button type="button" class="tab-stat-foto" data-st="BELUM" style="flex:1; padding:6px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer; background:${filterStatus === 'BELUM' ? '#dc2626' : '#1e293b'}; color:#fff; border:none;">
            ❌ Belum (${jmlBelum})
          </button>
        </div>

        <input type="file" id="input-multi-foto-galeri" accept="image/*" multiple style="display:none;">

        <div style="max-height:220px; overflow-y:auto; padding-right:4px; margin-bottom:10px;">
          ${kartuHtml}
        </div>

        <!-- PANEL PENGIRIMAN PINTAR ANTI-MENGULANG -->
        <div style="display:flex; flex-direction:column; gap:6px; border-top:1px solid rgba(255,255,255,0.12); padding-top:10px;">
          ${itemAntreanSekarang ? `
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.4); padding:8px 10px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:#a7f3d0; margin-bottom:4px;">
                <span>⏭️ <strong>ANTREAN BERURUT OTOMATIS (${indexAntreanAktif + 1} dari ${jmlSudah})</strong></span>
                <span>Terkirim: ${jmlTerkirimSesi}/${jmlSudah}</span>
              </div>
              <button type="button" id="btn-kirim-antrean-berikutnya" style="width:100%; background:linear-gradient(90deg,#059669,#10b981); color:#fff; border:none; padding:10px; border-radius:6px; font-size:0.78rem; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                📲 Kirim Lokasi #${indexAntreanAktif + 1}: ${itemAntreanSekarang.sarana.lokasi.slice(0, 28)} (${itemAntreanSekarang.totalFoto} Foto) ➔
              </button>
              <div style="display:flex; justify-content:space-between; margin-top:5px;">
                <button type="button" id="btn-mundur-antrean" style="background:transparent; border:none; color:#94a3b8; font-size:0.66rem; cursor:pointer;">◀ Lokasi Sebelumnya</button>
                <button type="button" id="btn-reset-antrean" style="background:transparent; border:none; color:#38bdf8; font-size:0.66rem; cursor:pointer;">🔄 Reset Urutan ke #1</button>
                <button type="button" id="btn-lompat-antrean" style="background:transparent; border:none; color:#94a3b8; font-size:0.66rem; cursor:pointer;">Lewati ke #${((indexAntreanAktif + 1) % jmlSudah) + 1} ▶</button>
              </div>
            </div>

            <button type="button" id="btn-kirim-semua-foto-sekaligus" style="width:100%; background:#1e293b; color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:8px; border-radius:8px; font-size:0.73rem; font-weight:700; cursor:pointer;">
              🚀 Gabung & Kirim SEMUA ${totalSeluruhFoto} Foto Sekaligus (Watermark Nama Jalan)
            </button>
          ` : ''}

          <button type="button" id="btn-rekap-teks-wa-atasan" style="width:100%; background:#0284c7; color:#fff; border:none; padding:8px; border-radius:8px; font-size:0.73rem; font-weight:700; cursor:pointer;">
            📋 Kirim Teks Checklist (${jmlSudah}/${daftarStatusSarana.length} Selesai) ke WA
          </button>
        </div>
      </div>
    `;

    modal.querySelector('#btn-tutup-galeri-wa').onclick = () => { modal.style.display = 'none'; };

    const elBulan = modal.querySelector('#galeri-filter-bulan');
    const elKat = modal.querySelector('#galeri-filter-kategori');
    elBulan.onchange = () => renderGaleri(elBulan.value, elKat.value, filterStatus);
    elKat.onchange = () => renderGaleri(elBulan.value, elKat.value, filterStatus);

    modal.querySelectorAll('.tab-stat-foto').forEach(btn => {
      btn.onclick = () => renderGaleri(elBulan.value, elKat.value, btn.dataset.st);
    });

    const inputFoto = modal.querySelector('#input-multi-foto-galeri');
    let idSaranaTargetUpload = null;

    modal.querySelectorAll('.btn-upload-foto-titik').forEach(btn => {
      btn.onclick = () => {
        idSaranaTargetUpload = Number(btn.dataset.id);
        inputFoto.click();
      };
    });

    inputFoto.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0 || !idSaranaTargetUpload) return;

      const dataUrlList = [];
      for (const f of files) {
        const dUrl = await prosesFileKeDataUrl(f);
        dataUrlList.push(dUrl);
      }

      const katSimpan = elKat.value === 'SEMUA' ? 'AWAL_BULAN' : elKat.value;
      const idUnik = `${filterBulan}_${idSaranaTargetUpload}_${katSimpan}`;
      const semua = await ambilSemuaAlbumDariDb();
      const existing = semua.find(x => x.id === idUnik);

      const gabunganFoto = existing ? [...existing.fotoList, ...dataUrlList] : dataUrlList;
      await simpanAlbumKeDb({
        id: idUnik,
        idSarana: idSaranaTargetUpload,
        bulan: filterBulan,
        kategori: katSimpan,
        fotoList: gabunganFoto,
        waktuUpdate: new Date().toISOString()
      });

      renderGaleri(elBulan.value, elKat.value, filterStatus);
    };

    // Fungsi Inti Kirim 1 Album Lokasi + Otomatis Geser Antrean ke Lokasi Berikutnya
    async function kirimSatuAlbumDanMaju(targetObj, urutanSekarang) {
      const semuaFotoData = targetObj.koleksi.flatMap(k => k.fotoList || []);
      const namaLokasiCaption = targetObj.sarana.lokasi;
      const fileArray = semuaFotoData.map((dUrl, i) =>
        dataUrlKeFileCepat(dUrl, `${namaLokasiCaption.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25)}_${i + 1}.jpg`)
      );

      if (navigator.clipboard) {
        navigator.clipboard.writeText(namaLokasiCaption).catch(() => {});
      }

      // Tandai sudah dikirim & majukan antrean ke lokasi berikutnya SEBELUM berpindah ke WA
      daftarSudahTerkirimSesiIni.add(Number(targetObj.sarana.id));
      if (urutanSekarang !== undefined && urutanSekarang >= 0) {
        indexAntreanAktif = (urutanSekarang + 1) % daftarSudahDifoto.length;
      }

      // Render ulang di belakang layar agar saat pengguna kembali dari WA, tombol sudah siap di Lokasi #2, #3, dst!
      setTimeout(() => {
        renderGaleri(elBulan.value, elKat.value, filterStatus);
      }, 400);

      if (navigator.canShare && navigator.canShare({ files: fileArray })) {
        await navigator.share({
          files: fileArray,
          text: namaLokasiCaption
        });
      } else {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(namaLokasiCaption)}`, '_blank');
      }
    }

    // Klik dari tombol per kartu
    modal.querySelectorAll('.btn-share-wa-titik').forEach(btn => {
      btn.onclick = async () => {
        const idS = Number(btn.dataset.id);
        const urut = Number(btn.dataset.urut);
        const targetObj = daftarStatusSarana.find(x => Number(x.sarana.id) === idS);
        if (targetObj) {
          try { await kirimSatuAlbumDanMaju(targetObj, urut); } catch (e) {}
        }
      };
    });

    // Klik dari Tombol Utama Antrean Berurut Otomatis (#1 -> #2 -> #3 -> #4)
    const btnAntrean = modal.querySelector('#btn-kirim-antrean-berikutnya');
    if (btnAntrean && itemAntreanSekarang) {
      btnAntrean.onclick = async () => {
        try {
          await kirimSatuAlbumDanMaju(itemAntreanSekarang, indexAntreanAktif);
        } catch (e) {}
      };
    }

    const btnMundur = modal.querySelector('#btn-mundur-antrean');
    if (btnMundur) {
      btnMundur.onclick = () => {
        indexAntreanAktif = (indexAntreanAktif - 1 + jmlSudah) % jmlSudah;
        renderGaleri(elBulan.value, elKat.value, filterStatus);
      };
    }

    const btnLompat = modal.querySelector('#btn-lompat-antrean');
    if (btnLompat) {
      btnLompat.onclick = () => {
        indexAntreanAktif = (indexAntreanAktif + 1) % jmlSudah;
        renderGaleri(elBulan.value, elKat.value, filterStatus);
      };
    }

    const btnResetAntrean = modal.querySelector('#btn-reset-antrean');
    if (btnResetAntrean) {
      btnResetAntrean.onclick = () => {
        indexAntreanAktif = 0;
        daftarSudahTerkirimSesiIni.clear();
        renderGaleri(elBulan.value, elKat.value, filterStatus);
      };
    }

    // Kirim Gabungan Semua Foto Sekaligus dengan Watermark Nama Jalan di Setiap Foto
    const btnKirimSemuaSekaligus = modal.querySelector('#btn-kirim-semua-foto-sekaligus');
    if (btnKirimSemuaSekaligus) {
      btnKirimSemuaSekaligus.onclick = async () => {
        if (daftarSudahDifoto.length === 0) return;
        btnKirimSemuaSekaligus.textContent = '⏳ Menyiapkan Semua Foto & Label Lokasi...';

        const semuaFileGabungan = [];
        const daftarKeteranganLokasi = [];

        for (let idxLok = 0; idxLok < daftarSudahDifoto.length; idxLok++) {
          const item = daftarSudahDifoto[idxLok];
          const namaBersih = item.sarana.lokasi.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
          const fotoLokasiIni = item.koleksi.flatMap(k => k.fotoList || []);

          for (let idxFoto = 0; idxFoto < fotoLokasiIni.length; idxFoto++) {
            const dUrlBerlabel = await buatFotoDenganLabelLokasi(fotoLokasiIni[idxFoto], item.sarana.lokasi, idxLok + 1);
            const namaFile = `Lok${idxLok + 1}_${namaBersih}_${idxFoto + 1}.jpg`;
            semuaFileGabungan.push(dataUrlKeFileCepat(dUrlBerlabel, namaFile));
          }
          daftarKeteranganLokasi.push(`${idxLok + 1}. ${item.sarana.lokasi} (${fotoLokasiIni.length} Foto)`);
        }

        const captionGabungan = `*DOKUMENTASI SARANA PT DEVIS JAYA (${filterBulan})*\n` + daftarKeteranganLokasi.join('\n');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(captionGabungan).catch(() => {});
        }

        btnKirimSemuaSekaligus.textContent = `🚀 Gabung & Kirim SEMUA ${totalSeluruhFoto} Foto Sekaligus (Watermark Nama Jalan)`;

        try {
          if (navigator.canShare && navigator.canShare({ files: semuaFileGabungan })) {
            await navigator.share({
              files: semuaFileGabungan,
              text: captionGabungan
            });
          } else {
            alert("Perangkat membatasi maksimal 10 foto sekali kirim. Gunakan tombol Antrean Berurut di atas.");
          }
        } catch (err) {}
      };
    }

    modal.querySelectorAll('.btn-hapus-foto-titik').forEach(btn => {
      btn.onclick = async () => {
        const idS = Number(btn.dataset.id);
        if (!confirm("Hapus foto dokumentasi titik ini pada bulan terpilih?")) return;
        const targetObj = daftarStatusSarana.find(x => Number(x.sarana.id) === idS);
        if (targetObj) {
          for (const kol of targetObj.koleksi) {
            await hapusAlbumDariDb(kol.id);
          }
        }
        renderGaleri(elBulan.value, elKat.value, filterStatus);
      };
    });

    modal.querySelector('#btn-rekap-teks-wa-atasan').onclick = () => {
      const daftarSudah = daftarSudahDifoto.map((x, i) => `${i + 1}. ✅ ${x.sarana.lokasi} (${x.totalFoto} foto)`).join('\n');
      const daftarBelum = daftarStatusSarana.filter(x => !x.sudahDifoto).map((x, i) => `${i + 1}. ⏳ ${x.sarana.lokasi}`).join('\n');
      const pesan = `*LAPORAN DOKUMENTASI VISUAL SARANA PT DEVIS JAYA*\nPeriode: ${filterBulan}\nStatus: ${jmlSudah} dari ${daftarStatusSarana.length} Titik Selesai\n\n*SUDAH DIFOTO:*\n${daftarSudah || '-'}\n\n*MENUNGGU GILIRAN:*\n${daftarBelum || 'Seluruh titik selesai 100%!'}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(pesan)}`, '_blank');
    };
  }

  renderGaleri(bulanDefault, 'SEMUA', 'SEMUA');
}
