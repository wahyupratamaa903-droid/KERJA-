// js/patrol-route.js - Perhitungan jarak GPS Haversine & pengurutan rute patroli

export function hitungJarakKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function urutkanRuteTerdekat(daftarSarana, posisiUser) {
  if (!posisiUser || !posisiUser.lat) return daftarSarana;

  return [...daftarSarana].sort((a, b) => {
    const adaA = a.koordinat && a.koordinat.lat;
    const adaB = b.koordinat && b.koordinat.lat;

    if (!adaA && !adaB) return 0;
    if (!adaA) return 1;
    if (!adaB) return -1;

    const jarakA = hitungJarakKm(posisiUser.lat, posisiUser.lng, a.koordinat.lat, a.koordinat.lng);
    const jarakB = hitungJarakKm(posisiUser.lat, posisiUser.lng, b.koordinat.lat, b.koordinat.lng);
    return jarakA - jarakB;
  });
}
