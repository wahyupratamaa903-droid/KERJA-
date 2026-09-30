// js/plugins/github-vault.js - Auto-Commit Brankas GitHub Tanpa Termux
// Plugin Mandiri: Tidak mengubah data sarana lokal / cloud

const GITHUB_CONFIG = {
  owner: "wahyupratamaa903-droid",
  repo: "KERJA-",
  branch: "main",
  path: "backup/data-sarana-live.json"
};

// Fungsi mengamankan data langsung ke repositori GitHub via REST API
export async function simpanKeGitHubOtomatis(daftarSarana, tokenGithub) {
  if (!daftarSarana || daftarSarana.length === 0) {
    throw new Error("Tidak ada data untuk dicadangkan.");
  }
  if (!tokenGithub || !tokenGithub.startsWith("ghp_")) {
    throw new Error("Token GitHub tidak valid.");
  }

  const urlApi = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
  
  // 1. Cek apakah file sudah ada sebelumnya untuk mengambil SHA (wajib di GitHub API)
  let fileSha = null;
  try {
    const resCek = await fetch(urlApi, {
      headers: {
        'Authorization': `Bearer ${tokenGithub}`,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (resCek.ok) {
      const dataFile = await resCek.json();
      fileSha = dataFile.sha;
    }
  } catch (e) {
    console.log("File baru akan dibuat di GitHub...");
  }

  // 2. Siapkan paket data bersih dan encode ke Base64 UTF-8
  const kontenJson = JSON.stringify(daftarSarana, null, 2);
  const bytes = new TextEncoder().encode(kontenJson);
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const base64Content = btoa(binString);

  const waktuUpdate = new Date().toLocaleString('id-ID');
  const bodyPayload = {
    message: `Auto-Backup Brankas Data Sarana (${waktuUpdate}) [skip ci]`,
    content: base64Content,
    branch: GITHUB_CONFIG.branch
  };
  if (fileSha) bodyPayload.sha = fileSha;

  // 3. Eksekusi Commit langsung dari Browser
  const respon = await fetch(urlApi, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${tokenGithub}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!respon.ok) {
    const errData = await respon.json();
    throw new Error(errData.message || `HTTP ${respon.status}`);
  }

  return await respon.json();
}
