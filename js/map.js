// js/map.js - OpenStreetMap Bebas API Key + Neon Radar Beacons
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

  // Menggunakan OpenStreetMap Resmi: 100% Terbuka, Gratis Selamanya, TANPA API Key
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc'
  }).addTo(map);

  markerGroup = L.layerGroup().addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

function buatIconHolografik(status) {
  let warna = '#10b981'; // Aman
  let animasi = 'pulseAman';

  if (status === 'kritis') {
    warna = '#ef4444'; // Kritis
    animasi = 'pulseKritis';
  } else if (status === 'waspada') {
    warna = '#f59e0b'; // Waspada
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
      const info = fnHitungPrediksi(s.riwayatToken, s.jumlahLampu, s.jenisLampu);
      const icon = buatIconHolografik(info.status);
      const pos = [s.koordinat.lat, s.koordinat.lng];

      bounds.push(pos);

      const kwhTampil = info.terakhir ? `${info.terakhir.kwh.toLocaleString('id-ID')} kWh` : '-';
      const estTampil = info.estimasiHari !== undefined ? `±${info.estimasiHari} hari (${info.tanggalHabis})` : '-';

      const kontenPopup = `
        <div class="dark-holo-popup">
          <div class="popup-tag ${info.status}">${s.tipe} • ${info.status.toUpperCase()}</div>
          <h4 class="popup-title">${s.lokasi}</h4>
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
            <span style="color:#60a5fa;">±${info.wattTerdeteksi || 0} Watt</span>
          </div>
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
      html: `
        <div class="user-gps-pulse">
          <div class="user-gps-core"></div>
        </div>
      `,
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
