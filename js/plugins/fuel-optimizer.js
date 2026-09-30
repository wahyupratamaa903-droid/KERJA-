// js/plugins/fuel-optimizer.js - AI Smart Fuel-Route Optimizer
// Khusus operasional motor Honda Beat 110cc & plafon BBM Rp 50.000

const HARGA_PERTALITE_PER_LITER = 10000;
const KM_PER_LITER_BEAT = 50; // Konsumsi rata-rata Honda Beat 110cc

// Rumus Haversine untuk menghitung jarak presisi dua titik koordinat bumi (km)
function hitungJarakHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam km
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

  // Posisi acuan (jika GPS HP mati, gunakan patokan pusat Kota Bengkulu)
  const posAwal = (posisiUser && posisiUser.lat) ? posisiUser : { lat: -3.8000, lng: 102.2650 };

  // 1. Filter sarana yang memiliki koordinat valid
  const saranaDenganGps = daftarSarana.filter(s => s.koordinat && s.koordinat.lat && s.koordinat.lng);
  if (saranaDenganGps.length === 0) {
    return { error: "Tidak ada sarana dengan koordinat GPS valid." };
  }

  // 2. Seleksi Prioritas: Utamakan Kritis, Waspada, atau yang paling lama tidak dicek
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

  // Jika sarana kritis sedikit (< 4), tambahkan titik terdekat yang aman untuk patroli rutin harian
  let antrianKunjungan = [...targetPrioritas];
  if (antrianKunjungan.length < 4) {
    targetAman.sort((a, b) => b.selisihHariCek - a.selisihHariCek);
    const tambahan = targetAman.slice(0, 4 - antrianKunjungan.length);
    antrianKunjungan.push(...tambahan);
  }

  // 3. Algoritma Nearest Neighbor (Sirkuit Terpendek Berantai)
  const ruteUrutan = [];
  let titikSekarang = posAwal;
  let kumpulanKandidat = [...antrianKunjungan];
  let totalJarakKm = 0;

  while (kumpulanKandidat.length > 0) {
    let jarakTerdekat = Infinity;
    let indeksTerdekat = -1;

    for (let i = 0; i < kumpulanKandidat.length; i++) {
      const kandidat = kumpulanKandidat[i];
      const jarak = hitungJarakHaversine(
        titikSekarang.lat, titikSekarang.lng,
        kandidat.koordinat.lat, kandidat.koordinat.lng
      );
      if (jarak < jarakTerdekat) {
        jarakTerdekat = jarak;
        indeksTerdekat = i;
      }
    }

    if (indeksTerdekat !== -1) {
      const titikTerpilih = kumpulanKandidat.splice(indeksTerdekat, 1)[0];
      totalJarakKm += jarakTerdekat;
      ruteUrutan.push({
        ...titikTerpilih,
        jarakDariTitikSebelumnya: Number(jarakTerdekat.toFixed(2))
      });
      titikSekarang = titikTerpilih.koordinat;
    }
  }

  // 4. Kalkulasi Beban & Penghematan BBM (Honda Beat 110cc)
  const estimasiLiter = Number((totalJarakKm / KM_PER_LITER_BEAT).toFixed(2));
  const estimasiBiayaRp = Math.round(estimasiLiter * HARGA_PERTALITE_PER_LITER);
  const jarakPenuhJikaKelilingSemua = 25.0; // km keliling seluruh 18 sarana
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

// Buat tautan multi-stop Google Maps resmi
export function buatTautanGoogleMaps(ruteUrutan, posAwal) {
  if (!ruteUrutan || ruteUrutan.length === 0) return null;
  const origin = `${posAwal.lat},${posAwal.lng}`;
  const destination = `${ruteUrutan[ruteUrutan.length - 1].koordinat.lat},${ruteUrutan[ruteUrutan.length - 1].koordinat.lng}`;
  
  // Ambil titik perantara (maksimal 8 titik perantara untuk URL Google Maps)
  const waypoints = ruteUrutan.slice(0, -1).map(r => `${r.koordinat.lat},${r.koordinat.lng}`).join('|');
  
  if (waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=motorcycle`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=motorcycle`;
}
