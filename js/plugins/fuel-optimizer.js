// MODUL MANDIRI 1: RUTE URUT JALAN RAYA ASLI (OSRM ROAD ENGINE)
const HARGA_PERTALITE = 10000;
const KM_PER_LITER_BEAT = 52;

function hitungJarakUdaraKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ambil Matriks Jarak Jalan Raya Asli (Aspal) dari OSRM Server
async function ambilMatriksJalanRayaOSRM(titikKoordinatList) {
  try {
    // Format OSRM: longitude,latitude;longitude,latitude
    const strKoordinat = titikKoordinatList
      .map(p => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`)
      .join(';');
    const url = `https://router.project-osrm.org/table/v1/driving/${strKoordinat}?annotations=distance,duration`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM sibuk");
    const data = await res.json();
    if (data.code === 'Ok' && data.distances) {
      return { matriksMeter: data.distances, matriksDetik: data.durations, isOsrm: true };
    }
  } catch (e) {
    console.warn("Beralih ke kalkulasi koridor lokal:", e.message);
  }
  return null;
}

function cekSatuKoridor(namaA, namaB) {
  const koridor = [
    ['pantai', 'pariwisata', 'samudra', 'zakat', 'pasir putih', 'bencoolen'],
    ['adam malik', 'natadirja', 'polda', 'km 8', 'mangga', 'pagar dewa', 'perhubungan'],
    ['parman', 'skip', 'suprapto', 'tiki', 'bps'],
    ['rawa makmur', 'kalimantan', 'tb ken jaya', 'lintas barat'],
    ['padang harapan', 'kasipa', 'sutoyo', 'kumis', 'indra giri', 'meranti', 'sawah lebar'],
    ['ciliwung', 'danau', 'brimob', 'lingkar barat']
  ];
  const a = (namaA || '').toLowerCase();
  const b = (namaB || '').toLowerCase();
  return koridor.some(grup => grup.some(k => a.includes(k)) && grup.some(k => b.includes(k)));
}

export async function optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = false) {
  const saranaValid = (daftarSarana || []).filter(
    s => s.koordinat && typeof s.koordinat.lat === 'number' && typeof s.koordinat.lng === 'number'
  );
  if (saranaValid.length === 0) return { error: "Belum ada koordinat GPS valid pada sarana." };

  const isRealGps = Boolean(posisiUser && typeof posisiUser.lat === 'number' && posisiUser.lat !== -3.8000);
  const posAwal = isRealGps ? posisiUser : { lat: -3.8000, lng: 102.2650 };

  let kandidat = saranaValid.map(s => {
    const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false);
    const info = isNonLampu ? null : fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const nama = s.lokasi.toLowerCase();
    const isMisi = nama.includes('adam malik') || nama.includes('skip') || nama.includes('rawa makmur') || nama.includes('brimob');
    const isWajib = (!isNonLampu && (info.status === 'kritis' || info.status === 'waspada')) || isMisi;
    return { ...s, infoPrediksi: info, isNonLampu, isWajib };
  });

  if (hanyaPrioritas) {
    const wajib = kandidat.filter(k => k.isWajib);
    if (wajib.length > 0) kandidat = wajib;
  }

  // Indeks 0 = Posisi User, Indeks 1..N = Kandidat Sarana
  const semuaTitik = [posAwal, ...kandidat.map(k => k.koordinat)];
  const hasilOsrm = await ambilMatriksJalanRayaOSRM(semuaTitik);

  // Fungsi ambil jarak jalan riil (km) antara indeks i dan j pada semuaTitik
  function getJarakJalanKm(idxAsal, idxTujuan) {
    if (hasilOsrm && hasilOsrm.matriksMeter[idxAsal] && hasilOsrm.matriksMeter[idxAsal][idxTujuan] != null) {
      return Number((hasilOsrm.matriksMeter[idxAsal][idxTujuan] / 1000).toFixed(2));
    }
    const p1 = semuaTitik[idxAsal];
    const p2 = semuaTitik[idxTujuan];
    return Number((hitungJarakUdaraKm(p1.lat, p1.lng, p2.lat, p2.lng) * 1.35).toFixed(2));
  }

  function getMenitTempuh(idxAsal, idxTujuan) {
    if (hasilOsrm && hasilOsrm.matriksDetik[idxAsal] && hasilOsrm.matriksDetik[idxAsal][idxTujuan] != null) {
      return Math.max(1, Math.round(hasilOsrm.matriksDetik[idxAsal][idxTujuan] / 60));
    }
    return Math.max(1, Math.round(getJarakJalanKm(idxAsal, idxTujuan) * 2));
  }

  // 1. Cari Stop #1: Sarana dengan Jarak Jalan Raya Terdekat dari Lokasi Anda (Indeks 0)
  const belumDikunjungi = kandidat.map((item, idx) => ({ item, matrixIdx: idx + 1 }));
  let bestFirst = 0;
  let minFirstDist = Infinity;

  for (let i = 0; i < belumDikunjungi.length; i++) {
    const dJalan = getJarakJalanKm(0, belumDikunjungi[i].matrixIdx);
    if (dJalan < minFirstDist) {
      minFirstDist = dJalan;
      bestFirst = i;
    }
  }

  const urutanTerpilih = [belumDikunjungi.splice(bestFirst, 1)[0]];

  // 2. Urutkan Titik Berikutnya Berdasarkan Jarak Jalan Raya Terdekat + Kesamaan Koridor Jalan
  while (belumDikunjungi.length > 0) {
    const terakhir = urutanTerpilih[urutanTerpilih.length - 1];
    let nextBest = 0;
    let minSkor = Infinity;

    for (let i = 0; i < belumDikunjungi.length; i++) {
      const target = belumDikunjungi[i];
      const jarakJalan = getJarakJalanKm(terakhir.matrixIdx, target.matrixIdx);
      // Beri prioritas (diskon 25%) jika masih berada di satu koridor jalan yang sama agar tidak melompat jalur
      const diskonKoridor = cekSatuKoridor(terakhir.item.lokasi, target.item.lokasi) ? 0.75 : 1.0;
      const skor = jarakJalan * diskonKoridor;

      if (skor < minSkor) {
        minSkor = skor;
        nextBest = i;
      }
    }
    urutanTerpilih.push(belumDikunjungi.splice(nextBest, 1)[0]);
  }

  // 3. Susun Rincian Jarak Jalan Raya (Dari Rumah & Antar-Tiang)
  let totalJarakKm = 0;
  let totalMenit = 0;
  let prevMatrixIdx = 0;

  const ruteFinal = urutanTerpilih.map((obj, idx) => {
    const jarakDariUser = getJarakJalanKm(0, obj.matrixIdx);
    const jarakLeg = getJarakJalanKm(prevMatrixIdx, obj.matrixIdx);
    const menitLeg = getMenitTempuh(prevMatrixIdx, obj.matrixIdx);

    totalJarakKm += jarakLeg;
    totalMenit += menitLeg;
    prevMatrixIdx = obj.matrixIdx;

    return {
      ...obj.item,
      jarakDariUser,
      jarakLeg,
      menitLeg,
      urutanKe: idx + 1
    };
  });

  const estimasiLiter = Number((totalJarakKm / KM_PER_LITER_BEAT).toFixed(2));
  const estimasiBiayaRp = Math.round(estimasiLiter * HARGA_PERTALITE);

  return {
    posisiAwal: posAwal,
    isRealGps,
    isOsrm: Boolean(hasilOsrm && hasilOsrm.isOsrm),
    akurasi: posisiUser ? posisiUser.akurasi : null,
    ruteUrutan: ruteFinal,
    totalTitik: ruteFinal.length,
    totalSemua: saranaValid.length,
    totalJarakKm: Number(totalJarakKm.toFixed(1)),
    totalMenit,
    estimasiLiter,
    estimasiBiayaRp,
    hanyaPrioritas
  };
}

export function buatTautanGoogleMaps(ruteUrutan, posAwal) {
  if (!ruteUrutan || ruteUrutan.length === 0) return null;
  const origin = `${posAwal.lat},${posAwal.lng}`;
  const dest = `${ruteUrutan[ruteUrutan.length - 1].koordinat.lat},${ruteUrutan[ruteUrutan.length - 1].koordinat.lng}`;
  const waypoints = ruteUrutan.slice(0, -1).map(r => `${r.koordinat.lat},${r.koordinat.lng}`).join('|');
  return waypoints
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=motorcycle`
    : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=motorcycle`;
}

export async function bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas = false) {
  let modal = document.getElementById('modal-rute-bbm');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-rute-bbm';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-konten" style="max-width:400px; text-align:center; padding:24px;">
      <div style="font-size:2rem; margin-bottom:8px;">🛣️</div>
      <h4 style="color:#fff; margin-bottom:4px;">Menghitung Rute Jalan Raya Bengkulu...</h4>
      <p style="font-size:0.75rem; color:#94a3b8;">Mengukur jarak aspal riil (OSRM Navigation) dari lokasi Anda ke seluruh titik sarana.</p>
    </div>
  `;

  const hasil = await optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi, hanyaPrioritas);
  if (hasil.error) {
    modal.style.display = 'none';
    alert(hasil.error);
    return;
  }

  const linkGmaps = buatTautanGoogleMaps(hasil.ruteUrutan, hasil.posisiAwal);
  const posAwalStr = `${hasil.posisiAwal.lat},${hasil.posisiAwal.lng}`;

  const daftarStepHtml = hasil.ruteUrutan.map((s, idx) => {
    let kwhTampil = s.isNonLampu ? 'Non-Lampu' : (s.infoPrediksi && s.infoPrediksi.terakhir ? `${s.infoPrediksi.terakhir.kwh.toLocaleString('id-ID')} kWh` : '-');
    let statusClass = s.isNonLampu ? 'aman' : (s.infoPrediksi ? s.infoPrediksi.status : 'aman');
    const warnaBorder = s.isNonLampu ? '#06b6d4' : statusClass === 'kritis' ? '#ef4444' : statusClass === 'waspada' ? '#f59e0b' : '#10b981';

    // Tautan Maps dari titik sebelumnya agar cocok dengan jarak berantai
    const titikAsalLeg = idx === 0
      ? posAwalStr
      : `${hasil.ruteUrutan[idx - 1].koordinat.lat},${hasil.ruteUrutan[idx - 1].koordinat.lng}`;
    const urlMapsLeg = `https://www.google.com/maps/dir/?api=1&origin=${titikAsalLeg}&destination=${s.koordinat.lat},${s.koordinat.lng}&travelmode=motorcycle`;

    return `
      <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.08); border-left:4px solid ${warnaBorder}; padding:10px; border-radius:8px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <strong style="color:#fff; font-size:0.84rem;">${idx + 1}. ${s.lokasi}</strong>
            <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">
              ${s.isNonLampu ? '🏷️ Non-Lampu (Polos)' : `⚡ Sisa Token: <strong>${kwhTampil}</strong>`}
            </div>
          </div>
          <a href="${urlMapsLeg}" target="_blank" style="background:#0284c7; color:#fff; text-decoration:none; font-size:0.7rem; font-weight:700; padding:5px 8px; border-radius:5px; white-space:nowrap;">
            Maps ➔
          </a>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.71rem;">
          <span style="color:#38bdf8;">🏠 Dari Rumah/Anda: <strong>${s.jarakDariUser} km</strong></span>
          <span style="color:#10b981;">🛣️ Laju Rute: <strong>+${s.jarakLeg} km</strong> (~${s.menitLeg} mnt)</span>
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-konten" style="max-width:410px; z-index:10000;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="color:#fff; font-size:0.95rem;">⚡ Rute Jalan Raya Presisi (${hasil.isOsrm ? 'OSRM Live' : 'Koridor'})</h3>
        <button type="button" id="btn-tutup-rute-bbm" style="background:transparent; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
      </div>

      <div style="background:${hasil.isRealGps ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; border:1px solid ${hasil.isRealGps ? '#10b981' : '#f59e0b'}; padding:8px 10px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.74rem; font-weight:700; color:${hasil.isRealGps ? '#10b981' : '#f59e0b'};">
            ${hasil.isRealGps ? '📍 Titik Awal GPS Anda Terkunci' : '⚠️ Titik Default Pusat Kota'}
          </div>
          <div style="font-size:0.68rem; color:#cbd5e1;">
            ${hasil.posisiAwal.lat.toFixed(5)}, ${hasil.posisiAwal.lng.toFixed(5)} ${hasil.akurasi ? `(±${hasil.akurasi}m)` : ''}
          </div>
        </div>
        <button type="button" id="btn-refresh-gps-modal" style="background:#0284c7; color:#fff; border:none; padding:5px 9px; border-radius:4px; font-size:0.7rem; font-weight:700; cursor:pointer;">
          🔄 Kunci GPS
        </button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button type="button" id="btn-mode-rute-semua" style="flex:1; padding:7px; border-radius:6px; font-size:0.74rem; font-weight:700; cursor:pointer; background:${!hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${!hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🌐 Keliling Semua (${hasil.totalSemua})
        </button>
        <button type="button" id="btn-mode-rute-prioritas" style="flex:1; padding:7px; border-radius:6px; font-size:0.74rem; font-weight:700; cursor:pointer; background:${hanyaPrioritas ? '#2563eb' : '#1e293b'}; color:#fff; border:1px solid ${hanyaPrioritas ? '#3b82f6' : 'rgba(255,255,255,0.1)'};">
          🎯 Prioritas & Misi
        </button>
      </div>

      <div style="background:linear-gradient(135deg, rgba(30,58,138,0.35), rgba(15,23,42,0.85)); border:1px solid rgba(59,130,246,0.3); padding:10px; border-radius:8px; margin-bottom:10px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.1rem; font-weight:800; color:#fff;">${hasil.totalJarakKm} km</div>
            <div style="font-size:0.65rem; color:#94a3b8;">Total Jarak Jalan (~${hasil.totalMenit} mnt)</div>
          </div>
          <div style="background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; text-align:center;">
            <div style="font-size:1.1rem; font-weight:800; color:#38bdf8;">Rp ${hasil.estimasiBiayaRp.toLocaleString('id-ID')}</div>
            <div style="font-size:0.65rem; color:#94a3b8;">BBM Beat (~${hasil.estimasiLiter}L)</div>
          </div>
        </div>
      </div>

      <div style="font-size:0.74rem; font-weight:700; color:#fff; margin-bottom:6px;">Urutan Rute Jalan Raya Terdekat:</div>
      <div style="max-height:230px; overflow-y:auto; padding-right:4px; margin-bottom:10px;">
        ${daftarStepHtml}
      </div>

      ${linkGmaps ? `<a href="${linkGmaps}" target="_blank" style="display:block; text-align:center; background:#2563eb; color:#fff; text-decoration:none; padding:10px; border-radius:8px; font-size:0.8rem; font-weight:700;">🚀 Buka Seluruh Rute Berantai di Google Maps</a>` : ''}
    </div>
  `;

  modal.querySelector('#btn-tutup-rute-bbm').onclick = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-mode-rute-semua').onclick = () => bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, false);
  modal.querySelector('#btn-mode-rute-prioritas').onclick = () => bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi, true);
  modal.querySelector('#btn-refresh-gps-modal').onclick = async () => {
    const btnRef = modal.querySelector('#btn-refresh-gps-modal');
    btnRef.textContent = '⏳ Mengunci...';
    try {
      const { dapatkanKoordinatGPS } = await import('../gps.js');
      const posBaru = await dapatkanKoordinatGPS();
      bukaModalOptimasiBBM(daftarSarana, posBaru, fnHitungPrediksi, hanyaPrioritas);
    } catch (e) {
      alert(e.message);
      btnRef.textContent = '🔄 Kunci GPS';
    }
  };
}
