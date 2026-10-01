// js/map.js - OpenStreetMap Bebas API Key + Radar Beacons (Mendukung Titik Non-Lampu)
let map = null;
let markerGroup = null;
let userMarker = null;

export function inisialisasiPeta() {
  if (map) return;

  const bengkuluCoord = [-3.8000, 102.2650];
  map = L.map('peta-gis', {
    zoomControl: true,
    attributionControl: false
  }).setView(bengkuluCoord, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc'
  }).addTo(map);

  markerGroup = L.layerGroup().addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

function buatIconHolografik(status, isNonLampu) {
  let warna = '#10b981'; // Aman (Hijau)
  let animasi = 'pulseAman';

  if (isNonLampu) {
    warna = '#06b6d4'; // Non-Lampu (Cyan)
    animasi = 'pulseAman';
  } else if (status === 'kritis') {
    warna = '#ef4444'; // Kritis (Merah)
    animasi = 'pulseKritis';
  } else if (status === 'waspada') {
    warna = '#f59e0b'; // Waspada (Kuning)
    animasi = 'pulseWaspada';
  }

  const htmlIcon = `
    <div class="radar-beacon-pin ${animasi}">
      <div class="beacon-core" style="background: ${warna}; box-shadow: 0 0 14px ${warna};"></div>
      <div class="beacon-ring" style="border-color: ${warna};"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-hologram-marker',
    html: htmlIcon,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

export function perbaruiPinPeta(daftarSarana, fnHitungPrediksi) {
  if (!map || !markerGroup) return;
  markerGroup.clearLayers();

  const bounds = [];

  daftarSarana.forEach((s) => {
    if (s.koordinat && s.koordinat.lat && s.koordinat.lng) {
      const isNonLampu = (s.jenisLampu === 'NONE' || s.isBerlampu === false || s.statusPenerangan === 'tanpa-lampu');
      let status = 'aman';
      let kwhTampil = '-';
      let estTampil = 'Sarana Tanpa Lampu Listrik';
      let wattTampil = '0 Watt';

      if (!isNonLampu) {
        const info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
        status = info.status;
        kwhTampil = info.terakhir ? `${info.terakhir.kwh.toLocaleString('id-ID')} kWh` : '-';
        estTampil = info.estimasiHari !== undefined ? `±${info.estimasiHari} hari (${info.tanggalHabis})` : '-';
        wattTampil = `±${info.wattTerdeteksi || 0} Watt`;
      }

      const icon = buatIconHolografik(status, isNonLampu);
      const pos = [s.koordinat.lat, s.koordinat.lng];
      bounds.push(pos);

      const labelBadge = isNonLampu ? 'NON-LAMPU' : status.toUpperCase();
      const badgeClass = isNonLampu ? 'aman' : status;

      const kontenPopup = `
        <div class="dark-holo-popup">
          <div class="popup-tag ${badgeClass}" style="${isNonLampu ? 'background:rgba(6,182,212,0.2); color:#06b6d4; border-color:#06b6d4;' : ''}">
            ${s.tipe} • ${labelBadge}
          </div>
          <h4 class="popup-title">${s.lokasi}</h4>
          ${!isNonLampu ? `
            <div class="popup-row">
              <span>Sisa Token:</span>
              <strong>${kwhTampil}</strong>
            </div>
            <div class="popup-row">
              <span>Habis:</span>
              <span style="color:#fcd34d;">${estTampil}</span>
            </div>
            <div class="popup-row">
              <span>Beban Daya:</span>
              <span style="color:#60a5fa;">${wattTampil}</span>
            </div>
          ` : `
            <div style="font-size:0.72rem; color:#94a3b8; margin:6px 0;">
              Sarana visual fisik aktif (tidak memerlukan pengisian token PLN).
            </div>
          `}
          <a href="https://www.google.com/maps/dir/?api=1&destination=${s.koordinat.lat},${s.koordinat.lng}" target="_blank" class="popup-btn-nav">
            Navigasi Google Maps ➔
          </a>
        </div>
      `;

      const marker = L.marker(pos, { icon }).bindPopup(kontenPopup);
      markerGroup.addLayer(marker);
    }
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }
}

export function perbaruiLokasiUserDiPeta(lat, lng) {
  if (!map) return;
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    const iconMotor = L.divIcon({
      className: 'marker-posisi-user',
      html: `<div class="user-gps-pulse"><div class="user-gps-core"></div></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    userMarker = L.marker([lat, lng], { icon: iconMotor }).addTo(map);
  }
}

export function perbaikiUkuranPeta() {
  if (map) {
    setTimeout(() => { map.invalidateSize(); }, 200);
  }
}
