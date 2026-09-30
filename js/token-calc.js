// js/token-calc.js - Bridge Penghubung ke Mesin AI Power Engine
import { analisaDayaDanEstimasi } from './plugins/power-engine.js';

export function hitungPrediksiHabis(riwayatToken, jumlahLampu = 0, jenisLampu = 'FL') {
  return analisaDayaDanEstimasi(riwayatToken, jumlahLampu, jenisLampu);
}
