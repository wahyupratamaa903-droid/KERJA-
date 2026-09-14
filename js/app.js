import { hitungKetahananToken } from './token-calc.js';

const form = document.getElementById('form-sarana');
const containerDaftar = document.getElementById('daftar-sarana');

// Simpan data sementara di localStorage HP
let dataSarana = JSON.parse(localStorage.getItem('sarana-kerja') || '[]');

function renderData() {
  containerDaftar.innerHTML = '';
  if (dataSarana.length === 0) {
    containerDaftar.innerHTML = '<p class="kosong">Belum ada data sarana yang dicatat.</p>';
    return;
  }

  dataSarana.forEach((item, index) => {
    const kartu = document.createElement('div');
    kartu.className = `kartu-sarana ${item.hasilToken.status}`;

    kartu.innerHTML = `
      <div class="header-kartu">
        <h3>${item.lokasi}</h3>
        <span class="badge ${item.hasilToken.status}">
          ${item.hasilToken.butuhIsi ? 'PERLU DIISI' : 'AMAN'}
        </span>
      </div>
      <p><strong>Tipe:</strong> ${item.tipe}</p>
      <p><strong>Lampu:</strong> ${item.jumlahLampu} titik (@${item.wattPerLampu}W)</p>
      <p><strong>Sisa Token:</strong> ${item.sisaKwh} kWh (~${item.hasilToken.estimasiHari} hari lagi)</p>
      ${item.foto ? `<img src="${item.foto}" class="pratinjau-foto" alt="Foto sarana">` : ''}
      <button class="btn-hapus" data-index="${index}">Hapus</button>
    `;

    containerDaftar.appendChild(kartu);
  });

  document.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      dataSarana.splice(idx, 1);
      localStorage.setItem('sarana-kerja', JSON.stringify(dataSarana));
      renderData();
    });
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const lokasi = document.getElementById('lokasi').value;
  const tipe = document.getElementById('tipe').value;
  const jumlahLampu = Number(document.getElementById('jumlahLampu').value);
  const wattPerLampu = Number(document.getElementById('wattPerLampu').value);
  const sisaKwh = Number(document.getElementById('sisaKwh').value);
  const inputFoto = document.getElementById('fotoSarana');

  const prosesSimpan = (fotoBase64 = '') => {
    const hasilToken = hitungKetahananToken(jumlahLampu, wattPerLampu, sisaKwh);
    dataSarana.push({ lokasi, tipe, jumlahLampu, wattPerLampu, sisaKwh, foto: fotoBase64, hasilToken });
    localStorage.setItem('sarana-kerja', JSON.stringify(dataSarana));
    form.reset();
    renderData();
  };

  if (inputFoto.files && inputFoto.files[0]) {
    const reader = new FileReader();
    reader.onload = (event) => prosesSimpan(event.target.result);
    reader.readAsDataURL(inputFoto.files[0]);
  } else {
    prosesSimpan('');
  }
});

renderData();
