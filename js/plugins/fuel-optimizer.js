// js/plugins/fuel-optimizer.js - Presisi Tinggi AI Fuel-Route Optimizer
const HARGA_PERTALITE = 10000;
const KM_PER_LITER_BEAT = 52; 
const FAKTOR_JALANAN_BENGKULU = 1.35; 

function hitungJarakLurus(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * FAKTOR_JALANAN_BENGKULU;
}

function optimasiJalur2Opt(ruteAwal, posAwal) {
  if (ruteAwal.length <= 2) return ruteAwal;
  let urutan = [...ruteAwal];
  let adaPeningkatan = true;
  let iterasi = 0;

  function hitungPanjangTotal(titikList) {
    let tot = hitungJarakLurus(posAwal.lat, posAwal.lng, titikList[0].koordinat.lat, titikList[0].koordinat.lng);
    for (let i = 0; i < titikList.length - 1; i++) {
      tot += hitungJarakLurus(titikList[i].koordinat.lat, titikList[i].koordinat.lng, titikList[i+1].koordinat.lat, titikList[i+1].koordinat.lng);
    }
    return tot;
  }

  let jarakTerbaik = hitungPanjangTotal(urutan);

  while (adaPeningkatan && iterasi < 50) {
    adaPeningkatan = false;
    iterasi++;
    for (let i = 0; i < urutan.length - 1; i++) {
      for (let k = i + 1; k < urutan.length; k++) {
        const variasiBaru = [
          ...urutan.slice(0, i),
          ...urutan.slice(i, k + 1).reverse(),
          ...urutan.slice(k + 1)
        ];
        const jarakBaru = hitungPanjangTotal(variasiBaru);
        if (jarakBaru < jarakTerbaik - 0.05) {
          urutan = variasiBaru;
          jarakTerbaik = jarakBaru;
          adaPeningkatan = true;
          break;
        }
      }
      if (adaPeningkatan) break;
    }
  }
  return urutan;
}

export function optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = true) {
  if (!daftarSarana || daftarSarana.length === 0) {
    return { error: "Belum ada data sarana." };
  }

  const saranaDenganGps = daftarSarana.filter(s => s.koordinat && typeof s.koordinat.lat === 'number' && typeof s.koordinat.lng === 'number');

  if (saranaDenganGps.length === 0) {
    return { error: "Belum ada koordinat GPS valid pada sarana." };
  }

  const isRealGps = (posisiUser && typeof posisiUser.lat === 'number' && posisiUser.lat !== -3.8000);
  const posAwal = isRealGps ? posisiUser : { lat: -3.8000, lng: 102.2650 };

  let kandidat = [];

  if (hanyaPrioritas) {
    const prioritasList = [];
    const cadanganList = [];

    saranaDenganGps.forEach(s => {
      const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false);
      let isWajib = false;
      let info = null;

      if (!isNonLampu) {
        info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
        isWajib = (info.status === 'kritis' || info.status === 'waspada');
      }

      const namaLokasi = s.lokasi.toLowerCase();
      const isTargetMisi = namaLokasi.includes('adam malik') || namaLokasi.includes('skip') || namaLokasi.includes('rawa makmur') || namaLokasi.includes('brimob');
      if (isTargetMisi) isWajib = true;

      const item = { ...s, infoPrediksi: info, isWajib, isNonLampu };
      if (isWajib) prioritasList.push(item);
      else cadanganList.push(item);
    });

    kandidat = [...prioritasList];
    if (kandidat.length < 5) {
      cadanganList.sort((a, b) => {
        const da = hitungJarakLurus(posAwal.lat, posAwal.lng, a.koordinat.lat, a.koordinat.lng);
        const db = hitungJarakLurus(posAwal.lat, posAwal.lng, b.koordinat.lat, b.koordinat.lng);
        return da - db;
      });
      kandidat.push(...cadanganList.slice(0, 5 - kandidat.length));
    }
  } else {
    kandidat = saranaDenganGps.map(s => {
      const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false);
      return {
        ...s,
        infoPrediksi: isNonLampu ? null : fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu),
        isNonLampu
      };
    });
  }

  // Nearest Neighbor dari posisi awal pengguna
  const tahap1 = [];
  let sisaKandidat = [...kandidat];
  let curPos = posAwal;

  while (sisaKandidat.length > 0) {
    let terdekatIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < sisaKandidat.length; i++) {
      const d = hitungJarakLurus(curPos.lat, curPos.lng, sisaKandidat[i].koordinat.lat, sisaKandidat[i].koordinat.lng);
      if (d < minDist) {
        minDist = d;
        terdekatIdx = i;
      }
    }
    const terpilih = sisaKandidat.splice(terdekatIdx, 1)[0];
    tahap1.push(terpilih);
    curPos = terpilih.koordinat;
  }

  const ruteFinal = optimasiJalur2Opt(tahap1, posAwal);

  let totalJarakKm = 0;
  let titikLalu = posAwal;
  const ruteDenganDetail = ruteFinal.map((item, idx) => {
    const legDist = hitungJarakLurus(titikLalu.lat, titikLalu.lng, item.koordinat.lat, item.koordinat.lng);
    totalJarakKm += legDist;
    titikLalu = item.koordinat;
    return {
      ...item,
      jarakLeg: Number(legDist.toFixed(1)),
      keteranganDari: idx === 0 ? "dari lokasi Anda sekarang" : "dari titik sebelumnya"
    };
  });

  const estimasiLiter = Number((totalJarakKm / KM_PER_LITER_BEAT).toFixed(2));
  const estimasiBiayaRp = Math.round(estimasiLiter * HARGA_PERTALITE);
  const jarakButa = 34.0;
  const penghematanRp = Math.max(0, Math.round(((jarakButa - totalJarakKm) / KM_PER_LITER_BEAT) * HARGA_PERTALITE));

  return {
    posisiAwal: posAwal,
    isRealGps,
    akurasi: posisiUser ? posisiUser.akurasi : null,
    ruteUrutan: ruteDenganDetail,
    totalTitik: ruteDenganDetail.length,
    totalSemua: saranaDenganGps.length,
    totalJarakKm: Number(totalJarakKm.toFixed(1)),
    estimasiLiter,
    estimasiBiayaRp,
    penghematanRp,
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

export function bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = true) {
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
    let estTampil = '-';
    let statusClass = 'aman';

    if (s.isNonLampu) {
      kwhTampil = 'Non-Lampu';
      estTampil = 'Fisik Polos';
    } else if (s.infoPrediksi) {
      kwhTampil = s.infoPrediksi.terakhir ? `${s.infoPrediksi.terakhir.kwh} kWh` : '-';
      estTampil = s.infoPrediksi.estimasiHari !== undefined ? `±${s.infoPrediksi.estimasiHari} hr` : '-';
      statusClass = s.infoPrediksi.status || 'aman';
    }

    return `
      <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-left:4px solid ${s.isNonLampu ? '#06b6d4' : statusClass === 'kritis' ? '#ef4444' : statusClass === 'waspada' ? '#f59e0b' : '#10b981'}; padding:8px 10px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:#fff; font-size:0.8rem;">${idx + 1}. ${s.lokasi}</strong>
          <div style="color:#94a3b8; font-size:0.68rem; margin-top:2px;">
            Jarak: +${s.jarakLeg} km (${s.keteranganDari}) • ${s.isNonLampu ? '🏷️ Non-Lampu' : `Sisa: ${kwhTampil}`}
          </div>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${s.koordinat.lat},${s.koordinat.lng}" target="_blank" style="color:#38bdf8; text-decoration:none; font-size:0.75rem; font-weight:700;">Maps ➔</a>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-konten" style="max-width: 400px; z-index: 10000;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="color:#fff; font-size:0.95rem;">⚡ Presisi AI Route Optimizer</h3>
        <button type="button" id="btn-tutup-rute-bbm" style="background:transparent; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
      </div>

      <!-- STATUS GPS REAL -->
      <div style="background:${hasil.isRealGps ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; border:1px solid ${hasil.isRealGps ? '#10b981' : '#f59e0b'}; padding:8px 10px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.75rem; font-weight:700; color:${hasil.isRealGps ? '#10b981' : '#f59e0b'};">
            ${hasil.isRealGps ? '📍 Posisi GPS HP Anda Terkunci' : '⚠️ Posisi Default Pusat Kota'}
          </div>
          <div style="font-size:0.68rem; color:#cbd5e1;">
            ${hasil.posisiAwal.lat.toFixed(5)}, ${hasil.posisiAwal.lng.toFixed(5)} ${hasil.akurasi ? `(±${hasil.akurasi}m)` : ''}
          </div>
        </div>
        <button type="button" id="btn-refresh-gps-modal" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.68rem; font-weight:700; cursor:pointer;">
          🔄 Kunci GPS
        </button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button type="button" id="btn-mode-rute-prioritas" style="flex:1; padding:6px; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer; background:${hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🎯 Target & Misi (${hasil.totalTitik} Titik)
        </button>
        <button type="button" id="btn-mode-rute-semua" style="flex:1; padding:6px; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer; background:${!hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${!hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🌐 Keliling Semua (${hasil.totalSemua} Titik)
        </button>
      </div>

      <div style="background:linear-gradient(135deg, rgba(30,58,138,0.3), rgba(15,23,42,0.8)); border:1px solid rgba(59,130,246,0.3); padding:10px; border-radius:8px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; color:#93c5fd; font-weight:700;">🛣️ Rute Urut Aspal Bengkulu</span>
          <span style="font-size:0.68rem; color:#10b981; background:rgba(16,185,129,0.15); padding:2px 6px; border-radius:4px;">Hemat Rp ${hasil.penghematanRp.toLocaleString('id-ID')}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.1rem; font-weight:800; color:#fff;">${hasil.totalJarakKm} km</div>
            <div style="font-size:0.65rem; color:#94a3b8;">Total Jarak Aspal</div>
          </div>
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.1rem; font-weight:800; color:#38bdf8;">Rp ${hasil.estimasiBiayaRp.toLocaleString('id-ID')}</div>
            <div style="font-size:0.65rem; color:#94a3b8;">BBM Honda Beat (~${hasil.estimasiLiter}L)</div>
          </div>
        </div>
      </div>

      <div style="font-size:0.75rem; font-weight:700; color:#fff; margin-bottom:6px;">Urutan Dari Titik Terdekat Anda:</div>
      <div style="max-height: 230px; overflow-y: auto; padding-right: 4px; margin-bottom:10px;">
        ${daftarStepHtml}
      </div>

      ${linkGmaps ? `<a href="${linkGmaps}" target="_blank" style="display:block; text-align:center; background:#2563eb; color:#fff; text-decoration:none; padding:10px; border-radius:8px; font-size:0.8rem; font-weight:700;">🚀 Buka Navigasi Berantai di Google Maps</a>` : ''}
    </div>
  `;

  modal.style.display = 'flex';

  modal.querySelector('#btn-tutup-rute-bbm').onclick = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-mode-rute-prioritas').onclick = () => {
    bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, true);
  };
  modal.querySelector('#btn-mode-rute-semua').onclick = () => {
    bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, false);
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
