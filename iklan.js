/* ==========================================================
   Bilah iklan/sponsor Mushaf Al-Qubba
   - Muncul di bagian bawah halaman
   - Diklik -> membuka tampilan dari pemasang iklan
   ========================================================== */
(function () {
  'use strict';

  var KUNCI_SEMBUNYI = 'mushaf-iklan-sembunyi';
  var JEDA_PUTAR = 9000;

  if (sessionStorage.getItem(KUNCI_SEMBUNYI) === '1') { return; }

  /* ---------------- gaya ---------------- */
  var gaya = document.createElement('style');
  gaya.textContent = [
    ':root{--iklan-tinggi:0px}',
    '.iklan-bilah{position:fixed;left:0;right:0;bottom:0;z-index:61;',
    'display:flex;align-items:center;gap:10px;padding:9px 12px calc(9px + env(safe-area-inset-bottom));',
    'background:rgba(243,239,230,.97);border-top:1px solid #e0d9c9;',
    'box-shadow:0 -6px 22px rgba(60,45,20,.10);backdrop-filter:blur(12px);',
    'transform:translateY(110%);transition:transform .26s ease;font-family:"Segoe UI",Tahoma,Arial,system-ui,sans-serif}',
    '.iklan-bilah.tampil{transform:translateY(0)}',
    '.iklan-isi{flex:1 1 auto;display:flex;align-items:center;gap:10px;min-width:0;',
    'background:none;border:0;padding:0;margin:0;text-align:left;cursor:pointer;color:#23201a;font:inherit}',
    '.iklan-gambar{width:46px;height:46px;flex:0 0 auto;border-radius:9px;object-fit:cover;',
    'background:#e6f0eb;border:1px solid #e0d9c9}',
    '.iklan-teks{display:flex;flex-direction:column;min-width:0;line-height:1.3}',
    '.iklan-label{font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;color:#1f6b53;font-weight:700}',
    '.iklan-judul{font-size:13.5px;font-weight:600;color:#23201a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.iklan-aksi{flex:0 0 auto;padding:8px 14px;border-radius:9px;background:#14503f;color:#fff;',
    'font-size:12.5px;font-weight:700;white-space:nowrap}',
    '.iklan-tutup{flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:1px solid #e0d9c9;',
    'background:rgba(255,255,255,.6);color:#6b6152;font-size:17px;line-height:1;cursor:pointer;padding:0}',
    '.iklan-tutup:hover{background:#fff;color:#23201a}',
    'body.iklan-ada{padding-bottom:var(--iklan-tinggi)}',
    'body.iklan-ada .bilah{bottom:var(--iklan-tinggi);transition:bottom .26s ease}',
    /* modal */
    '.iklan-modal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:18px}',
    '.iklan-modal[hidden]{display:none}',
    '.iklan-tirai{position:absolute;inset:0;background:rgba(20,18,14,.62);backdrop-filter:blur(3px)}',
    '.iklan-dialog{position:relative;width:100%;max-width:520px;max-height:90vh;overflow:auto;',
    'background:#fbf9f4;border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45);',
    'font-family:"Segoe UI",Tahoma,Arial,system-ui,sans-serif;color:#23201a;',
    'animation:iklan-muncul .22s ease-out}',
    '@keyframes iklan-muncul{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none}}',
    '.iklan-x{position:absolute;right:12px;top:12px;width:32px;height:32px;border-radius:50%;',
    'border:1px solid #e0d9c9;background:#fff;color:#6b6152;font-size:19px;line-height:1;cursor:pointer;padding:0}',
    '.iklan-x:hover{color:#23201a}',
    '.iklan-poster{width:100%;max-height:46vh;object-fit:contain;border-radius:12px;',
    'background:#e6f0eb;margin:8px 0 14px}',
    '.iklan-h{margin:0 0 8px;font-size:20px;line-height:1.3;letter-spacing:-.01em}',
    '.iklan-p{margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#4a4336;white-space:pre-line}',
    '.iklan-cta{display:block;text-align:center;text-decoration:none;padding:14px 18px;border-radius:12px;',
    'background:#14503f;color:#fff;font-weight:700;font-size:15px}',
    '.iklan-cta:hover{background:#1f6b53}',
    '.iklan-kecil{margin:12px 0 0;font-size:11.5px;color:#8a8072;text-align:center}',
    '.iklan-modal .iklan-label{display:block;margin-bottom:2px}',
    '@media(max-width:420px){.iklan-aksi{display:none}.iklan-judul{white-space:normal;',
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}'
  ].join('');
  document.head.appendChild(gaya);

  /* ---------------- bantuan ---------------- */
  function kirim(aksi, id) {
    try {
      var badan = JSON.stringify({ aksi: aksi, id: id });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('./iklan.php', new Blob([badan], { type: 'application/json' }));
      } else {
        fetch('./iklan.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: badan, keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* hitungan tidak penting */ }
  }

  function srcGambar(g) {
    if (!g) { return ''; }
    if (/^https?:\/\//i.test(g)) { return g; }
    return './' + String(g).replace(/^\.?\//, '');
  }

  /* ---------------- bangun bilah ---------------- */
  function buatBilah() {
    var bilah = document.createElement('div');
    bilah.className = 'iklan-bilah';
    bilah.setAttribute('role', 'complementary');
    bilah.setAttribute('aria-label', 'Iklan');

    bilah.innerHTML =
      '<button type="button" class="iklan-tutup" aria-label="Tutup iklan">&times;</button>' +
      '<button type="button" class="iklan-isi">' +
        '<img class="iklan-gambar" alt="" loading="lazy">' +
        '<span class="iklan-teks">' +
          '<span class="iklan-label">Iklan &middot; <span class="iklan-pemesan"></span></span>' +
          '<span class="iklan-judul"></span>' +
        '</span>' +
        '<span class="iklan-aksi">Lihat</span>' +
      '</button>';

    document.body.appendChild(bilah);
    return bilah;
  }

  /* ---------------- modal ---------------- */
  function buatModal() {
    var m = document.createElement('div');
    m.className = 'iklan-modal';
    m.hidden = true;

    m.innerHTML =
      '<div class="iklan-tirai"></div>' +
      '<div class="iklan-dialog" role="dialog" aria-modal="true" aria-labelledby="iklan-h">' +
        '<button type="button" class="iklan-x" aria-label="Tutup">&times;</button>' +
        '<span class="iklan-label">Iklan &middot; <span class="iklan-pemesan"></span></span>' +
        '<img class="iklan-poster" alt="">' +
        '<h2 class="iklan-h" id="iklan-h"></h2>' +
        '<p class="iklan-p"></p>' +
        '<a class="iklan-cta" target="_blank" rel="noopener sponsored nofollow"></a>' +
        '<p class="iklan-kecil">Dipasang oleh <span class="iklan-kecil-nama"></span></p>' +
      '</div>';

    document.body.appendChild(m);
    return m;
  }

  /* ---------------- alur ---------------- */
  function mulai(daftar) {
    if (!daftar.length) { return; }

    var bilah = buatBilah();
    var modal = buatModal();
    var elGambar = bilah.querySelector('.iklan-gambar');
    var elJudul = bilah.querySelector('.iklan-judul');
    var elPemesan = bilah.querySelector('.iklan-pemesan');
    var indeks = 0;
    var aktif = daftar[0];
    var terakhirDilihat = '';

    function tampilkan(ik, hitung) {
      aktif = ik;
      bagian(ik);
      if (hitung && ik.id !== terakhirDilihat) {
        terakhirDilihat = ik.id;
        kirim('tayangan', ik.id);
      }
    }

    function bagian(ik) {
      elJudul.textContent = ik.judul || 'Iklan';
      elPemesan.textContent = ik.pemesan || (ik.jenis === 'sponsor' ? 'Sponsor' : 'Pemasang iklan');

      var src = srcGambar(ik.gambar);
      if (src) {
        elGambar.src = src;
        elGambar.alt = ik.judul || '';
        elGambar.style.display = '';
      } else {
        elGambar.removeAttribute('src');
        elGambar.style.display = 'none';
      }
    }

    function pasangTinggi() {
      var tinggi = bilah.offsetHeight;
      document.documentElement.style.setProperty('--iklan-tinggi', tinggi + 'px');
      document.body.classList.add('iklan-ada');
    }

    function bukaModal() {
      var ik = aktif;
      kirim('dilihat', ik.id);

      modal.querySelector('.iklan-pemesan').textContent = elPemesan.textContent;
      modal.querySelector('.iklan-h').textContent = ik.judul || 'Iklan';
      modal.querySelector('.iklan-p').textContent = ik.isi || '';

      var poster = modal.querySelector('.iklan-poster');
      var src = srcGambar(ik.gambar);
      if (src) {
        poster.src = src;
        poster.alt = ik.judul || '';
        poster.style.display = '';
      } else {
        poster.removeAttribute('src');
        poster.style.display = 'none';
      }

      var cta = modal.querySelector('.iklan-cta');
      if (ik.tautan) {
        cta.href = ik.tautan;
        cta.textContent = ik.cta || 'Kunjungi situs';
        cta.style.display = '';
      } else {
        cta.removeAttribute('href');
        cta.style.display = 'none';
      }

      modal.querySelector('.iklan-kecil-nama').textContent =
        ik.pemesan || (ik.jenis === 'sponsor' ? 'Sponsor' : 'Pemasang iklan');

      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      var tombolX = modal.querySelector('.iklan-x');
      if (tombolX) { tombolX.focus(); }
    }

    function tutupModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    /* tombol tutup bilah */
    bilah.querySelector('.iklan-tutup').addEventListener('click', function (e) {
      e.stopPropagation();
      bilah.classList.remove('tampil');
      document.body.classList.remove('iklan-ada');
      document.documentElement.style.setProperty('--iklan-tinggi', '0px');
      try { sessionStorage.setItem(KUNCI_SEMBUNYI, '1'); } catch (err) {}
      setTimeout(function () { if (bilah.parentNode) { bilah.parentNode.removeChild(bilah); } }, 300);
    });

    /* klik isi bilah -> tampilan pemasang iklan */
    bilah.querySelector('.iklan-isi').addEventListener('click', bukaModal);

    /* modal */
    modal.querySelector('.iklan-tirai').addEventListener('click', tutupModal);
    modal.querySelector('.iklan-x').addEventListener('click', tutupModal);
    modal.querySelector('.iklan-cta').addEventListener('click', function () {
      kirim('klik', aktif.id);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) { tutupModal(); }
    });

    tampilkan(daftar[0], true);
    pasangTinggi();
    window.addEventListener('resize', pasangTinggi);

    setTimeout(function () { bilah.classList.add('tampil'); }, 900);

    /* putar iklan bila lebih dari satu */
    if (daftar.length > 1) {
      setInterval(function () {
        if (modal.hidden === false) { return; }
        indeks = (indeks + 1) % daftar.length;
        bilah.style.opacity = '0';
        setTimeout(function () {
          tampilkan(daftar[indeks], true);
          bilah.style.opacity = '1';
        }, 220);
      }, JEDA_PUTAR);
    }
  }

  /* ---------------- muat data ---------------- */
  function muat() {
    fetch('./iklan.php', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.iklan) || !j.iklan.length) { return; }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () { mulai(j.iklan); });
        } else {
          mulai(j.iklan);
        }
      })
      .catch(function () {});
  }

  muat();
})();
