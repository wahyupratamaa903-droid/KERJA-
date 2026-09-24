// js/map.js - Peta Satelit Interaktif Lapangan GIS Kota Bengkulu (Clean OSM Tile)

let map = null;
let markerLayer = null;
let userMarker = null;

function buatIconPin(warna) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="38">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="${warna}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-map-pin',
    html: svg,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -36]
  });
}

const iconMerah = buatIconPin('#ef4444');  // Kritis / Perlu Diisi
const iconKuning = buatIconPin('#f59e0b'); // Waspada
const iconHijau = buatIconPin('#10b981');  // Aman
const iconBiruUser = L.divIcon({
  className: 'user-radar-pin',
  html: `<div class="radar-dot"><div class="radar-pulse"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

export function inisialisasiPeta(containerId = 'peta-gis') {
  if (map) return map;

  map = L.map(containerId, {
    zoomControl: false
  }).setView([-3.7928, 102.2608], 13);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Basemap resmi OpenStreetMap - Bersih, Akurat, Tanpa Watermark API Key
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  return map;
}

export function perbaruiPinPeta(daftarSarana, fungsiHitung) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();

  const batasPeta = [];

  daftarSarana.forEach((item) => {
    if (!item.koordinat || !item.koordinat.lat) return;

    const lat = Number(item.koordinat.lat);
    const lng = Number(item.koordinat.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    batasPeta.push([lat, lng]);
    const info = fungsiHitung(item.riwayatToken);

    let iconDipakai = iconHijau;
    let labelStatus = 'AMAN';
    let warnaBadge = '#10b981';

    if (info.status === 'kritis') {
      iconDipakai = iconMerah;
      labelStatus = 'PERLU DIISI';
      warnaBadge = '#ef4444';
    } else if (info.status === 'waspada') {
      iconDipakai = iconKuning;
      labelStatus = 'WASPADA';
      warnaBadge = '#f59e0b';
    }

    const popupHtml = `
      <div style="font-family:sans-serif; min-width:180px; padding:2px;">
        <span style="background:${warnaBadge}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
          ${labelStatus}
        </span>
        <h4 style="margin:6px 0 2px 0; font-size:13px; color:#111;">${item.lokasi}</h4>
        <div style="font-size:11px; color:#555; margin-bottom:6px;">
          ${item.tipe} • Sisa: <strong>${info.terakhir.kwh.toLocaleString('id-ID')} kWh</strong><br>
          Estimasi: <strong>± ${info.estimasiHari || 0} Hari Lagi</strong>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" 
           style="display:block; text-align:center; background:#2563eb; color:#fff; font-size:11px; font-weight:600; padding:6px; border-radius:6px; text-decoration:none;">
           Buka Rute Navigasi
        </a>
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: iconDipakai }).bindPopup(popupHtml);
    markerLayer.addLayer(marker);
  });

  if (batasPeta.length > 0) {
    map.fitBounds(batasPeta, { padding: [30, 30] });
  }
}

export function perbaruiLokasiUserDiPeta(lat, lng) {
  if (!map) return;
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], { icon: iconBiruUser }).addTo(map);
    userMarker.bindTooltip("Posisi Anda Saat Ini", { permanent: false, direction: 'top' });
  }
}

export function perbaikiUkuranPeta() {
  if (map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }
}
