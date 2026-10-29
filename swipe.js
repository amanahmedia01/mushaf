/* Mushaf Al-Qubba — gestur geser (swipe) untuk berpindah halaman.
 *
 *   geser ke KIRI  atau ke ATAS   -> halaman BERIKUTNYA
 *   geser ke KANAN atau ke BAWAH  -> halaman SEBELUMNYA
 *
 * Berkas ini dipanggil dari setiap halaman mushaf (juzN/hal-XX.html) dengan:
 *   <script src="../swipe.js"></script>
 *
 * Catatan perilaku:
 *  - Saat halaman sedang diperbesar (zoom), geseran dipakai untuk menggeser isi.
 *    Halaman baru berpindah bila isi sudah mentok di ujung arah geseran.
 *  - Dua jari (cubit) dan ketuk-dua-kali bawaan halaman tidak diganggu.
 *  - Tombol panah kibor juga memindah halaman (bisa dimatikan di bawah).
 */
(function () {
  'use strict';

  /* ---------- pengaturan ---------- */
  var LANJUT_ANTAR_JUZ = true;    // geser di ujung juz lanjut ke juz sebelah
  var TAMPILKAN_PETUNJUK = true;  // tampilkan petunjuk geser sekali saja
  var PAKAI_TOMBOL_PANAH = true;  // tombol panah kibor turut memindah halaman
  var KUNCI_PETUNJUK = 'mushaf-geser-v1';

  /* ---------- elemen ---------- */
  var lembar = document.getElementById('lembar');
  if (!lembar) { return; }
  var menu = document.getElementById('menu');

  var JUZ_AKHIR = 30;
  var AMBANG_MIN = 48;            // jarak minimum (px)
  var AMBANG_MENDATAR = 1.15;     // dianggap mendatar bila lebar >= 1,15x tinggi
  var AMBANG_TEGAK = 1.5;         // dianggap tegak bila tinggi >= 1,5x lebar
  var WAKTU_MAKS = 1500;          // ms
  // Geseran mendatar: kiri = halaman sesudahnya, kanan = halaman sebelumnya.
  // Bila di perangkat tertentu terasa terbalik, cukup ubah baris ini menjadi true.
  var BALIK_ARAH_MENDATAR = false;

  /* ---------- informasi halaman ---------- */
  // nomor  = urutan halaman di dalam juz (dipakai untuk menyusun nama berkas hal-XX.html)
  // halaman = nomor halaman mushaf 1-604 (dipakai untuk tampilan)
  function bacaInfo() {
    var info = { juz: 0, nomor: 0, dari: 0, halaman: 0 };
    if (menu) {
      var judul = menu.querySelector('.menu-judul');
      if (judul) {
        var m = /Halaman\s+(\d+)\s*[·.]\s*Juz\s+(\d+)\s*[·.]\s*(\d+)\s+dari\s+(\d+)/.exec(judul.textContent || '');
        if (m) { info.halaman = +m[1]; info.juz = +m[2]; info.nomor = +m[3]; info.dari = +m[4]; }
      }
    }
    if (!info.juz || !info.nomor) {
      var u = /\/juz(\d+)\/hal-(\d+)\.html/.exec(location.pathname);
      if (u) { info.juz = +u[1]; info.nomor = +u[2]; }
    }
    if (!info.dari) { info.dari = jumlahHalamanJuz(info.juz); }
    if (!info.halaman && info.juz && info.nomor) { info.halaman = nomorMushaf(info.juz, info.nomor); }
    return info;
  }

  function jumlahHalamanJuz(j) {
    if (j === 1) { return 21; }
    if (j === JUZ_AKHIR) { return 23; }
    return 20;
  }

  // Nomor halaman mushaf (1..604) untuk halaman ke-n pada juz ke-j.
  function nomorMushaf(j, n) {
    var awal = (j === 1) ? 1 : (20 * (j - 1) + 2);
    return awal + (n - 1);
  }

  function namaHalaman(n) {
    return 'hal-' + (n < 10 ? '0' + n : String(n)) + '.html';
  }

  var info = bacaInfo();

  /* ---------- tentukan halaman tujuan ---------- */
  // Tautan menu dipakai lebih dulu (sumber kebenaran bawaan halaman), tetapi hanya
  // bila bentuknya memang tautan halaman mushaf — supaya perubahan tata letak menu
  // di masa depan tidak membuat geseran melompat ke tautan yang salah.
  var POLA_HALAMAN = /(^|\/)((juz\d+\/)?hal-\d{2}\.html)$/;

  function tautanMenu(arah) {
    if (!menu) { return null; }
    var baris = menu.querySelector('.menu-baris');
    if (!baris || baris.children.length < 2) { return null; }
    var el = baris.children[arah === 'berikut' ? 1 : 0];
    if (!el || el.tagName !== 'A') { return null; }
    var href = el.getAttribute('href') || '';
    if (!POLA_HALAMAN.test(href)) { return null; }
    return href;
  }

  function tujuan(arah) {
    var langsung = tautanMenu(arah);
    if (langsung) { return { alamat: langsung, lintasJuz: false }; }

    if (!LANJUT_ANTAR_JUZ || !info.juz || !info.nomor) { return null; }

    if (arah === 'berikut') {
      if (info.nomor < info.dari) {
        return { alamat: namaHalaman(info.nomor + 1), lintasJuz: false };
      }
      if (info.juz >= JUZ_AKHIR) { return null; }
      var jb = info.juz + 1;
      return {
        alamat: '../juz' + jb + '/hal-01.html',
        lintasJuz: true,
        pesan: 'Juz ' + jb + ' \u00b7 Halaman ' + nomorMushaf(jb, 1)
      };
    }

    if (info.nomor > 1) {
      return { alamat: namaHalaman(info.nomor - 1), lintasJuz: false };
    }
    if (info.juz <= 1) { return null; }
    var jm = info.juz - 1;
    var terakhir = jumlahHalamanJuz(jm);
    return {
      alamat: '../juz' + jm + '/' + namaHalaman(terakhir),
      lintasJuz: true,
      pesan: 'Juz ' + jm + ' \u00b7 Halaman ' + nomorMushaf(jm, terakhir)
    };
  }

  function absolut(alamat) {
    try { return new URL(alamat, location.href).href; } catch (e) { return null; }
  }

  /* ---------- tata letak ringan dari skrip ini sendiri ---------- */
  // Akar aplikasi mushaf (folder tempat swipe.js berada) — dipakai untuk kursor
  // gambar tangan supaya tetap benar walau halaman dibuka dari /juzN/.
  var AKAR_MUSHAF = (function () {
    try {
      var s = document.currentScript;
      if (!s) {
        var semua = document.getElementsByTagName('script');
        s = semua[semua.length - 1];
      }
      return new URL('.', s.src).href;
    } catch (e) {
      return './';
    }
  })();
  // Gambar tangan transparan sebagai penunjuk tetikus; ujung jari (41,0) jadi titik klik.
  // Ukuran berkas 96 px (3x dari 32 px) sesuai permintaan agar kursor terlihat besar.
  var KURSOR_TANGAN = 'url("' + AKAR_MUSHAF + 'jari-kursor-96.png") 41 0, pointer';

  var gaya = document.createElement('style');
  gaya.textContent =
    // Kursor: seluruh penunjuk memakai gambar tangan. Kotak isian tetap memakai
    // kursor teks, dan mode pilih ayat tetap memakai crosshair.
    'html, body, body * { cursor: ' + KURSOR_TANGAN + ' !important; }' +
    'input, textarea, select, [contenteditable="true"] { cursor: text !important; }' +
    'body.mushaf-pilih-ayat #lembar, body.mushaf-pilih-ayat #lembar * { cursor: crosshair !important; }' +
    // Perbaikan kecil: bawaan halaman membiarkan .ruang menyusut (flex-shrink) sehingga
    // isi yang sudah diperbesar tidak bisa digeser ke samping (hanya bisa ke atas/bawah).
    // Dengan flex:0 0 auto, geseran isi ke samping ikut berfungsi seperti seharusnya.
    '#ruang { flex: 0 0 auto; }' +
    // Bilah status: di bawah baris status layar (aman dari poni/notch), selalu terlihat.
    '.mushaf-bilah { flex: 0 0 auto; display: flex; align-items: center; justify-content: center;' +
    ' gap: 9px; padding: calc(env(safe-area-inset-top, 0px) + 8px) 64px 8px;' +
    ' background: #14503f; color: #fff; font-family: Arial, Tahoma, sans-serif;' +
    ' font-size: 13.5px; font-weight: 700; line-height: 1; letter-spacing: .2px;' +
    ' box-shadow: 0 2px 8px rgba(20,40,30,.22); position: relative; z-index: 41; }' +
    '.mushaf-bilah .bilah-juz { font-weight: 600; opacity: .9; }' +
    '.mushaf-bilah .bilah-pisah { opacity: .55; font-weight: 400; }' +
    '.mushaf-bilah .bilah-hal { font-weight: 700; }' +
    // Kaca pembesar: lensa bulat berbingkai emas dengan glow; isinya salinan halaman.
    '.mushaf-lensa { position: fixed; width: 220px; height: 220px; border-radius: 50%; pointer-events: none;' +
    ' top: 0; left: 0; transform: translate(-50%, -50%); display: none; z-index: 9999; overflow: hidden;' +
    ' background:' +
    ' radial-gradient(circle at 30% 30%, rgba(255,255,255,.10) 3px, transparent 4px),' +
    ' radial-gradient(circle at 70% 55%, rgba(255,255,255,.08) 5px, transparent 6px),' +
    ' radial-gradient(circle at 45% 75%, rgba(0,0,0,.15) 6px, transparent 7px),' +
    ' radial-gradient(circle at 65% 25%, rgba(0,0,0,.12) 4px, transparent 5px),' +
    ' radial-gradient(circle at 50% 50%, #2a2f38 0%, #1a1d23 70%, #0e1015 100%);' +
    ' box-shadow: 0 0 0 4px rgba(240,198,116,.9), 0 0 25px 8px rgba(240,198,116,.35),' +
    ' inset 0 0 40px rgba(0,0,0,.55); }' +
    '.mushaf-lensa.aktif { display: block; }' +
    '.mushaf-lensa .mushaf-lensa-isi { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; }' +
    // salinan halaman: overflow hidden tetap bisa digeser lewat scrollTop/Left, tanpa scrollbar
    '.mushaf-lensa .mushaf-klon { overflow: hidden !important; scrollbar-width: none; }' +
    '.mushaf-lensa .mushaf-klon::-webkit-scrollbar { display: none; }' +
    '.mushaf-hint-pembesar { position: fixed; left: 50%; transform: translateX(-50%);' +
    ' bottom: calc(118px + env(safe-area-inset-bottom)); z-index: 45; max-width: min(92vw, 460px);' +
    ' padding: 10px 16px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.45;' +
    ' color: #f0c674; background: rgba(14,16,21,.93); border: 1px solid rgba(240,198,116,.45);' +
    ' border-radius: 12px; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,.3);' +
    ' transition: opacity .3s; pointer-events: none; }' +
    '.mushaf-hint-pembesar.tersembunyi { opacity: 0; }' +
    // Tombol berbagi (di bawah tombol menu) + panel pilihannya
    '.tombol-bagikan { position: fixed; top: 64px; right: 10px; z-index: 38; width: 46px; height: 46px;' +
    ' display: grid; place-items: center; color: #fff; background: rgba(20,80,63,.9); border: 0;' +
    ' border-radius: 13px; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.28);' +
    ' -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }' +
    '.tombol-bagikan:active { background: #0d3b2e; }' +
    '.tombol-bagikan svg { width: 21px; height: 21px; }' +
    '.mushaf-bagikan-latar { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60; display: none; }' +
    '.mushaf-bagikan-latar.aktif { display: block; }' +
    '.mushaf-bagikan { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%);' +
    ' width: min(460px, 100%); background: #fff; border-radius: 18px 18px 0 0;' +
    ' padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); z-index: 61; display: none;' +
    ' box-shadow: 0 -8px 30px rgba(0,0,0,.25); font-family: Arial, sans-serif; }' +
    '.mushaf-bagikan.aktif { display: block; }' +
    '.bagikan-judul { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #14503f; text-align: center; }' +
    '.bagikan-rincian { margin: -6px 0 12px; font-size: 12px; color: #6b6152; text-align: center; }' +
    '.bagikan-kisi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }' +
    '.bagikan-tombol { display: flex; align-items: center; justify-content: center; height: 46px; padding: 0 6px;' +
    ' font: inherit; font-size: 12.5px; font-weight: 700; color: #14503f; background: #f3efe6;' +
    ' border: 1px solid #ded6c6; border-radius: 12px; text-decoration: none; cursor: pointer;' +
    ' white-space: nowrap; overflow: hidden; }' +
    '.bagikan-tombol:active { background: #e4ded0; }' +
    '.bagikan-tutup { width: 100%; margin-top: 10px; height: 44px; border: 0; border-radius: 12px;' +
    ' background: #14503f; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }' +
    // Catatanku: tombol mengambang, panel, dan gaya formulirnya
    '.tombol-catatan { position: fixed; top: 118px; right: 10px; z-index: 38; width: 46px; height: 46px;' +
    ' display: grid; place-items: center; color: #fff; background: rgba(20,80,63,.9); border: 0;' +
    ' border-radius: 13px; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.28);' +
    ' -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }' +
    '.tombol-catatan:active { background: #0d3b2e; }' +
    '.tombol-catatan svg { width: 21px; height: 21px; }' +
    '.mushaf-catatan-latar { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 62; display: none; }' +
    '.mushaf-catatan-latar.aktif { display: block; }' +
    '.mushaf-catatan { position: fixed; inset: 0; z-index: 63; display: none; overflow: auto;' +
    ' background: #f7f4ec; font-family: Arial, Tahoma, sans-serif; color: #23201a;' +
    ' padding: 14px 14px calc(20px + env(safe-area-inset-bottom)); -webkit-overflow-scrolling: touch; }' +
    '.mushaf-catatan.aktif { display: block; }' +
    '.catatan-kepala { display: flex; align-items: center; justify-content: space-between; gap: 10px; }' +
    '.catatan-kepala strong { font-size: 17px; color: #14503f; }' +
    '.catatan-tutup-x { width: 38px; height: 38px; flex: 0 0 auto; border: 1px solid #ded6c6; background: #fff;' +
    ' border-radius: 11px; font-size: 20px; line-height: 1; color: #14503f; cursor: pointer; }' +
    '.catatan-konteks { margin: 6px 0 12px; font-size: 12.5px; color: #6b6152; }' +
    '.catatan-jenis { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }' +
    '.catatan-chip { display: inline-flex; align-items: center; justify-content: center; gap: 6px;' +
    ' min-height: 38px; padding: 0 12px; font: inherit; font-size: 13px; font-weight: 700;' +
    ' color: #14503f; background: #fff; border: 1px solid #ded6c6; border-radius: 999px; cursor: pointer; }' +
    '.catatan-chip.aktif { background: #14503f; color: #fff; border-color: #14503f; }' +
    '.catatan-ayat { margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }' +
    '.catatan-ayat-terpilih { font-size: 13px; font-weight: 700; color: #14503f; background: #e6f0eb;' +
    ' padding: 8px 12px; border-radius: 999px; }' +
    '.mushaf-catatan textarea, .mushaf-catatan input[type="text"] { width: 100%; font: inherit; font-size: 14px;' +
    ' color: #23201a; background: #fff; border: 1px solid #ded6c6; border-radius: 12px; padding: 10px 12px; }' +
    '.mushaf-catatan textarea { resize: vertical; min-height: 96px; line-height: 1.5; }' +
    '.catatan-baris-ganda { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }' +
    '.catatan-aksi { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0 6px; }' +
    '.catatan-tombol { min-height: 44px; padding: 0 14px; font: inherit; font-size: 13.5px; font-weight: 700;' +
    ' color: #14503f; background: #fff; border: 1px solid #ded6c6; border-radius: 12px; cursor: pointer; }' +
    '.catatan-tombol.utama { background: #14503f; color: #fff; border-color: #14503f; }' +
    '.catatan-daftar { margin-top: 14px; }' +
    '.catatan-sub { margin: 14px 0 7px; font-size: 12.5px; font-weight: 700; color: #6b6152; }' +
    '.catatan-kosong { margin: 0; font-size: 13px; color: #8a7f6d; }' +
    '.catatan-kartu { background: #fff; border: 1px solid #e0d9c9; border-radius: 12px; padding: 11px 12px; margin-bottom: 8px; }' +
    '.catatan-kartu-kepala { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }' +
    '.catatan-label { font-size: 11.5px; font-weight: 700; color: #14503f; background: #e6f0eb;' +
    ' padding: 3px 9px; border-radius: 999px; }' +
    '.catatan-waktu { font-size: 11.5px; color: #8a7f6d; }' +
    '.catatan-ayat-kecil { margin-top: 6px; font-size: 12px; color: #14503f; font-style: italic; }' +
    '.catatan-isi { margin-top: 6px; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }' +
    '.catatan-kartu-kaki { display: flex; align-items: center; gap: 7px; margin-top: 9px; flex-wrap: wrap; }' +
    '.catatan-status { font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 999px; }' +
    '.catatan-status.ok { color: #14503f; background: #e6f0eb; }' +
    '.catatan-status.tunggu { color: #8a5a00; background: #fdf0d5; }' +
    '.catatan-kaki { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }' +
    'body.mushaf-pilih-ayat #lembar { cursor: crosshair; outline: 3px dashed rgba(20,80,63,.5); outline-offset: -3px; }' +
    // Layar mendatar: isi dibagi dua kolom (kanan dulu, sesuai urutan mushaf) supaya
    // seluruh halaman tetap masuk layar tanpa diregangkan, tapi lebar terpakai penuh.
    '#zoom.mushaf-kolom table { break-inside: avoid; page-break-inside: avoid;' +
    ' -webkit-column-break-inside: avoid; }' +
    '.lembar.geser-keluar-x { transition: transform .18s ease-out, opacity .18s ease-out; opacity: .25; }' +
    '.lembar.geser-keluar-kiri { transform: translateX(-14%); }' +
    '.lembar.geser-keluar-kanan { transform: translateX(14%); }' +
    '.lembar.geser-keluar-atas { transform: translateY(-10%); }' +
    '.lembar.geser-keluar-bawah { transform: translateY(10%); }' +
    '.geser-pesan { position: fixed; left: 50%; transform: translateX(-50%);' +
    ' bottom: calc(74px + env(safe-area-inset-bottom)); z-index: 45; max-width: min(92vw, 460px);' +
    ' padding: 10px 16px; font-family: Arial, sans-serif; font-size: 13.5px; line-height: 1.45;' +
    ' color: #fff; background: rgba(20,80,63,.94); border-radius: 12px; text-align: center;' +
    ' box-shadow: 0 6px 20px rgba(0,0,0,.28); transition: opacity .3s; pointer-events: none; }' +
    '.geser-pesan.tersembunyi { opacity: 0; }';
  document.head.appendChild(gaya);

  function kurangiGerak() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- pesan singkat ---------- */
  var kotakPesan = null, jamPesan = null;
  function pesan(teks, lamaMs) {
    if (!kotakPesan) {
      kotakPesan = document.createElement('div');
      kotakPesan.className = 'geser-pesan tersembunyi';
      document.body.appendChild(kotakPesan);
    }
    kotakPesan.textContent = teks;
    kotakPesan.classList.remove('tersembunyi');
    if (jamPesan) { clearTimeout(jamPesan); }
    jamPesan = setTimeout(function () { kotakPesan.classList.add('tersembunyi'); }, lamaMs || 2600);
  }

  function petunjukSekali() {
    if (!TAMPILKAN_PETUNJUK) { return; }
    var sudah = null;
    try { sudah = localStorage.getItem(KUNCI_PETUNJUK); } catch (e) { sudah = null; }
    if (sudah) { return; }
    try { localStorage.setItem(KUNCI_PETUNJUK, '1'); } catch (e) { /* mode pribadi */ }
    setTimeout(function () {
      pesan('Geser ke kiri atau ke atas untuk halaman berikutnya, ke kanan atau ke bawah untuk halaman sebelumnya.', 6000);
    }, 1200);
  }

  /* ---------- pindah halaman ---------- */
  var sedangPindah = false;

  function bersihkanEfek() {
    lembar.className = lembar.className
      .replace(/\bgeser-keluar-(x|kiri|kanan|atas|bawah)\b/g, ' ')
      .replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    lembar.style.transform = '';
    lembar.style.opacity = '';
    lembar.style.transition = '';
  }

  function pindah(arah, sumbu) {
    if (sedangPindah) { return false; }
    var t = tujuan(arah);
    if (!t) {
      pesan(arah === 'berikut' ? 'Ini halaman terakhir.' : 'Ini halaman pertama.', 2000);
      return false;
    }
    sedangPindah = true;

    if (t.lintasJuz && t.pesan) { pesan(t.pesan, 2200); }

    if (kurangiGerak()) { location.href = t.alamat; return true; }

    var arahKelas = (sumbu === 'y')
      ? (arah === 'berikut' ? 'atas' : 'bawah')
      : (arah === 'berikut' ? 'kiri' : 'kanan');
    lembar.classList.add('geser-keluar-x', 'geser-keluar-' + arahKelas);

    setTimeout(function () { location.href = t.alamat; }, 180);
    return true;
  }

  /* ---------- jejak ringkas untuk penelusuran masalah ---------- */
  var jejak = [];
  function jejakCatat(teks) {
    if (jejak.length > 30) { jejak.shift(); }
    jejak.push(teks);
  }

  /* ---------- aturan ujung geseran (agar tidak bentrok dengan zoom/geser isi) ----------
   * Dipakai posisi geser SAAT GESERAN DIMULAI, bukan saat jari diangkat: sementara
   * jari bergerak, isi memang ikut bergeser, jadi posisi akhir bukan penentu.
   * Halaman mushaf memakai <html dir="rtl">, jadi pada wadah mendatar nilai scrollLeft
   * berjalan dari 0 (paling kanan) sampai -maxX (paling kiri). Posisi dinormalkan lebih
   * dulu supaya aturan ujung tetap benar untuk kedua arah tulisan. */
  function posisiMendatar(sl) {
    var maxX = lembar.scrollWidth - lembar.clientWidth;
    var rtl = (window.getComputedStyle(lembar).direction === 'rtl');
    return { max: maxX, pos: rtl ? (maxX + sl) : sl, rtl: rtl };   // pos: 0 = kiri, max = kanan
  }

  function bolehPindah(dx, dy, slAwal, stAwal) {
    var mX = posisiMendatar((typeof slAwal === 'number') ? slAwal : lembar.scrollLeft);
    var maxX = mX.max, posX = mX.pos;
    var maxY = lembar.scrollHeight - lembar.clientHeight;
    var st = (typeof stAwal === 'number') ? stAwal : lembar.scrollTop;
    jejakCatat('ujung: maxX=' + maxX + ' posX=' + Math.round(posX) + ' rtl=' + mX.rtl +
               ' maxY=' + maxY + ' st=' + Math.round(st));
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (maxX <= 4) { return true; }
      return (dx < 0) ? (posX >= maxX - 4) : (posX <= 4);
    }
    if (maxY <= 4) { return true; }
    return (dy < 0) ? (st >= maxY - 4) : (st <= 4);
  }

  function bukanKontrol(node) {
    for (var n = node; n && n.nodeType === 1 && n !== lembar; n = n.parentNode) {
      if (n.id === 'menu' || n.id === 'tombolMenu' || n.id === 'tombolDonasi') { return true; }
      if (n.className && String(n.className).indexOf('tombol-donasi') >= 0) { return true; }
      if (n.tagName === 'A' || n.tagName === 'BUTTON') { return true; }
    }
    return false;
  }

  function tafsirGeser(dx, dy, waktuMs, slAwal, stAwal) {
    jejakCatat('geser: dx=' + Math.round(dx) + ' dy=' + Math.round(dy) + ' dt=' + waktuMs);
    if (waktuMs > WAKTU_MAKS) { jejakCatat('tolak: terlalu lama'); return null; }
    var ax = Math.abs(dx), ay = Math.abs(dy);
    var ambang = Math.max(AMBANG_MIN, Math.min(window.innerWidth, window.innerHeight) * 0.10);
    if (Math.max(ax, ay) < ambang) { jejakCatat('tolak: kurang dari ' + Math.round(ambang) + 'px'); return null; }
    var arah, sumbu;
    if (ax >= ay * AMBANG_MENDATAR) {
      // sumbu mendatar dimenangkan lebih dulu supaya geseran agak miring pun
      // tetap terbaca sebagai kiri/kanan (tidak melompat ke atas/bawah)
      sumbu = 'x';
      var keKiri = (dx < 0);
      if (BALIK_ARAH_MENDATAR) { keKiri = !keKiri; }
      arah = keKiri ? 'berikut' : 'sebelum';
    } else if (ay >= ax * AMBANG_TEGAK) {
      sumbu = 'y';
      arah = (dy < 0) ? 'berikut' : 'sebelum';
    } else {
      jejakCatat('tolak: arah miring');
      return null;
    }
    if (!bolehPindah(dx, dy, slAwal, stAwal)) { jejakCatat('tolak: isi belum di ujung'); return null; }
    jejakCatat('terima: ' + arah);
    return { arah: arah, sumbu: sumbu };
  }

  /* ---------- kaca pembesar (efek magnifier) ---------- */
  // Menampilkan salinan halaman yang diperbesar di dalam lensa bulat berbingkai emas.
  //  - Komputer: lensa mengikuti tetikus.
  //  - Ponsel: tahan jari ± 0,48 detik lalu geser; lensa tampil di atas jari supaya
  //    tidak tertutup jari, dan pemindahan halaman dibatalkan selama menahan.
  var PEMBESAR_ZOOM = 2.2;
  // Ukuran lensa: di komputer/laptop 1,5x lebih besar (330 px) supaya lebih jelas,
  // di ponsel tetap 220 px agar tidak menutupi halaman.
  var PEMBESAR_UKURAN_PONSEL = 220;
  var PEMBESAR_UKURAN_LAPTOP = 330;

  function ukuranPembesarSekarang() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(pointer: fine)').matches) { return PEMBESAR_UKURAN_LAPTOP; }
        if (window.matchMedia('(hover: hover)').matches && window.innerWidth >= 768) {
          return PEMBESAR_UKURAN_LAPTOP;
        }
      } else if (window.innerWidth >= 768) {
        return PEMBESAR_UKURAN_LAPTOP;
      }
    } catch (e) { /* jatuh ke ukuran ponsel */ }
    return PEMBESAR_UKURAN_PONSEL;
  }

  var PEMBESAR_UKURAN = ukuranPembesarSekarang();
  var PEMBESAR_TAHAN_MS = 480;
  var KUNCI_PEMBESAR = 'mushaf-pembesar-v1';
  var KUNCI_HINT_PEMBESAR = 'mushaf-pembesar-hint-v1';

  var pembesarNyala = true;
  try { pembesarNyala = (localStorage.getItem(KUNCI_PEMBESAR) !== '0'); } catch (e) { /* mode pribadi */ }

  var lensa = null, klon = null, klonIsi = null, klonTransform = null;
  var tahanJam = null, lensaAktif = false, titikTerakhir = null;

  function siapkanLensa() {
    if (lensa) { return; }
    lensa = document.createElement('div');
    lensa.className = 'mushaf-lensa';
    lensa.innerHTML = '<div class="mushaf-lensa-isi"></div>';
    terapkanUkuranLensa();
    document.body.appendChild(lensa);
    window.addEventListener('resize', function () {
      klon = null;
      var baru = ukuranPembesarSekarang();
      if (baru !== PEMBESAR_UKURAN) { PEMBESAR_UKURAN = baru; terapkanUkuranLensa(); }
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { klon = null; }, 400);
    });
  }

  // Samakan ukuran elemen lensa dengan ukuran yang dipakai perhitungan di JS.
  function terapkanUkuranLensa() {
    if (!lensa) { return; }
    lensa.style.width = PEMBESAR_UKURAN + 'px';
    lensa.style.height = PEMBESAR_UKURAN + 'px';
  }

  function bangunKlon() {
    siapkanLensa();
    var isi = lensa.querySelector('.mushaf-lensa-isi');
    var w = lembar.clientWidth, h = lembar.clientHeight;   // pakai clientWidth/Height:
    if (!isi || !w || !h) { return; }                      // agar ruang isi salinan sama
    var k = lembar.cloneNode(true);                        // dengan aslinya (tanpa scrollbar)
    k.removeAttribute('id');
    var berId = k.querySelectorAll('[id]');
    for (var i = 0; i < berId.length; i++) { berId[i].removeAttribute('id'); }
    k.className = k.className + ' mushaf-klon';
    k.style.position = 'absolute';
    k.style.margin = '0';
    k.style.left = '0';
    k.style.top = '0';
    k.style.width = Math.round(w) + 'px';
    k.style.height = Math.round(h) + 'px';
    k.style.transformOrigin = '0 0';
    k.style.transform = 'scale(' + PEMBESAR_ZOOM + ')';
    k.style.pointerEvents = 'none';
    isi.innerHTML = '';
    isi.appendChild(k);
    klon = k;
    klonIsi = k.firstElementChild;          // salinan #ruang: titik acuan pemetaan
  }

  function tampilkanLensa(x, y, diAtasJari) {
    if (!pembesarNyala) { return; }
    var z = document.getElementById('zoom');
    var t = z ? getComputedStyle(z).transform : null;
    if (!klon || klonTransform !== t) { bangunKlon(); klonTransform = t; }
    if (!klon) { return; }
    klon.scrollTop = lembar.scrollTop;
    klon.scrollLeft = lembar.scrollLeft;

    var radius = PEMBESAR_UKURAN / 2;
    // Pemetaan diukur dari elemen isi (#ruang), bukan dari tepi wadah: dengan begitu
    // selisih tata letak (mis. scrollbar vertikal yang di halaman RTL berada di KIRI,
    // sedangkan di salinan tidak ada) tidak lagi menggeser hasil.
    var ruangAsli = document.getElementById('ruang');
    var px = x, py = y, kx = 0, ky = 0;
    if (ruangAsli && klonIsi) {
      var ra = ruangAsli.getBoundingClientRect();
      px = x - ra.left;
      py = y - ra.top;
      var ri = klonIsi.getBoundingClientRect();
      var rk = klon.getBoundingClientRect();
      kx = (ri.left - rk.left) / PEMBESAR_ZOOM;
      ky = (ri.top - rk.top) / PEMBESAR_ZOOM;
    } else {
      var rl0 = lembar.getBoundingClientRect();
      px = x - rl0.left;
      py = y - rl0.top;
    }
    // Geser salinan sehingga titik yang ditunjuk tepat berada di tengah lensa
    klon.style.left = Math.round(radius - (kx + px) * PEMBESAR_ZOOM) + 'px';
    klon.style.top = Math.round(radius - (ky + py) * PEMBESAR_ZOOM) + 'px';

    lensa.style.left = Math.round(x) + 'px';
    var ty = diAtasJari ? (y - PEMBESAR_UKURAN * 0.62) : y;
    ty = Math.max(radius + 6, Math.min(window.innerHeight - radius - 6, ty));
    lensa.style.top = Math.round(ty) + 'px';
    lensa.classList.add('aktif');
    lensaAktif = true;
    titikTerakhir = { x: x, y: y, naik: !!diAtasJari };
  }

  function sembunyikanLensa() {
    lensaAktif = false;
    if (lensa) { lensa.classList.remove('aktif'); }
  }

  function batalkanTahan() {
    if (tahanJam) { clearTimeout(tahanJam); tahanJam = null; }
  }

  function perbaruiTombolPembesar() {
    var t = menu ? menu.querySelector('#tombolPembesar') : null;
    if (t) {
      t.textContent = pembesarNyala ? '\uD83D\uDD0D Kaca pembesar: aktif' : '\uD83D\uDD0D Kaca pembesar: mati';
    }
  }

  function pasangMenuPembesar() {
    if (!menu || menu.querySelector('#tombolPembesar')) { return; }
    var baris = document.createElement('div');
    baris.className = 'menu-baris';
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'item lebar';
    tombol.id = 'tombolPembesar';
    tombol.addEventListener('click', function () {
      pembesarNyala = !pembesarNyala;
      try { localStorage.setItem(KUNCI_PEMBESAR, pembesarNyala ? '1' : '0'); } catch (e) { /* abaikan */ }
      if (!pembesarNyala) { sembunyikanLensa(); }
      perbaruiTombolPembesar();
    });
    baris.appendChild(tombol);
    menu.appendChild(baris);
    perbaruiTombolPembesar();
  }

  function petunjukPembesar() {
    if (!pembesarNyala) { return; }
    var sudah = null;
    try { sudah = localStorage.getItem(KUNCI_HINT_PEMBESAR); } catch (e) { sudah = null; }
    if (sudah) { return; }
    try { localStorage.setItem(KUNCI_HINT_PEMBESAR, '1'); } catch (e) { /* abaikan */ }
    setTimeout(function () {
      var kotak = document.createElement('div');
      kotak.className = 'mushaf-hint-pembesar tersembunyi';
      kotak.textContent = '\uD83D\uDD0D Gerakkan tetikus atau tahan jari untuk memperbesar';
      document.body.appendChild(kotak);
      setTimeout(function () { kotak.classList.remove('tersembunyi'); }, 30);
      setTimeout(function () { kotak.classList.add('tersembunyi'); }, 6500);
      setTimeout(function () { if (kotak.parentNode) { kotak.parentNode.removeChild(kotak); } }, 7100);
    }, 7600);
  }

  /* ---------- layar penuh (tanpa baris navigasi peramban) ---------- */
  // Dua jalur:
  //  1. Fullscreen API (laptop/tablet/Android) + opsi navigationUI:'hide' agar baris
  //     navigasi peramban ikut disembunyikan. iOS Safari tidak mendukung API ini.
  //  2. Mode terpasang (PWA/standalone) - jalur andal untuk HP, termasuk iPhone:
  //     tanpa baris navigasi dan tidak hilang saat pindah halaman.
  var KUNCI_PENUH = 'mushaf-penuh-v1';
  var KUNCI_HINT_PENUH = 'mushaf-penuh-hint-v1';
  // Bawaan: AKTIF. Tujuannya supaya tab, address bar, dan bookmark bar peramban
  // tersembunyi sejak interaksi pertama, tanpa perlu menekan tombol dulu.
  // Bila pengguna keluar sendiri (Esc), pilihan diubah menjadi nonaktif dan diingat.
  var penuhDiinginkan = true;
  try { penuhDiinginkan = (localStorage.getItem(KUNCI_PENUH) !== '0'); } catch (e) { /* abaikan */ }
  var promptPasang = null;
  var sentuhPenuhSudah = false;

  function elemenPenuh() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  function punyaApiPenuh() {
    var e = document.documentElement;
    return !!(e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen);
  }

  function masukPenuh() {
    var e = document.documentElement;
    try {
      var p;
      if (e.requestFullscreen) { p = e.requestFullscreen({ navigationUI: 'hide' }); }
      else if (e.webkitRequestFullscreen) { p = e.webkitRequestFullscreen(); }
      else if (e.msRequestFullscreen) { p = e.msRequestFullscreen(); }
      else { return false; }
      if (p && p.catch) { p.catch(function () { /* perlu gestur pengguna */ }); }
      return true;
    } catch (err) { return false; }
  }

  function keluarPenuh() {
    try {
      var p = document.exitFullscreen ? document.exitFullscreen()
        : document.webkitExitFullscreen ? document.webkitExitFullscreen()
        : document.msExitFullscreen ? document.msExitFullscreen() : null;
      if (p && p.catch) { p.catch(function () { /* abaikan */ }); }
    } catch (e) { /* abaikan */ }
  }

  function modeTerpasang() {
    try {
      if (window.navigator.standalone === true) { return true; }
      return !!(window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches));
    } catch (e) { return false; }
  }

  function perluPetunjukPasang() {
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return ios && !modeTerpasang();
  }

  function perbaruiTombolPenuh() {
    var t = menu ? menu.querySelector('#tombolPenuh') : null;
    if (!t) { return; }
    if (!punyaApiPenuh()) {
      t.textContent = modeTerpasang() ? '\u26F6 Sudah layar penuh' : '\u26F6 Layar penuh (pakai mode terpasang)';
    } else {
      t.textContent = elemenPenuh() ? '\u2715 Keluar layar penuh' : '\u26F6 Layar penuh';
    }
  }

  function simpanPenuh() {
    try { localStorage.setItem(KUNCI_PENUH, penuhDiinginkan ? '1' : '0'); } catch (e) { /* abaikan */ }
  }

  function tutupMenuSendiri() {
    if (menu) { menu.hidden = true; }
    var tm = document.getElementById('tombolMenu');
    if (tm) { tm.classList.remove('aktif'); }
  }

  function saatPenuhBerubah() {
    perbaruiTombolPenuh();
    if (elemenPenuh()) {
      // beri tahu sekali cara keluarnya
      var sudah = null;
      try { sudah = localStorage.getItem(KUNCI_HINT_PENUH); } catch (e) { sudah = null; }
      if (!sudah) {
        try { localStorage.setItem(KUNCI_HINT_PENUH, '1'); } catch (e) { /* abaikan */ }
        pesan('Layar penuh aktif \u2014 tab, address bar, dan bookmark bar disembunyikan. Tekan Esc untuk keluar.', 5000);
      }
      return;
    }
    // Keluar dari layar penuh. Bila bukan karena pindah halaman, berarti pengguna
    // memang tidak menginginkannya -> jangan masuk otomatis lagi.
    if (!sedangPindah) {
      penuhDiinginkan = false;
      simpanPenuh();
    }
  }

  function alihPenuh() {
    if (elemenPenuh()) {
      keluarPenuh();
      penuhDiinginkan = false;
    } else if (punyaApiPenuh()) {
      penuhDiinginkan = masukPenuh();
    } else {
      pesan('Di iPhone/iPad: tekan tombol Bagikan lalu pilih "Tambahkan ke Layar Utama" untuk tampilan penuh.', 7000);
      penuhDiinginkan = true;
    }
    simpanPenuh();
    setTimeout(perbaruiTombolPenuh, 150);
  }

  function pasangMenuPenuh() {
    if (!menu || menu.querySelector('#tombolPenuh')) { return; }
    var baris = document.createElement('div');
    baris.className = 'menu-baris';
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'item lebar utama';
    tombol.id = 'tombolPenuh';
    tombol.addEventListener('click', alihPenuh);
    baris.appendChild(tombol);
    menu.appendChild(baris);
    perbaruiTombolPenuh();
  }

  function pasangMenuPasang() {
    if (!menu || menu.querySelector('#tombolPasang')) { return; }
    var baris = document.createElement('div');
    baris.className = 'menu-baris';
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'item lebar';
    tombol.id = 'tombolPasang';
    tombol.textContent = promptPasang ? '\u2913 Pasang di Layar Utama' : '\u2913 Cara pasang di Layar Utama';
    tombol.addEventListener('click', function () {
      if (promptPasang) {
        try { promptPasang.prompt(); } catch (e) { /* abaikan */ }
        promptPasang = null;
        if (baris.parentNode) { baris.parentNode.removeChild(baris); }
      } else {
        pesan('Tekan tombol Bagikan (kotak dengan panah ke atas) lalu pilih "Tambahkan ke Layar Utama".', 8000);
      }
      tutupMenuSendiri();
    });
    baris.appendChild(tombol);
    menu.appendChild(baris);
  }

  function penuhPadaSentuhPertama() {
    if (!penuhDiinginkan || sentuhPenuhSudah || elemenPenuh() || !punyaApiPenuh()) { return; }
    sentuhPenuhSudah = true;
    masukPenuh();   // masih dalam gestur pengguna, jadi diizinkan peramban
  }

  /* ---------- tombol berbagi (media sosial & WhatsApp kontak) ---------- */
  var panelBagikan = null, latarBagikan = null;

  function dataBerbagi() {
    var rincian = (info.juz && info.halaman)
      ? ('Juz ' + info.juz + ' \u00b7 Halaman ' + info.halaman)
      : 'Mushaf Al-Qur\u2019an 30 juz';
    return {
      judul: 'Mushaf Al-Qubba',
      teks: 'Mushaf Al-Qubba \u2014 ' + rincian,
      rincian: rincian,
      tautan: location.href
    };
  }

  function salinTautan(d) {
    var selesai = function () { pesan('Tautan disalin: ' + d.tautan, 3000); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(d.tautan).then(selesai, function () { salinCaraLama(d, selesai); });
        return;
      }
    } catch (e) { /* lanjut ke cara lama */ }
    salinCaraLama(d, selesai);
  }

  function salinCaraLama(d, selesai) {
    try {
      var ta = document.createElement('textarea');
      ta.value = d.tautan;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      selesai();
    } catch (e) {
      pesan('Tautan halaman: ' + d.tautan, 6000);
    }
  }

  function tutupPanelBagikan() {
    if (panelBagikan) { panelBagikan.classList.remove('aktif'); }
    if (latarBagikan) { latarBagikan.classList.remove('aktif'); }
  }

  function tampilkanPanelBagikan() {
    var d = dataBerbagi();
    var pesanWa = encodeURIComponent(d.teks + '\n' + d.tautan);
    var u = encodeURIComponent(d.tautan);
    var t = encodeURIComponent(d.teks);

    if (!panelBagikan) {
      latarBagikan = document.createElement('div');
      latarBagikan.className = 'mushaf-bagikan-latar';
      latarBagikan.addEventListener('click', tutupPanelBagikan);
      document.body.appendChild(latarBagikan);

      panelBagikan = document.createElement('div');
      panelBagikan.className = 'mushaf-bagikan';
      panelBagikan.innerHTML =
        '<p class="bagikan-judul">Bagikan halaman ini</p>' +
        '<p class="bagikan-rincian"></p>' +
        '<div class="bagikan-kisi">' +
        '<a class="bagikan-tombol" data-bagikan="wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + pesanWa + '">WhatsApp</a>' +
        '<a class="bagikan-tombol" data-bagikan="telegram" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + u + '&text=' + t + '">Telegram</a>' +
        '<a class="bagikan-tombol" data-bagikan="facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + u + '">Facebook</a>' +
        '<a class="bagikan-tombol" data-bagikan="x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + u + '&text=' + t + '">X / Twitter</a>' +
        '<a class="bagikan-tombol" data-bagikan="email" href="mailto:?subject=' + t + '&body=' + pesanWa + '">Email</a>' +
        '<button type="button" class="bagikan-tombol" data-bagikan="salin">Salin tautan</button>' +
        '</div>' +
        '<button type="button" class="bagikan-tutup" data-bagikan="tutup">Tutup</button>';
      document.body.appendChild(panelBagikan);

      panelBagikan.addEventListener('click', function (e) {
        var sasaran = e.target.closest ? e.target.closest('[data-bagikan]') : null;
        if (!sasaran) { return; }
        var jenis = sasaran.getAttribute('data-bagikan');
        if (jenis === 'salin') { salinTautan(dataBerbagi()); }
        if (jenis === 'tutup' || jenis === 'salin') { setTimeout(tutupPanelBagikan, 250); }
      });
    } else {
      // perbarui tautan bila halaman berubah
      var tautanWa = panelBagikan.querySelector('[data-bagikan="wa"]');
      if (tautanWa) { tautanWa.setAttribute('href', 'https://wa.me/?text=' + pesanWa); }
    }
    var rincian = panelBagikan.querySelector('.bagikan-rincian');
    if (rincian) { rincian.textContent = d.rincian; }
    if (latarBagikan) { latarBagikan.classList.add('aktif'); }
    panelBagikan.classList.add('aktif');
  }

  function bagikan() {
    var d = dataBerbagi();
    if (navigator.share) {
      try {
        var p = navigator.share({ title: d.teks, text: d.teks, url: d.tautan });
        if (p && p.catch) {
          p.catch(function (err) {
            if (err && err.name === 'AbortError') { return; }   // dibatalkan pengguna
            tampilkanPanelBagikan();
          });
        }
        return;
      } catch (e) { /* lanjut ke panel */ }
    }
    tampilkanPanelBagikan();
  }

  function pasangTombolBagikan() {
    if (document.querySelector('.tombol-bagikan')) { return; }
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'tombol-bagikan';
    tombol.title = 'Bagikan halaman ini';
    tombol.setAttribute('aria-label', 'Bagikan halaman ini');
    tombol.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
      '<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    tombol.addEventListener('click', bagikan);
    document.body.appendChild(tombol);
  }

  /* ---------- catatanku (catatan pembaca per halaman/ayat) ---------- */
  var KUNCI_CATATAN = 'mushaf-catatan-v1';
  var JENIS_CATATAN = [
    { nilai: 'cerita', label: 'Cerita' },
    { nilai: 'koreksi', label: 'Koreksi' },
    { nilai: 'pengalaman', label: 'Pengalaman' },
    { nilai: 'lainnya', label: 'Lainnya' }
  ];
  var panelCatatan = null;
  var modePilihAyat = false;
  var ayatPilihan = null;
  var jenisPilihan = 'pengalaman';

  function bacaSemuaCatatan() {
    try {
      var s = localStorage.getItem(KUNCI_CATATAN);
      var a = s ? JSON.parse(s) : [];
      return Object.prototype.toString.call(a) === '[object Array]' ? a : [];
    } catch (e) { return []; }
  }

  function tulisSemuaCatatan(a) {
    try {
      localStorage.setItem(KUNCI_CATATAN, JSON.stringify(a.slice(-600)));
      return true;
    } catch (e) {
      pesan('Penyimpanan perangkat penuh, catatan lama mungkin terhapus.', 4000);
      return false;
    }
  }

  function catatanHalamanIni() {
    return bacaSemuaCatatan().filter(function (c) {
      return c.juz === info.juz && c.halaman === info.halaman;
    });
  }

  function jumlahBelumTerkirim() {
    return bacaSemuaCatatan().filter(function (c) { return !c.terkirim; }).length;
  }

  function berkasHalamanIni() {
    var m = /\/juz\d+\/hal-\d+\.html$/.exec(location.pathname);
    return m ? location.pathname.replace(/^\//, '') : '';
  }

  function buatId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function waktuRingkas(ms) {
    try {
      return new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function simpanCatatan(baru) {
    var a = bacaSemuaCatatan();
    a.push(baru);
    return tulisSemuaCatatan(a) ? baru : null;
  }

  function perbaruiCatatan(id, ubah) {
    var a = bacaSemuaCatatan();
    var ketemu = false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id === id) { for (var k in ubah) { if (ubah.hasOwnProperty(k)) { a[i][k] = ubah[k]; } } ketemu = true; }
    }
    if (ketemu) { tulisSemuaCatatan(a); }
    return ketemu;
  }

  function hapusCatatan(id) {
    var a = bacaSemuaCatatan().filter(function (c) { return c.id !== id; });
    tulisSemuaCatatan(a);
  }

  function kirimSatu(c) {
    var muatan = {
      id: c.id, juz: c.juz, halaman: c.halaman, berkas: c.berkas, jenis: c.jenis,
      isi: c.isi, nama: c.nama || '', kontak: c.kontak || '', ayat: c.ayat || null, dibuat: c.dibuat
    };
    return fetch('../catatan.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(muatan)
    }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) { throw new Error('ditolak server'); }
      perbaruiCatatan(c.id, { terkirim: new Date().toISOString(), galat: null });
      return true;
    });
  }

  function kirimSemuaTertunda(beriTahu) {
    var tertunda = bacaSemuaCatatan().filter(function (c) { return !c.terkirim; }).slice(0, 3);
    if (!tertunda.length) { if (beriTahu) { pesan('Tidak ada catatan yang menunggu dikirim.', 2500); } return; }
    var berhasil = 0, gagal = 0;
    var urut = Promise.resolve();
    tertunda.forEach(function (c) {
      urut = urut.then(function () {
        return kirimSatu(c).then(function () { berhasil++; }, function (e) {
          gagal++;
          perbaruiCatatan(c.id, { galat: String(e && e.message ? e.message : e) });
        });
      });
    });
    urut.then(function () {
      if (beriTahu || berhasil) {
        pesan(berhasil + ' catatan terkirim' + (gagal ? ', ' + gagal + ' gagal (dicoba lagi nanti)' : '') + '.', 3500);
      }
      if (panelCatatan && panelCatatan.classList.contains('aktif')) { gambarCatatan(); }
    });
  }

  /* --- pilih ayat: pengguna mengetuk potongan teks di halaman --- */
  var POLA_AYAT = /^juz(\d+)halaman(\d+)surat(\d+)ayat(\d+)baris(\d+)$/;

  function anchorAyat(target) {
    var n = target;
    while (n && n !== lembar) {
      if (n.tagName === 'A' && n.name && POLA_AYAT.test(n.name)) { return n.name; }
      var s = n.previousElementSibling;
      while (s) {
        if (s.tagName === 'A' && s.name && POLA_AYAT.test(s.name)) { return s.name; }
        if (s.querySelector) {
          var dalam = s.querySelector('a[name]');
          if (dalam && POLA_AYAT.test(dalam.name)) { return dalam.name; }
        }
        s = s.previousElementSibling;
      }
      n = n.parentNode;
    }
    return null;
  }

  function mulaiPilihAyat() {
    modePilihAyat = true;
    if (panelCatatan) { panelCatatan.classList.remove('aktif'); }
    if (latarCatatan) { latarCatatan.classList.remove('aktif'); }
    document.body.classList.add('mushaf-pilih-ayat');
    pesan('Ketuk ayat/teks pada halaman mushaf untuk dipilih.', 6000);
  }

  function selesaiPilihAyat(ev) {
    if (!modePilihAyat) { return; }
    var target = ev.target;
    if (!target || !lembar.contains(target)) { return; }
    var nama = anchorAyat(target);
    var potongan = (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (nama) {
      var m = POLA_AYAT.exec(nama);
      ayatPilihan = { surat: +m[3], ayat: +m[4], baris: +m[5], kata: potongan };
      pesan('Ayat terpilih: Surat ' + ayatPilihan.surat + ' \u00b7 Ayat ' + ayatPilihan.ayat, 3000);
    } else {
      ayatPilihan = { surat: 0, ayat: 0, baris: 0, kata: potongan };
      pesan('Bagian teks terpilih: "' + potongan.slice(0, 30) + '"', 3000);
    }
    modePilihAyat = false;
    document.body.classList.remove('mushaf-pilih-ayat');
    bukaPanelCatatan();
  }

  /* --- panel --- */
  var latarCatatan = null;

  function bukaPanelCatatan() {
    if (!panelCatatan) { bangunPanelCatatan(); }
    if (!panelCatatan) { return; }
    if (latarCatatan) { latarCatatan.classList.add('aktif'); }
    panelCatatan.classList.add('aktif');
    gambarCatatan();
  }

  function tutupPanelCatatan() {
    if (panelCatatan) { panelCatatan.classList.remove('aktif'); }
    if (latarCatatan) { latarCatatan.classList.remove('aktif'); }
  }

  function bangunPanelCatatan() {
    if (panelCatatan) { return; }
    latarCatatan = document.createElement('div');
    latarCatatan.className = 'mushaf-catatan-latar';
    latarCatatan.addEventListener('click', tutupPanelCatatan);

    panelCatatan = document.createElement('div');
    panelCatatan.className = 'mushaf-catatan';
    panelCatatan.innerHTML =
      '<div class="catatan-kepala"><strong>\uD83D\uDCDD Catatanku</strong>' +
      '<button type="button" class="catatan-tutup-x" data-catatan="tutup" aria-label="Tutup">\u00d7</button></div>' +
      '<p class="catatan-konteks" id="catatanKonteks"></p>' +
      '<div class="catatan-jenis" id="catatanJenis"></div>' +
      '<div class="catatan-ayat" id="catatanAyat"></div>' +
      '<textarea id="catatanIsi" rows="4" placeholder="Tulis catatan: cerita, koreksi, atau pengalaman Anda dengan Mushaf Al-Qubba\u2026"></textarea>' +
      '<div class="catatan-baris-ganda">' +
      '<input type="text" id="catatanNama" placeholder="Nama (opsional)" maxlength="80">' +
      '<input type="text" id="catatanKontak" placeholder="WA / email (opsional)" maxlength="80">' +
      '</div>' +
      '<div class="catatan-aksi">' +
      '<button type="button" class="catatan-tombol utama" data-catatan="simpan-kirim">Simpan &amp; kirim</button>' +
      '<button type="button" class="catatan-tombol" data-catatan="simpan">Simpan saja</button>' +
      '</div>' +
      '<div class="catatan-daftar" id="catatanDaftar"></div>' +
      '<div class="catatan-kaki">' +
      '<button type="button" class="catatan-tombol" data-catatan="kirim-tertunda">Kirim yang tertunda</button>' +
      '<button type="button" class="catatan-tombol" data-catatan="tutup">Tutup</button>' +
      '</div>';

    document.body.appendChild(latarCatatan);
    document.body.appendChild(panelCatatan);

    var jenisKotak = panelCatatan.querySelector('#catatanJenis');
    JENIS_CATATAN.forEach(function (j) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'catatan-chip';
      b.setAttribute('data-jenis', j.nilai);
      b.textContent = j.label;
      b.addEventListener('click', function () { jenisPilihan = j.nilai; gambarCatatan(); });
      jenisKotak.appendChild(b);
    });

    panelCatatan.querySelector('#catatanAyat').addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-catatan]') : null;
      if (!t) { return; }
      var aksi = t.getAttribute('data-catatan');
      if (aksi === 'pilih-ayat') { mulaiPilihAyat(); }
      if (aksi === 'hapus-ayat') { ayatPilihan = null; gambarCatatan(); }
    });

    panelCatatan.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-catatan]') : null;
      if (!t) { return; }
      var aksi = t.getAttribute('data-catatan');
      if (aksi === 'tutup') { tutupPanelCatatan(); return; }
      if (aksi === 'simpan' || aksi === 'simpan-kirim') {
        var isi = (panelCatatan.querySelector('#catatanIsi').value || '').trim();
        if (!isi) { pesan('Catatan masih kosong.', 2500); return; }
        var baru = simpanCatatan({
          id: buatId(),
          juz: info.juz, halaman: info.halaman, berkas: berkasHalamanIni(),
          jenis: jenisPilihan, isi: isi.slice(0, 4000),
          nama: (panelCatatan.querySelector('#catatanNama').value || '').trim().slice(0, 80),
          kontak: (panelCatatan.querySelector('#catatanKontak').value || '').trim().slice(0, 80),
          ayat: ayatPilihan,
          dibuat: new Date().toISOString(),
          terkirim: null, galat: null
        });
        if (!baru) { return; }
        panelCatatan.querySelector('#catatanIsi').value = '';
        ayatPilihan = null;
        pesan('Catatan tersimpan di perangkat ini.', 2500);
        gambarCatatan();
        if (aksi === 'simpan-kirim') { kirimSatu(baru).catch(function (e) { perbaruiCatatan(baru.id, { galat: String(e && e.message ? e.message : e) }); gambarCatatan(); }); }
        return;
      }
      if (aksi === 'kirim-tertunda') { kirimSemuaTertunda(true); return; }
      if (aksi === 'kirim-satu') { var id = t.getAttribute('data-id'); var c = bacaSemuaCatatan().filter(function (x) { return x.id === id; })[0]; if (c) { kirimSatu(c).then(function () { pesan('Catatan terkirim.', 2500); gambarCatatan(); }, function (e) { pesan('Gagal mengirim: ' + (e && e.message ? e.message : e), 3500); gambarCatatan(); }); } return; }
      if (aksi === 'hapus-satu') {
        var idh = t.getAttribute('data-id');
        hapusCatatan(idh);
        pesan('Catatan dihapus.', 2000);
        gambarCatatan();
        return;
      }
    });
  }

  function gambarCatatan() {
    if (!panelCatatan) { return; }
    var konteks = panelCatatan.querySelector('#catatanKonteks');
    if (konteks) {
      konteks.textContent = 'Halaman ini: Juz ' + info.juz + ' \u00b7 Halaman ' + info.halaman +
        ' \u2014 ' + catatanHalamanIni().length + ' catatan';
    }

    [].forEach.call(panelCatatan.querySelectorAll('.catatan-chip'), function (c) {
      if (c.getAttribute('data-jenis') === jenisPilihan) { c.classList.add('aktif'); }
      else { c.classList.remove('aktif'); }
    });

    var kotakAyat = panelCatatan.querySelector('#catatanAyat');
    if (kotakAyat) {
      if (ayatPilihan && ayatPilihan.surat) {
        kotakAyat.innerHTML = '<span class="catatan-ayat-terpilih">Surat ' + ayatPilihan.surat +
          ' \u00b7 Ayat ' + ayatPilihan.ayat + (ayatPilihan.kata ? ' \u2014 \u00ab' + escapeHtml(ayatPilihan.kata) + '\u00bb' : '') +
          '</span><button type="button" class="catatan-chip" data-catatan="hapus-ayat">\u00d7</button>';
      } else if (ayatPilihan && ayatPilihan.kata) {
        kotakAyat.innerHTML = '<span class="catatan-ayat-terpilih">\u00ab' + escapeHtml(ayatPilihan.kata) +
          '\u00bb</span><button type="button" class="catatan-chip" data-catatan="hapus-ayat">\u00d7</button>';
      } else {
        kotakAyat.innerHTML = '<button type="button" class="catatan-chip" data-catatan="pilih-ayat">Pilih ayat / teks di halaman</button>';
      }
    }

    var daftar = panelCatatan.querySelector('#catatanDaftar');
    if (!daftar) { return; }
    var semua = bacaSemuaCatatan().slice().reverse();
    var diHalaman = semua.filter(function (c) { return c.juz === info.juz && c.halaman === info.halaman; });
    var lain = semua.filter(function (c) { return !(c.juz === info.juz && c.halaman === info.halaman); });
    var html = '<p class="catatan-sub">Catatan di halaman ini (' + diHalaman.length + ')</p>';
    if (!diHalaman.length) { html += '<p class="catatan-kosong">Belum ada catatan di halaman ini.</p>'; }
    diHalaman.forEach(function (c) { html += kartuCatatan(c, false); });
    if (lain.length) {
      html += '<p class="catatan-sub">Catatan halaman lain (' + lain.length + ')</p>';
      lain.slice(0, 30).forEach(function (c) { html += kartuCatatan(c, true); });
    }
    daftar.innerHTML = html;
  }

  function kartuCatatan(c, tampilkanHalaman) {
    var judul = (JENIS_CATATAN.filter(function (j) { return j.nilai === c.jenis; })[0] || { label: 'Catatan' }).label;
    var ayat = c.ayat && c.ayat.surat ? ('Surat ' + c.ayat.surat + ' \u00b7 Ayat ' + c.ayat.ayat) : '';
    return '<div class="catatan-kartu">' +
      '<div class="catatan-kartu-kepala"><span class="catatan-label">' + escapeHtml(judul) + '</span>' +
      '<span class="catatan-waktu">' + escapeHtml(waktuRingkas(Date.parse(c.dibuat) || Date.now())) +
      (tampilkanHalaman ? ' \u00b7 Hal. ' + c.halaman : '') + '</span></div>' +
      (ayat ? '<div class="catatan-ayat-kecil">' + escapeHtml(ayat) + (c.ayat.kata ? ' \u2014 \u00ab' + escapeHtml(c.ayat.kata) + '\u00bb' : '') + '</div>' : '') +
      '<div class="catatan-isi">' + escapeHtml(c.isi) + '</div>' +
      '<div class="catatan-kartu-kaki">' +
      (c.terkirim ? '<span class="catatan-status ok">Terkirim</span>'
        : '<span class="catatan-status tunggu">Belum terkirim' + (c.galat ? ' \u00b7 ' + escapeHtml(c.galat) : '') + '</span>') +
      (c.terkirim ? '' : '<button type="button" class="catatan-chip" data-catatan="kirim-satu" data-id="' + c.id + '">Kirim</button>') +
      '<button type="button" class="catatan-chip" data-catatan="hapus-satu" data-id="' + c.id + '">Hapus</button>' +
      '</div></div>';
  }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pasangTombolCatatan() {
    if (document.querySelector('.tombol-catatan')) { return; }
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'tombol-catatan';
    tombol.title = 'Catatanku';
    tombol.setAttribute('aria-label', 'Catatanku');
    tombol.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5z"/>' +
      '<path d="M8 7.5h8M8 11.5h8M8 15.5h5"/></svg>';
    tombol.addEventListener('click', bukaPanelCatatan);
    document.body.appendChild(tombol);
  }

  function pasangMenuCatatan() {
    if (!menu || menu.querySelector('#tombolCatatanMenu')) { return; }
    var baris = document.createElement('div');
    baris.className = 'menu-baris';
    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'item lebar';
    tombol.id = 'tombolCatatanMenu';
    tombol.textContent = '\uD83D\uDCDD Catatanku';
    tombol.addEventListener('click', function () {
      tutupMenuSendiri();
      bukaPanelCatatan();
    });
    baris.appendChild(tombol);
    menu.appendChild(baris);

    // baris kedua: halaman catatan pembaca (catatan yang sudah dikirim ke server)
    var barisDua = document.createElement('div');
    barisDua.className = 'menu-baris';
    var tautan = document.createElement('a');
    tautan.className = 'item lebar';
    tautan.id = 'tautanCatatanPembaca';
    tautan.href = '../catatan-publik.html';
    tautan.textContent = '\uD83D\uDCD6 Catatan pembaca';
    barisDua.appendChild(tautan);
    menu.appendChild(barisDua);
  }

  /* ---------- sentuhan (ponsel/tablet) ---------- */
  var sentuh = null;

  lembar.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { sentuh = null; return; }
    if (bukanKontrol(e.target)) {
      jejakCatat('mulai di kontrol: ' + (e.target.tagName || '?') + ' ' + (e.target.className || ''));
      sentuh = null;
      return;
    }
    var t = e.touches[0];
    sentuh = { x: t.clientX, y: t.clientY, waktu: Date.now(), sl: lembar.scrollLeft, st: lembar.scrollTop };
    // kaca pembesar: tahan jari tanpa menggeser
    if (pembesarNyala) {
      batalkanTahan();
      tahanJam = setTimeout(function () {
        tahanJam = null;
        sentuh = null;                       // menahan bukan menggeser: batalkan pindah halaman
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { /* abaikan */ } }
        tampilkanLensa(t.clientX, t.clientY, true);
      }, PEMBESAR_TAHAN_MS);
    }
  }, { passive: true });

  lembar.addEventListener('touchmove', function (e) {
    if (lensaAktif) {
      var tl = e.touches[0];
      if (tl) { tampilkanLensa(tl.clientX, tl.clientY, true); }
      if (e.cancelable) { e.preventDefault(); }   // sedang memperbesar: jangan menggulir
      return;
    }
    if (!sentuh) { return; }
    if (e.touches.length !== 1) { sentuh = null; batalkanTahan(); return; }   // jadi cubit dua jari
    var t = e.touches[0];
    var dx = t.clientX - sentuh.x, dy = t.clientY - sentuh.y;
    if (tahanJam && Math.max(Math.abs(dx), Math.abs(dy)) > 10) { batalkanTahan(); }
    if (!sentuh.ditahan && e.cancelable &&
        Math.abs(dx) > 14 && Math.abs(dx) >= Math.abs(dy) * AMBANG_MENDATAR &&
        bolehPindah(dx, dy, sentuh.sl, sentuh.st)) {
      // Geseran mendatar yang memang akan memindah halaman: tahan gesturnya supaya
      // tidak diambil alih navigasi tepi layar peramban (maju/mundur) — itulah yang
      // membuat arah geseran terasa terbalik di sebagian ponsel.
      sentuh.ditahan = true;
    }
    if (sentuh.ditahan && e.cancelable) { e.preventDefault(); }
  }, { passive: false });

  lembar.addEventListener('touchend', function (e) {
    batalkanTahan();
    if (lensaAktif) { sembunyikanLensa(); sentuh = null; return; }
    if (!sentuh || e.changedTouches.length !== 1) { sentuh = null; return; }
    var t = e.changedTouches[0];
    var s = sentuh;
    sentuh = null;
    var hasil = tafsirGeser(t.clientX - s.x, t.clientY - s.y, Date.now() - s.waktu, s.sl, s.st);
    if (hasil) { pindah(hasil.arah, hasil.sumbu); }
  }, { passive: true });

  lembar.addEventListener('touchcancel', function () {
    batalkanTahan();
    sembunyikanLensa();
    sentuh = null;
  }, { passive: true });

  /* ---------- seret dengan tetikus (komputer) ---------- */
  var seret = null;

  lembar.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || bukanKontrol(e.target)) { seret = null; return; }
    seret = { x: e.clientX, y: e.clientY, waktu: Date.now(), jalan: false, sl: lembar.scrollLeft, st: lembar.scrollTop };
  });

  window.addEventListener('mousemove', function (e) {
    // kaca pembesar mengikuti tetikus (kecuali sedang menyeret untuk pindah halaman)
    if (pembesarNyala && !(seret && seret.jalan)) {
      tampilkanLensa(e.clientX, e.clientY, false);
    } else if (lensaAktif) {
      sembunyikanLensa();
    }
    if (!seret) { return; }
    var dx = e.clientX - seret.x, dy = e.clientY - seret.y;
    if (!seret.jalan && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      seret.jalan = true;
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      sembunyikanLensa();
    }
    if (seret.jalan && e.cancelable) { e.preventDefault(); }
  });

  document.addEventListener('mouseleave', function () { sembunyikanLensa(); });

  // isi lensa ikut menyesuaikan bila halaman digulir tanpa menggerakkan penunjuk
  lembar.addEventListener('scroll', function () {
    if (lensaAktif && titikTerakhir) {
      tampilkanLensa(titikTerakhir.x, titikTerakhir.y, titikTerakhir.naik);
    }
  }, { passive: true });

  window.addEventListener('mouseup', function (e) {
    if (!seret) { return; }
    var s = seret;
    seret = null;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    if (!s.jalan) { return; }
    var hasil = tafsirGeser(e.clientX - s.x, e.clientY - s.y, Date.now() - s.waktu, s.sl, s.st);
    if (hasil) { pindah(hasil.arah, hasil.sumbu); }
  });

  /* ---------- tombol panah kibor ---------- */
  if (PAKAI_TOMBOL_PANAH) {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { return; }
      var arah = null, sumbu = 'x';
      if (e.key === 'ArrowLeft') { arah = 'berikut'; }
      else if (e.key === 'ArrowRight') { arah = 'sebelum'; }
      else if (e.key === 'ArrowUp') { arah = 'berikut'; sumbu = 'y'; }
      else if (e.key === 'ArrowDown') { arah = 'sebelum'; sumbu = 'y'; }
      else { return; }
      if (pindah(arah, sumbu)) { e.preventDefault(); }
    });
  }

  /* ---------- bilah status: nomor juz & nomor halaman ---------- */
  // Ditempatkan sebagai anak pertama <body> (badan halaman memakai flex kolom), jadi
  // bilah ini berada tepat di bawah baris status layar dan TIDAK menutupi isi mushaf —
  // tinggi area baca berkurang sedikit, lalu halaman dihitung ulang agar tetap isi penuh.
  function pasangBilah() {
    if (!info.juz || !info.halaman) { return; }
    if (document.querySelector('.mushaf-bilah')) { return; }
    var bilah = document.createElement('div');
    bilah.className = 'mushaf-bilah';
    bilah.setAttribute('role', 'status');
    bilah.setAttribute('aria-label', 'Juz ' + info.juz + ', halaman ' + info.halaman);
    bilah.innerHTML =
      '<span class="bilah-juz">Juz ' + info.juz + '</span>' +
      '<span class="bilah-pisah">\u00b7</span>' +
      '<span class="bilah-hal">Halaman ' + info.halaman + '</span>';
    document.body.insertBefore(bilah, document.body.firstChild);
    // beri tahu skrip bawaan halaman supaya skalanya dihitung ulang
    setTimeout(function () {
      try { window.dispatchEvent(new Event('resize')); } catch (e) { /* abaikan */ }
    }, 0);
  }

  /* ---------- layar mendatar: pilihan bagi isi jadi dua kolom ---------- */
  // DIMATIKAN (false): di layar mendatar cukup LEBAR yang disesuaikan lalu isi digulir
  // naik-turun, sesuai permintaan. Ubah ke true bila ingin seluruh halaman masuk layar
  // dengan isi dibagi dua kolom (kanan dulu) — lebar lebih terpakai, teks lebih kecil.
  var DUA_KOLOM_MENDATAR = false;
  var DUA_KOLOM_MAKS_TINGGI = 560;
  var modeKolom = null;

  function aturKolom() {
    var zoom = document.getElementById('zoom');
    if (!zoom) { return; }
    var mauDua = DUA_KOLOM_MENDATAR &&
                 (lembar.clientWidth > lembar.clientHeight) &&
                 (lembar.clientHeight <= DUA_KOLOM_MAKS_TINGGI);
    if (modeKolom === mauDua) { return; }
    modeKolom = mauDua;
    if (mauDua) {
      // Lebar #zoom dibiarkan "max-content" (bawaan halaman): dengan column-count:2
      // lebarnya dihitung sendiri = 2 x lebar isi + jarak, sehingga tidak salah ukur
      // walau font Arab belum selesai dimuat.
      zoom.classList.add('mushaf-kolom');
      zoom.style.columnCount = '2';
      zoom.style.columnGap = '40px';
    } else {
      zoom.classList.remove('mushaf-kolom');
      zoom.style.columnCount = '';
      zoom.style.columnGap = '';
    }
    // minta skrip bawaan menghitung ulang skala (panggilan berikutnya sudah tidak berubah,
    // jadi tidak ada perulangan)
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* abaikan */ }
  }

  /* ---------- pulihkan tampilan bila kembali dari riwayat ---------- */
  window.addEventListener('pageshow', function () { bersihkanEfek(); sedangPindah = false; });

  pasangBilah();
  pasangMenuPembesar();
  pasangMenuPenuh();
  pasangTombolBagikan();
  pasangTombolCatatan();
  pasangMenuCatatan();
  // ketukan untuk memilih ayat/teks (hanya saat mode pilih aktif)
  lembar.addEventListener('click', selesaiPilihAyat);
  // coba kirim catatan yang tertunda (paling banyak 3 per pemuatan halaman)
  setTimeout(function () { kirimSemuaTertunda(false); }, 2500);
  if (perluPetunjukPasang()) { pasangMenuPasang(); }
  document.addEventListener('fullscreenchange', saatPenuhBerubah);
  document.addEventListener('webkitfullscreenchange', saatPenuhBerubah);
  // pintasan kibor: huruf F untuk masuk/keluar layar penuh
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'f' && e.key !== 'F') { return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { return; }
    e.preventDefault();
    alihPenuh();
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promptPasang = e;
    pasangMenuPasang();
    // kalau tombolnya sudah ada (dibuat untuk petunjuk iOS), perbarui labelnya
    var t = menu ? menu.querySelector('#tombolPasang') : null;
    if (t) { t.textContent = '\u2913 Pasang di Layar Utama'; }
  });
  // coba masuk layar penuh tanpa gestur (biasanya ditolak; tidak masalah bila gagal)
  if (penuhDiinginkan && punyaApiPenuh()) { setTimeout(function () { if (!elemenPenuh()) { masukPenuh(); } }, 500); }
  document.addEventListener('touchstart', penuhPadaSentuhPertama, { passive: true });
  document.addEventListener('click', penuhPadaSentuhPertama);
  aturKolom();
  window.addEventListener('orientationchange', function () { setTimeout(aturKolom, 350); });
  window.addEventListener('resize', function () { aturKolom(); });
  petunjukSekali();
  petunjukPembesar();

  /* ---------- dipakai untuk pengujian ---------- */
  window.MushafGeser = {
    info: info,
    alamatBerikut: function () { var t = tujuan('berikut'); return t ? absolut(t.alamat) : null; },
    alamatSebelum: function () { var t = tujuan('sebelum'); return t ? absolut(t.alamat) : null; },
    berikut: function () { return pindah('berikut', 'x'); },
    sebelumnya: function () { return pindah('sebelum', 'x'); },
    tafsir: function (dx, dy) { return tafsirGeser(dx, dy, 200); },
    bolehPindah: bolehPindah,
    jejak: jejak,
    // dipakai untuk pengujian kaca pembesar
    // dipakai untuk pengujian layar penuh
    // dipakai untuk pengujian tombol berbagi
    // dipakai untuk pengujian catatan
    catatan: {
      adaTombol: function () { return !!document.querySelector('.tombol-catatan'); },
      adaTombolMenu: function () { return !!(menu && menu.querySelector('#tombolCatatanMenu')); },
      semua: bacaSemuaCatatan,
      halamanIni: catatanHalamanIni,
      tertunda: jumlahBelumTerkirim,
      panelTerbuka: function () { return !!(panelCatatan && panelCatatan.classList.contains('aktif')); },
      buka: bukaPanelCatatan,
      tutup: tutupPanelCatatan,
      setJenis: function (j) { jenisPilihan = j; gambarCatatan(); },
      jenis: function () { return jenisPilihan; },
      pilihAyat: function (a) { ayatPilihan = a; gambarCatatan(); },
      ayat: function () { return ayatPilihan; },
      modePilihAyat: function () { return modePilihAyat; },
      mulaiPilihAyat: mulaiPilihAyat,
      simpan: function (isi, kirim) {
        var b = simpanCatatan({
          id: buatId(), juz: info.juz, halaman: info.halaman, berkas: berkasHalamanIni(),
          jenis: jenisPilihan, isi: isi, nama: '', kontak: '', ayat: ayatPilihan,
          dibuat: new Date().toISOString(), terkirim: null, galat: null
        });
        if (b && kirim) {
          return kirimSatu(b).then(function () { return b.id; }, function (e) {
            perbaruiCatatan(b.id, { galat: String(e && e.message ? e.message : e) });
            throw e;
          });
        }
        return b ? b.id : null;
      },
      kirimSatuById: function (id) {
        var c = bacaSemuaCatatan().filter(function (x) { return x.id === id; })[0];
        if (!c) { return Promise.reject(new Error('tidak ada')); }
        return kirimSatu(c);
      },
      kirimTertunda: kirimSemuaTertunda,
      hapus: hapusCatatan,
      bersihkan: function () { tulisSemuaCatatan([]); }
    },
    bagikan: {
      data: dataBerbagi,
      adaTombol: function () { return !!document.querySelector('.tombol-bagikan'); },
      panelTerbuka: function () { return !!(panelBagikan && panelBagikan.classList.contains('aktif')); },
      buka: tampilkanPanelBagikan,
      tutup: tutupPanelBagikan,
      daftar: function () {
        if (!panelBagikan) { return []; }
        return [].slice.call(panelBagikan.querySelectorAll('[data-bagikan]')).map(function (e) {
          return { jenis: e.getAttribute('data-bagikan'), teks: (e.textContent || '').trim(), href: e.getAttribute('href') || null };
        });
      },
      salin: function () { salinTautan(dataBerbagi()); }
    },
    penuh: {
      tersedia: punyaApiPenuh,
      aktif: function () { return !!elemenPenuh(); },
      terpasang: modeTerpasang,
      diinginkan: function () { return penuhDiinginkan; },
      setDiinginkan: function (v) { penuhDiinginkan = !!v; simpanPenuh(); perbaruiTombolPenuh(); },
      alih: function () { if (elemenPenuh()) { keluarPenuh(); return false; } return masukPenuh(); },
      adaTombol: function () { return !!(menu && menu.querySelector('#tombolPenuh')); },
      adaTombolPasang: function () { return !!(menu && menu.querySelector('#tombolPasang')); },
      adaTawaranPasang: function () { return !!promptPasang; },
      label: function () { var t = menu && menu.querySelector('#tombolPenuh'); return t ? t.textContent : null; }
    },
    pembesar: {
      nyala: function () { return pembesarNyala; },
      tampilkan: function (x, y, naik) { tampilkanLensa(x, y, !!naik); },
      sembunyikan: sembunyikanLensa,
      bangunUlang: function () { klon = null; },
      kondisi: function () {
        if (!lensa) { return null; }
        var isi = lensa.querySelector('.mushaf-lensa-isi');
        var k = isi ? isi.querySelector('.mushaf-klon') : null;
        var rl = lensa.getBoundingClientRect();
        var m = k ? new DOMMatrixReadOnly(getComputedStyle(k).transform) : null;
        return {
          aktif: lensa.classList.contains('aktif'),
          pusat: { x: Math.round(rl.left + rl.width / 2), y: Math.round(rl.top + rl.height / 2) },
          ukuran: Math.round(rl.width),
          adaKlon: !!k,
          skalaKlon: m ? +m.a.toFixed(3) : null,
          gulirKlon: k ? { top: Math.round(k.scrollTop), left: Math.round(k.scrollLeft) } : null,
          gulirAsli: { top: Math.round(lembar.scrollTop), left: Math.round(lembar.scrollLeft) },
          gayaKlon: k ? { kiri: k.style.left, atas: k.style.top, lebar: k.style.width, tinggi: k.style.height } : null,
          jumlahTabelKlon: k ? k.querySelectorAll('table').length : 0
        };
      }
    }
  };
})();
