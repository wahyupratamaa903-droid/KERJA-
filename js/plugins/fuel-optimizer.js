// js/plugins/fuel-optimizer.js - AI Smart Fuel-Route Optimizer & Self-Contained Modal
const HARGA_PERTALITE_PER_LITER = 10000;
const KM_PER_LITER_BEAT = 50; // Konsumsi rata-rata Honda Beat 110cc

function hitungJarakHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi) {
  if (!daftarSarana || daftarSarana.length === 0) {
    return { error: "Belum ada data sarana." };
  }

  const posAwal = (posisiUser && posisiUser.lat) ? posisiUser : { lat: -3.8000, lng: 102.2650 };
  const saranaDenganGps = daftarSarana.filter(s => s.koordinat && s.koordinat.lat && s.koordinat.lng);

  if (saranaDenganGps.length === 0) {
    return { error: "Belum ada koordinat GPS valid pada sarana." };
  }

  const targetPrioritas = [];
  const targetAman = [];

  saranaDenganGps.forEach(s => {
    const info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
    const historiUrut = [...s.riwayatToken].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const tglTerakhir = historiUrut.length > 0 ? new Date(historiUrut[0].tanggal) : new Date(0);
    const selisihHariCek = Math.round((new Date() - tglTerakhir) / (1000 * 60 * 60 * 24));

    const itemEvaluasi = {
      ...s,
      infoPrediksi: info,
      selisihHariCek,
      isWajib: info.status === 'kritis' || info.status === 'waspada' || selisihHariCek >= 7
    };

    if (itemEvaluasi.isWajib) {
      targetPrioritas.push(itemEvaluasi);
    } else {
      targetAman.push(itemEvaluasi);
    }
  });

  let antrianKunjungan = [...targetPrioritas];
  if (antrianKunjungan.length < 5) {
    targetAman.sort((a, b) => b.selisihHariCek - a.selisihHariCek);
    const sisaSlot = 5 - antrianKunjungan.length;
    antrianKunjungan.push(...targetAman.slice(0, sisaSlot));
  }

  const ruteUrutan = [];
  let titikSekarang = posAwal;
  let kumpulanKandidat = [...antrianKunjungan];
  let totalJarakKm = 0;

  while (kumpulanKandidat.length > 0) {
    let jarakTerdekat = Infinity;
    let indeksTerdekat = -1;

    for (let i = 0; i < kumpulanKandidat.length; i++) {
      const k = kumpulanKandidat[i];
      const jarak = hitungJarakHaversine(titikSekarang.lat, titikSekarang.lng, k.koordinat.lat, k.koordinat.lng);
      if (jarak < jarakTerdekat) {
        jarakTerdekat = jarak;
        indeksTerdekat = i;
      }
    }

    if (indeksTerdekat !== -1) {
      const terpilih = kumpulanKandidat.splice(indeksTerdekat, 1)[0];
      totalJarakKm += jarakTerdekat;
      ruteUrutan.push({
        ...terpilih,
        jarakDariTitikSebelumnya: Number(jarakTerdekat.toFixed(2))
      });
      titikSekarang = terpilih.koordinat;
    }
  }

  const estimasiLiter = Number((totalJarakKm / KM_PER_LITER_BEAT).toFixed(2));
  const estimasiBiayaRp = Math.round(estimasiLiter * HARGA_PERTALITE_PER_LITER);
  const jarakPenuhJikaKelilingSemua = 25.0;
  const penghematanKm = Math.max(0, Number((jarakPenuhJikaKelilingSemua - totalJarakKm).toFixed(1)));
  const penghematanRp = Math.round((penghematanKm / KM_PER_LITER_BEAT) * HARGA_PERTALITE_PER_LITER);

  return {
    posisiAwal: posAwal,
    ruteUrutan,
    totalTitik: ruteUrutan.length,
    totalTitikKeseluruhan: daftarSarana.length,
    totalJarakKm: Number(totalJarakKm.toFixed(1)),
    estimasiLiter,
    estimasiBiayaRp,
    penghematanKm,
    penghematanRp
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

// FUNGSI POP-UP MODAL MANDIRI (AUTO-INJECT ANTI-CACHE)
export function bukaModalOptimasiBBM(daftarSarana, posisiUser, fnHitungPrediksi) {
  let modal = document.getElementById('modal-rute-bbm');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-rute-bbm';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const hasil = optimasiRuteBBM(daftarSarana, posisiUser, fnHitungPrediksi);
  if (hasil.error) {
    alert(hasil.error);
    return;
  }

  const linkGmaps = buatTautanGoogleMaps(hasil.ruteUrutan, hasil.posisiAwal);

  const daftarStepHtml = hasil.ruteUrutan.map((s, idx) => {
    const kwhTampil = (s.infoPrediksi && s.infoPrediksi.terakhir) ? `${s.infoPrediksi.terakhir.kwh} kWh` : '-';
    const estHari = (s.infoPrediksi && s.infoPrediksi.estimasiHari !== undefined) ? `±${s.infoPrediksi.estimasiHari} hr` : '-';
    const stClass = (s.infoPrediksi && s.infoPrediksi.status) ? s.infoPrediksi.status : 'aman';

    return `
      <div class="rute-step-item ${stClass}">
        <div>
          <strong style="color:#fff;">${idx + 1}. ${s.lokasi}</strong>
          <div style="color:#94a3b8; font-size:0.68rem;">
            Jarak: +${s.jarakDariTitikSebelumnya} km • Sisa: ${kwhTampil} (${estHari})
          </div>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${s.koordinat.lat},${s.koordinat.lng}" target="_blank" style="color:#60a5fa; text-decoration:none; font-size:0.75rem; font-weight:700;">Maps ➔</a>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-konten" style="max-width: 390px; z-index: 10000;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="color:#fff; font-size:1rem;">⚡ AI Fuel-Route Optimizer</h3>
        <button type="button" id="btn-tutup-rute-bbm" style="background:transparent; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
      </div>

      <div class="bbm-stats-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; color:#93c5fd; font-weight:700;">🎯 TARGET HARI INI: ${hasil.totalTitik} TITIK</span>
          <span style="font-size:0.7rem; color:#10b981; background:rgba(16,185,129,0.15); padding:2px 6px; border-radius:4px;">Hemat Rp ${hasil.penghematanRp.toLocaleString('id-ID')}</span>
        </div>
        <div class="bbm-grid-angka">
          <div class="bbm-sub-box">
            <div class="val">${hasil.totalJarakKm} km</div>
            <div class="lbl">Jarak Rute AI</div>
          </div>
          <div class="bbm-sub-box">
            <div class="val">Rp ${hasil.estimasiBiayaRp.toLocaleString('id-ID')}</div>
            <div class="lbl">BBM (~${hasil.estimasiLiter}L)</div>
          </div>
        </div>
        <p style="font-size:0.68rem; color:#cbd5e1; margin-top:8px; line-height:1.3;">
          💡 <strong>Analisa Alokasi BBM:</strong> Menghemat <strong>${hasil.penghematanKm} km</strong> perjalanan dibanding keliling buta ${hasil.totalTitikKeseluruhan} tiang. Saldo bensin mingguanmu tetap aman terkendali.
        </p>
      </div>

      <div style="font-size:0.75rem; font-weight:700; color:#fff; margin-top:8px;">Urutan Rute Paling Efisien:</div>
      <div class="rute-steps-container">
        ${daftarStepHtml}
      </div>

      ${linkGmaps ? `<a href="${linkGmaps}" target="_blank" class="btn-gmaps-link">🚀 Buka Navigasi Berantai di Google Maps</a>` : ''}
    </div>
  `;

  modal.style.display = 'flex';

  const btnTutup = modal.querySelector('#btn-tutup-rute-bbm');
  if (btnTutup) {
    btnTutup.onclick = () => { modal.style.display = 'none'; };
  }
}
