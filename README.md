# KORSA 2026 — Scoring Bulu Tangkis

Aplikasi scoring empat lapangan dengan controller operator, admin jadwal,
klasemen, dan display/videotron. Pertandingan dapat memakai pasangan lapangan
1+2, 3+4, atau 2+4 sesuai jadwal.

## Menjalankan lokal

Persyaratan: Node.js 22.13 atau lebih baru.

1. Jalankan `npm ci`.
2. Salin `.env.example` menjadi `.env` dan isi admin serta empat operator.
3. Buat hash password dengan `npm run hash`.
4. Jalankan `npm run check:env` lalu `npm run dev`.
5. Buka `http://localhost:8888`.

Data lokal menggunakan memory fallback bila Netlify Blobs belum dikonfigurasi,
sehingga akan hilang saat server lokal dimulai ulang. Pada Netlify, kegagalan
Blobs dibuat fail-closed agar skor tidak tersimpan palsu di memory.

## Pemeriksaan sebelum deploy

Jalankan:

```text
npm ci
npm run check
npm run check:env
npm audit --omit=dev --audit-level=high
```

`npm run check` memeriksa syntax seluruh JavaScript, referensi aset HTML, dan
test otomatis. Build Netlify menjalankan pemeriksaan project dan environment
yang sama sebelum publish.

## Deploy Netlify

1. Hubungkan folder ini ke site yang benar dengan `netlify link`.
2. Masukkan seluruh variabel dari `.env.example` melalui Netlify Environment
   Variables. Jangan commit file `.env`.
3. Pastikan variabel tersedia untuk scope Builds dan Functions.
4. Jalankan `npm run deploy`.
5. Setelah deploy, cek `/display.html`, `/admin.html`, empat login operator,
   simpan satu kategori uji, refresh halaman, lalu pastikan skor tetap ada.

Jangan memakai data pertandingan produksi untuk smoke test. Lakukan smoke test
sebelum hari pertandingan atau pada site preview terpisah.
