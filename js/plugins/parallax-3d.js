// js/plugins/parallax-3d.js - Cyberpunk 3D Parallax & Gyroscope Tilt Engine
// Plugin Mandiri: Memproses visual 3D tanpa memodifikasi data atau fungsi inti

let gyroAktif = false;
let sudutX = 0; // Pitch (atas/bawah)
let sudutY = 0; // Roll (kiri/kanan)
let targetX = 0;
let targetY = 0;

// 1. Suntikkan CSS 3D Holografik ke Halaman secara Mandiri
function pasangGaya3DHolografik() {
  const idStyle = 'style-cyberpunk-3d';
  if (document.getElementById(idStyle)) return;

  const styleEl = document.createElement('style');
  styleEl.id = idStyle;
  styleEl.textContent = `
    /* PERSPEKTIF KONTAINER UTAMA */
    #daftar-sarana {
      perspective: 1200px;
      perspective-origin: center center;
    }

    /* KARTU 3D MULTI-LAYER */
    .kartu-sarana {
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
      will-change: transform;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(145deg, rgba(26, 35, 54, 0.95), rgba(15, 23, 42, 0.98)) !important;
      backdrop-filter: blur(16px);
      border-radius: 12px;
    }

    /* LAPISAN KILAU KACA DINAMIS (SPECULAR GLARE) */
    .kartu-glare-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
      border-radius: inherit;
      background: radial-gradient(circle 280px at 50% 50%, rgba(255, 255, 255, 0.12), transparent 80%);
      opacity: 0;
      transition: opacity 0.3s ease;
      mix-blend-mode: overlay;
    }

    /* KEDALAMAN ELEMEN DALAM KARTU (Z-DEPTH POP OUT) */
    .kartu-sarana .kartu-header {
      transform: translateZ(24px);
      transform-style: preserve-3d;
    }
    .kartu-sarana .baris-riwayat,
    .kartu-sarana .grid-ringkasan {
      transform: translateZ(16px);
      transform-style: preserve-3d;
    }
    .kartu-sarana .kartu-footer,
    .kartu-sarana .btn-rute-maps {
      transform: translateZ(28px);
      transform-style: preserve-3d;
    }

    /* AMBIENT GLOW STATUS NEON */
    .kartu-sarana.status-kritis {
      border-color: rgba(239, 68, 68, 0.45) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.25) !important;
      animation: neonPulseKritis 2.4s infinite alternate ease-in-out;
    }
    .kartu-sarana.status-waspada {
      border-color: rgba(245, 158, 11, 0.4) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 14px rgba(245, 158, 11, 0.2) !important;
    }
    .kartu-sarana.status-aman {
      border-color: rgba(16, 185, 129, 0.25) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(16, 185, 129, 0.12) !important;
    }

    @keyframes neonPulseKritis {
      0% { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 10px rgba(239, 68, 68, 0.2); }
      100% { box-shadow: 0 6px 26px rgba(0, 0, 0, 0.6), 0 0 22px rgba(239, 68, 68, 0.45); }
    }
  `;
  document.head.appendChild(styleEl);
}

// 2. Hubungkan Efek Sentuhan Jari Langsung ke Kartu
function pasangInteraksiKartu(kartu) {
  if (kartu.dataset.parallaxTerpasang === 'true') return;
  kartu.dataset.parallaxTerpasang = 'true';

  let glare = kartu.querySelector('.kartu-glare-overlay');
  if (!glare) {
    glare = document.createElement('div');
    glare.className = 'kartu-glare-overlay';
    kartu.appendChild(glare);
  }

  // Interaksi Sentuh Layar di HP (Touch)
  kartu.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = kartu.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const rotX = ((y / rect.height) - 0.5) * -16;
    const rotY = ((x / rect.width) - 0.5) * 16;

    kartu.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
    glare.style.opacity = '1';
    glare.style.background = `radial-gradient(circle 260px at ${x}px ${y}px, rgba(255, 255, 255, 0.16), transparent 80%)`;
  }, { passive: true });

  kartu.addEventListener('touchend', () => {
    setTimeout(() => {
      kartu.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      glare.style.opacity = '0';
    }, 250);
  });
}

// 3. Sensor Gerak HP (Gyroscope DeviceOrientation)
function inisialisasiSensorGyro() {
  if (!window.DeviceOrientationEvent) return;

  const tanganiGerak = (e) => {
    if (e.beta === null || e.gamma === null) return;
    gyroAktif = true;

    // Batasi sudut kemiringan alami tangan (maks ±14 derajat agar mata tetap nyaman membaca)
    targetX = Math.max(-14, Math.min(14, (e.beta - 45) * 0.4)); // Kemiringan pegang HP standar ~45 deg
    targetY = Math.max(-14, Math.min(14, e.gamma * 0.4));
  };

  window.addEventListener('deviceorientation', tanganiGerak, true);

  // Animasi Halus (Smooth Interpolation 60 FPS)
  function renderLoop() {
    if (gyroAktif) {
      sudutX += (targetX - sudutX) * 0.1;
      sudutY += (targetY - sudutY) * 0.1;

      const semuaKartu = document.querySelectorAll('.kartu-sarana');
      semuaKartu.forEach((k) => {
        k.style.transform = `rotateX(${(-sudutX).toFixed(2)}deg) rotateY(${sudutY.toFixed(2)}deg)`;
      });
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
}

// 4. Pengamat Otomatis (MutationObserver) - Mengaktifkan 3D Setiap Kali Data Berganti
export function inisialisasiParallax3D() {
  pasangGaya3DHolografik();
  inisialisasiSensorGyro();

  const containerDaftar = document.getElementById('daftar-sarana');
  if (!containerDaftar) return;

  // Pasang ke kartu yang sudah ada saat ini
  containerDaftar.querySelectorAll('.kartu-sarana').forEach(pasangInteraksiKartu);

  // Pantau jika ada kartu baru yang dirender/difilter
  const observer = new MutationObserver(() => {
    containerDaftar.querySelectorAll('.kartu-sarana').forEach(pasangInteraksiKartu);
  });

  observer.observe(containerDaftar, { childList: true });
}

// Otomatis aktif saat file dimuat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inisialisasiParallax3D);
} else {
  inisialisasiParallax3D();
}
