# Mushaf Al-Qubba

Mushaf Al-Qur'an digital **30 juz, 604 halaman** yang bisa dibaca sepenuhnya
**tanpa sambungan internet**. Berisi teks Al-Qur'an, warna tajwid, dan
terjemahan per kata, dengan navigasi per juz serta pencarian halaman.

Repositori ini memuat aplikasi web statis (PWA) yang menjadi dasar dari
aplikasi Android (APK) dan proyek iOS.

## Fitur

- 30 juz, 604 halaman mushaf — seluruhnya berkas statis
- Bisa dipasang sebagai aplikasi (PWA) dan dibaca luring
- Warna tajwid & terjemahan per kata
- Catatan pribadi per halaman (`catatan.php`, butuh PHP + MySQL)
- Daftar halaman, pencarian, pembagian per juz
- Dukungan layar sentuh, splash screen, dan ikon aplikasi
- APK Android tersedia (lihat bagian Unduhan)

## Struktur

```
index.html            halaman depan
daftar-halaman.html   daftar 30 juz
bagikan.html          bagikan & unduh luring
pasang-ios.html       panduan pasang di iPhone/iPad
privasi.html          kebijakan privasi
halaman.html          tampilan pembaca
juz1/ … juz30/        halaman per juz (index.html + hal-XX.html)
juz1.html … juz30.html  versi gabungan per juz (dengan anchor per baris)
fonts/ img/ ikon/ splash/  aset
manifest.webmanifest  manifest PWA
sw.js                 service worker (cache luring)
daftar-berkas.json    daftar berkas untuk unduhan luring
catatan.php           API catatan pembaca (PHP + MySQL)
iklan.php, iklan-lib.php, admin-iklan.php  modul iklan (PHP)
```

## Menjalankan secara lokal

Aplikasi ini statis, cukup disajikan dengan web server apa pun:

```bash
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

Untuk fitur catatan/iklan, dibutuhkan PHP 8 + MySQL (lihat variabel di
`catatan.php` dan `iklan-lib.php`).

## Aplikasi Android

APK siap pasang dibangun dengan Capacitor dari isi repositori ini:

- Unduh: `/unduh/Mushaf-Al-Qubba-1.0.1.apk` pada situs aplikasi
- Versi 1.0.1 (versionCode 2), Android 5.1+, ±20 MB
- Seluruh 604 halaman dibundel di dalam APK (bisa luring penuh)

## Lisensi & sumber teks

Teks Al-Qur'an memakai riwayat Utsmani beserta terjemahan bahasa Indonesia.
Silakan gunakan dan sebarkan untuk kebaikan. Mohon jangan mengubah isi
mushaf.
