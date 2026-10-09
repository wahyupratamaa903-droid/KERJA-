// js/plugins/fuel-optimizer.js - Metode Pinned Nearest-Neighbor & Transparansi Jarak Ganda
const HARGA_PERTALITE = 10000;
const KM_PER_LITER_BEAT = 52; 

// Rumus Haversine Jarak Riil
function hitungJarakMurniKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Number((R * c).toFixed(2));
}

export function optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = false) {
  if (!daftarSarana || daftarSarana.length === 0) {
    return { error: "Belum ada data sarana." };
  }

  const saranaValid = daftarSarana.filter(s => s.koordinat && typeof s.koordinat.lat === 'number' && typeof s.koordinat.lng === 'number');

  if (saranaValid.length === 0) {
    return { error: "Belum ada koordinat GPS valid pada sarana." };
  }

  const isRealGps = Boolean(posisiUser && typeof posisiUser.lat === 'number' && posisiUser.lat !== -3.8000);
  const posAwal = isRealGps ? posisiUser : { lat: -3.8000, lng: 102.2650 };

  let poolKandidat = [];

  if (hanyaPrioritas) {
    const prioritasList = [];
    const cadanganList = [];

    saranaValid.forEach(s => {
      const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false);
      let isWajib = false;
      let info = null;

      if (!isNonLampu) {
        info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
        isWajib = (info.status === 'kritis' || info.status === 'waspada');
      }

      const nama = s.lokasi.toLowerCase();
      if (nama.includes('adam malik') || nama.includes('skip') || nama.includes('rawa makmur') || nama.includes('brimob')) {
        isWajib = true;
      }

      const item = { ...s, infoPrediksi: info, isNonLampu };
      if (isWajib) prioritasList.push(item);
      else cadanganList.push(item);
    });

    poolKandidat = [...prioritasList];
    if (poolKandidat.length < 5) {
      cadanganList.sort((a, b) => {
        const da = hitungJarakMurniKm(posAwal.lat, posAwal.lng, a.koordinat.lat, a.koordinat.lng);
        const db = hitungJarakMurniKm(posAwal.lat, posAwal.lng, b.koordinat.lat, b.koordinat.lng);
        return da - db;
      });
      poolKandidat.push(...cadanganList.slice(0, 5 - poolKandidat.length));
    }
  } else {
    poolKandidat = saranaValid.map(s => ({
      ...s,
      infoPrediksi: (s.jenisLampu === 'NONE' || s.isBerlampu === false) ? null : fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu),
      isNonLampu: (s.jenisLampu === 'NONE' || s.isBerlampu === false)
    }));
  }

  // 1. CARI TITIK NOMOR 1: WAJIB SARANA PALING DEKAT DARI POSISI ANDA BERDIRI
  let sisaKandidat = [...poolKandidat];
  let idxTerdekat = 0;
  let minJarakUser = Infinity;

  for (let i = 0; i < sisaKandidat.length; i++) {
    const d = hitungJarakMurniKm(posAwal.lat, posAwal.lng, sisaKandidat[i].koordinat.lat, sisaKandidat[i].koordinat.lng);
    if (d < minJarakUser) {
      minJarakUser = d;
      idxTerdekat = i;
    }
  }

  // Kunci titik pertama
  const ruteUrutan = [sisaKandidat.splice(idxTerdekat, 1)[0]];
  let posisiTerakhir = ruteUrutan[0].koordinat;

  // 2. DARI TITIK PERTAMA, URUTKAN KE TITIK TETANGGA TERDEKAT BERIKUTNYA SECARA BERANTAI
  while (sisaKandidat.length > 0) {
    let nextIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < sisaKandidat.length; i++) {
      const d = hitungJarakMurniKm(posisiTerakhir.lat, posisiTerakhir.lng, sisaKandidat[i].koordinat.lat, sisaKandidat[i].koordinat.lng);
      if (d < minDist) {
        minDist = d;
        nextIdx = i;
      }
    }
    const nextStop = sisaKandidat.splice(nextIdx, 1)[0];
    ruteUrutan.push(nextStop);
    posisiTerakhir = nextStop.koordinat;
  }

  // 3. HITUNG RINCIAN JARAK DARI ANDA & JARAK ANTAR-TITIK
  let totalJarakTempuhKm = 0;
  let prevPos = posAwal;

  const ruteFinal = ruteUrutan.map((item, idx) => {
    const jarakDariUser = hitungJarakMurniKm(posAwal.lat, posAwal.lng, item.koordinat.lat, item.koordinat.lng);
    const legDist = hitungJarakMurniKm(prevPos.lat, prevPos.lng, item.koordinat.lat, item.koordinat.lng);
    totalJarakTempuhKm += legDist;
    prevPos = item.koordinat;

    return {
      ...item,
      jarakDariUser,
      jarakLeg: legDist,
      isTitikPertama: idx === 0
    };
  });

  const estimasiLiter = Number((totalJarakTempuhKm / KM_PER_LITER_BEAT).toFixed(2));
  const estimasiBiayaRp = Math.round(estimasiLiter * HARGA_PERTALITE);

  return {
    posisiAwal: posAwal,
    isRealGps,
    akurasi: posisiUser ? posisiUser.akurasi : null,
    ruteUrutan: ruteFinal,
    totalTitik: ruteFinal.length,
    totalSemua: saranaValid.length,
    totalJarakKm: Number(totalJarakTempuhKm.toFixed(1)),
    estimasiLiter,
    estimasiBiayaRp,
    hanyaPrioritas
  };
}

export function buatTautanGoogleMaps(ruteUrutan, posAwal) {
  if (!ruteUrutan || ruteUrutan.length === 0) return null;
  const origin = `${posAwal.lat},${posAwal.lng}`;
  const destination = `${ruteUrutan[ruteUrutan.length - 1].koordinat.lat},${ruteUrutan[ruteUrutan.length - 1].koordinat.lng}`;
  const waypoints = ruteUrutan.slice(0, -1).map(r => `${r.koordinat.lat},${r.koordinat.lng}`).join('|');
  
  if (waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=motorcycle`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=motorcycle`;
}

export function bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = false) {
  let modal = document.getElementById('modal-rute-bbm');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-rute-bbm';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const hasil = optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas);
  if (hasil.error) {
    alert(hasil.error);
    return;
  }

  const linkGmaps = buatTautanGoogleMaps(hasil.ruteUrutan, hasil.posisiAwal);

  const daftarStepHtml = hasil.ruteUrutan.map((s, idx) => {
    let kwhTampil = '-';
    let statusClass = 'aman';

    if (s.isNonLampu) {
      kwhTampil = 'Non-Lampu';
    } else if (s.infoPrediksi) {
      kwhTampil = s.infoPrediksi.terakhir ? `${s.infoPrediksi.terakhir.kwh} kWh` : '-';
      statusClass = s.infoPrediksi.status || 'aman';
    }

    return `
      <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-left:4px solid ${s.isNonLampu ? '#06b6d4' : statusClass === 'kritis' ? '#ef4444' : statusClass === 'waspada' ? '#f59e0b' : '#10b981'}; padding:10px; border-radius:8px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong style="color:#fff; font-size:0.85rem;">${idx + 1}. ${s.lokasi}</strong>
            <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">
              ${s.isNonLampu ? '🏷️ Non-Lampu (Fisik Polos)' : `Sisa Token: <strong>${kwhTampil}</strong>`}
            </div>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${s.koordinat.lat},${s.koordinat.lng}" target="_blank" style="background:#0284c7; color:#fff; text-decoration:none; font-size:0.7rem; font-weight:700; padding:4px 8px; border-radius:4px; white-space:nowrap;">
            Buka Maps ➔
          </a>
        </div>
        
        <!-- DUA INFORMASI JARAK TRANSPARAN -->
        <div style="display:flex; gap:12px; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.72rem;">
          <span style="color:#38bdf8;">🏠 Dari Anda: <strong>${s.jarakDariUser} km</strong></span>
          <span style="color:#a7f3d0;">➡️ Antar Rute: <strong>+${s.jarakLeg} km</strong></span>
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-konten" style="max-width: 400px; z-index: 10000;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="color:#fff; font-size:0.95rem;">⚡ Presisi AI Route Optimizer</h3>
        <button type="button" id="btn-tutup-rute-bbm" style="background:transparent; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
      </div>

      <!-- KOTAK STATUS GPS -->
      <div style="background:${hasil.isRealGps ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; border:1px solid ${hasil.isRealGps ? '#10b981' : '#f59e0b'}; padding:8px 10px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.75rem; font-weight:700; color:${hasil.isRealGps ? '#10b981' : '#f59e0b'};">
            ${hasil.isRealGps ? '📍 Posisi GPS Anda Terkunci' : '⚠️ Posisi Default Kota'}
          </div>
          <div style="font-size:0.68rem; color:#cbd5e1;">
            ${hasil.posisiAwal.lat.toFixed(5)}, ${hasil.posisiAwal.lng.toFixed(5)} ${hasil.akurasi ? `(akurasi ±${hasil.akurasi}m)` : ''}
          </div>
        </div>
        <button type="button" id="btn-refresh-gps-modal" style="background:#0284c7; color:#fff; border:none; padding:5px 9px; border-radius:4px; font-size:0.7rem; font-weight:700; cursor:pointer;">
          🔄 Kunci GPS
        </button>
      </div>

      <!-- PILIHAN TARGET VS KELILING SEMUA -->
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button type="button" id="btn-mode-rute-semua" style="flex:1; padding:7px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer; background:${!hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${!hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🌐 Keliling Semua (${hasil.totalSemua} Titik)
        </button>
        <button type="button" id="btn-mode-rute-prioritas" style="flex:1; padding:7px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer; background:${hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🎯 Target Kritis & Misi
        </button>
      </div>

      <div style="background:linear-gradient(135deg, rgba(30,58,138,0.3), rgba(15,23,42,0.8)); border:1px solid rgba(59,130,246,0.3); padding:10px; border-radius:8px; margin-bottom:10px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.15rem; font-weight:800; color:#fff;">${hasil.totalJarakKm} km</div>
            <div style="font-size:0.65rem; color:#94a3b8;">Total Rute Berantai</div>
          </div>
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.15rem; font-weight:800; color:#38bdf8;">Rp ${hasil.estimasiBiayaRp.toLocaleString('id-ID')}</div>
            <div style="font-size:0.65rem; color:#94a3b8;">BBM Beat (~${hasil.estimasiLiter}L)</div>
          </div>
        </div>
      </div>

      <div style="font-size:0.75rem; font-weight:700; color:#fff; margin-bottom:6px;">Urutan Dari yang Paling Dekat dari Anda:</div>
      <div style="max-height: 240px; overflow-y: auto; padding-right: 4px; margin-bottom:10px;">
        ${daftarStepHtml}
      </div>

      ${linkGmaps ? `<a href="${linkGmaps}" target="_blank" style="display:block; text-align:center; background:#2563eb; color:#fff; text-decoration:none; padding:10px; border-radius:8px; font-size:0.8rem; font-weight:700;">🚀 Buka Navigasi Berantai di Google Maps</a>` : ''}
    </div>
  `;

  modal.style.display = 'flex';

  modal.querySelector('#btn-tutup-rute-bbm').onclick = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-mode-rute-semua').onclick = () => {
    bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, false);
  };
  modal.querySelector('#btn-mode-rute-prioritas').onclick = () => {
    bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, true);
  };

  modal.querySelector('#btn-refresh-gps-modal').onclick = async () => {
    const btnRef = modal.querySelector('#btn-refresh-gps-modal');
    btnRef.textContent = '⏳ Mengunci...';
    try {
      const { dapatkanKoordinatGPS } = await import('../gps.js');
      const posBaru = await dapatkanKoordinatGPS();
      bukaModalOptimasiBBM(daftarSarana, posBaru, fnHitungPrediksi, hanyaPrioritas);
    } catch (e) {
      alert(e.message);
      btnRef.textContent = '🔄 Coba Lagi';
    }
  };
}
