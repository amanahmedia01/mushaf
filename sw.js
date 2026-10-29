/* Mushaf Al-Qubba — service worker.
   Tujuan: aplikasi bisa dipasang di layar utama, halaman yang sudah pernah
   dibuka tetap bisa dibaca tanpa internet, dan pengguna dapat mengunduh
   SELURUH 604 halaman (mode luring penuh) lewat tombol "Unduh semua". */

var VERSI = 'mushaf-v32';

/* Service worker tidak punya alamat dasar dokumen, jadi alamat relatif
   harus dijadikan mutlak dulu supaya Request/fetch/cache tidak gagal. */
function mutlak(u) { return new URL(u, self.location.href).href; }
var DAFTAR = './daftar-berkas.json';

/* Berkas inti yang disimpan lebih dulu supaya aplikasi tetap terbuka tanpa jaringan. */
var INTI = [
  "./",
  "./daftar-halaman.html",
  "./bagikan.html",
  "./daftar-berkas.json",
  "./qrcode.min.js",
  "./manifest.webmanifest",
  "./swipe.js",
  "./jari-kursor-96.png",
  "./ikon/ikon-192.png",
  "./ikon/ikon-512.png",
  "./ikon/ikon-maskable-512.png",
  "./ikon/apple-touch-icon.png",
  "./ikon/favicon-32.png",
  "./fonts/aqqc5a.woff",
  "./img/kover-bersih.jpg",
  "./borderatas.jpg",
  "./bordertengah.jpg",
  "./borderbawah.jpg"
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(VERSI).then(function (c) {
      return Promise.all(INTI.map(function (u) {
        return c.add(new Request(mutlak(u), { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nama) {
      return Promise.all(nama.map(function (n) {
        return n !== VERSI ? caches.delete(n) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---------------- unduh seluruh mushaf untuk mode luring ---------------- */

function bacaDaftar() {
  return fetch(DAFTAR, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

function kirim(sumber, data) {
  if (sumber && typeof sumber.postMessage === 'function') {
    try { sumber.postMessage(data); } catch (e) {}
  }
}

function unduhSemua(sumber) {
  caches.open(VERSI).then(function (c) {
    return bacaDaftar().then(function (daftar) {
      if (!daftar || !daftar.berkas || !daftar.berkas.length) {
        kirim(sumber, { tipe: 'UNDUH_GAGAL', pesan: 'Daftar berkas tidak terbaca.' });
        return;
      }

      var antre = daftar.berkas.slice();
      var total = antre.length;
      var selesai = 0;
      var gagal = 0;
      var laporTerakhir = 0;

      function lapor(paksa) {
        var sekarang = Date.now();
        if (paksa || sekarang - laporTerakhir > 250) {
          laporTerakhir = sekarang;
          kirim(sumber, { tipe: 'KEMAJUAN', selesai: selesai, gagal: gagal, total: total });
        }
      }

      function pekerja() {
        if (!antre.length) { return Promise.resolve(); }
        var u = antre.shift();
        return c.match(mutlak(u)).then(function (ada) {
          if (ada) { return null; }
          return fetch(new Request(mutlak(u), { cache: 'reload' })).then(function (r) {
            if (r && r.ok) { return c.put(mutlak(u), r); }
            gagal++;
          }).catch(function () { gagal++; });
        }).catch(function () { gagal++; }).then(function () {
          selesai++;
          lapor(false);
          return pekerja();
        });
      }

      var pekerjaan = [];
      var jumlahParalel = 4;
      for (var i = 0; i < jumlahParalel; i++) { pekerjaan.push(pekerja()); }

      return Promise.all(pekerjaan).then(function () {
        lapor(true);
        kirim(sumber, { tipe: 'UNDUH_SELESAI', selesai: selesai, gagal: gagal, total: total });
      });
    });
  }).catch(function (e) {
    kirim(sumber, { tipe: 'UNDUH_GAGAL', pesan: String(e && e.message || e) });
  });
}

function statusUnduh(sumber) {
  Promise.all([caches.open(VERSI), bacaDaftar()]).then(function (hasil) {
    var c = hasil[0];
    var daftar = hasil[1];
    if (!daftar || !daftar.berkas) {
      kirim(sumber, { tipe: 'STATUS', selesai: 0, total: 0 });
      return;
    }
    return c.keys().then(function (kunci) {
      var ada = {};
      kunci.forEach(function (r) {
        try { ada[new URL(r.url).pathname] = true; } catch (e) {}
      });
      var selesai = 0;
      daftar.berkas.forEach(function (u) {
        var p = u.replace(/^\./, '');
        if (ada[p]) { selesai++; }
      });
      kirim(sumber, {
        tipe: 'STATUS',
        selesai: selesai,
        total: daftar.berkas.length,
        totalByte: daftar.total_byte || 0,
        versi: daftar.versi || ''
      });
    });
  }).catch(function () {
    kirim(sumber, { tipe: 'STATUS', selesai: 0, total: 0 });
  });
}

function hapusUnduhan(sumber) {
  caches.delete(VERSI).then(function () {
    return caches.open(VERSI).then(function (c) {
      return Promise.all(INTI.map(function (u) {
        return c.add(new Request(mutlak(u), { cache: 'reload' })).catch(function () { return null; });
      }));
    });
  }).then(function () {
    kirim(sumber, { tipe: 'UNDUHAN_DIHAPUS' });
  });
}

self.addEventListener('message', function (ev) {
  var d = ev.data;

  if (d === 'lewati-tunggu') { self.skipWaiting(); return; }
  if (!d || typeof d !== 'object') { return; }

  if (d.tipe === 'UNDUH_SEMUA') { unduhSemua(ev.source); }
  if (d.tipe === 'STATUS_UNDUH') { statusUnduh(ev.source); }
  if (d.tipe === 'HAPUS_UNDUHAN') { hapusUnduhan(ev.source); }
});

/* ---------------- strategi pengambilan berkas ---------------- */

function simpanDiLatar(permintaan, jawaban) {
  if (!jawaban || jawaban.status !== 200 || jawaban.type === 'opaque') { return jawaban; }
  var salinan = jawaban.clone();
  caches.open(VERSI).then(function (c) { c.put(permintaan, salinan); });
  return jawaban;
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') { return; }

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { return; }

  // Halaman: coba jaringan dulu supaya pembaruan terasa, kalau luring pakai salinan.
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then(function (jawaban) {
        simpanDiLatar(req, jawaban.clone());
        return jawaban;
      }).catch(function () {
        return caches.match(req).then(function (ada) {
          return ada || caches.match('./daftar-halaman.html');
        });
      })
    );
    return;
  }

  // Berkas lain: salinan lebih dulu, lalu perbarui di latar belakang.
  ev.respondWith(
    caches.match(req).then(function (ada) {
      var dariJaringan = fetch(req).then(function (jawaban) {
        simpanDiLatar(req, jawaban.clone());
        return jawaban;
      }).catch(function () { return ada; });
      return ada || dariJaringan;
    })
  );
});

