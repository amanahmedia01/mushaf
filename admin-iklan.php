<?php
/**
 * Panel admin iklan/sponsor Mushaf Al-Qubba.
 *
 *   /admin-iklan.php          -> masuk, lalu daftar iklan + statistik
 *   /admin-iklan.php?aksi=baru|ubah&id=...
 *
 * Kata sandi disimpan sebagai hash di /var/www/iklan-mushaf/rahasia.json
 * (di luar docroot) dan dibuat oleh skrip pemasangan.
 */
declare(strict_types=1);

require __DIR__ . '/iklan-lib.php';

ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'secure'   => !empty($_SERVER['HTTPS']),
    'samesite' => 'Lax',
]);
session_start();

/* ---------------- kata sandi ---------------- */

function rahasia_muat(): array
{
    if (!is_file(IKLAN_RAHASIA)) {
        return [];
    }

    $d = json_decode((string) @file_get_contents(IKLAN_RAHASIA), true);

    return is_array($d) ? $d : [];
}

function sudah_masuk(): bool
{
    return !empty($_SESSION['iklan_admin']);
}

function csrf(): string
{
    if (empty($_SESSION['iklan_csrf'])) {
        $_SESSION['iklan_csrf'] = bin2hex(random_bytes(16));
    }

    return $_SESSION['iklan_csrf'];
}

function csrf_cocok($v): bool
{
    return is_string($v) && !empty($_SESSION['iklan_csrf']) && hash_equals($_SESSION['iklan_csrf'], $v);
}

/* batasi percobaan masuk */
function boleh_coba(): bool
{
    $dir = IKLAN_DIR . '/hits';
    if (!is_dir($dir)) { @mkdir($dir, 0755, true); }

    $f = $dir . '/masuk-' . sha1((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0')) . '.txt';
    $data = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    $sekarang = time();

    if (!is_array($data) || ($sekarang - (int) ($data['mulai'] ?? 0)) > 900) {
        $data = ['mulai' => $sekarang, 'n' => 0];
    }

    if ((int) $data['n'] >= 8) {
        return false;
    }

    $data['n'] = (int) $data['n'] + 1;
    @file_put_contents($f, json_encode($data), LOCK_EX);

    return true;
}

/* ---------------- unggah gambar ---------------- */

function simpan_gambar(array $f): array
{
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['', ''];
    }

    if (($f['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        return ['', 'Gagal mengunggah gambar.'];
    }

    if ((int) ($f['size'] ?? 0) > 2 * 1024 * 1024) {
        return ['', 'Gambar maksimal 2 MB.'];
    }

    $info = @getimagesize((string) $f['tmp_name']);

    if (!$info) {
        return ['', 'Berkas itu bukan gambar.'];
    }

    $izin = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF  => 'gif',
    ];

    if (!isset($izin[$info[2]])) {
        return ['', 'Format gambar harus JPG, PNG, WEBP, atau GIF.'];
    }

    if (!is_dir(IKLAN_GAMBAR) && !@mkdir(IKLAN_GAMBAR, 0755, true)) {
        return ['', 'Folder gambar tidak bisa dibuat.'];
    }

    $nama = 'ik-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $izin[$info[2]];

    if (!@move_uploaded_file((string) $f['tmp_name'], IKLAN_GAMBAR . '/' . $nama)) {
        return ['', 'Gambar gagal disimpan.'];
    }

    @chmod(IKLAN_GAMBAR . '/' . $nama, 0644);

    return [IKLAN_GAMBAR_URL . '/' . $nama, ''];
}

/* ---------------- tangani aksi ---------------- */

$galat = '';
$pesan = (string) ($_GET['pesan'] ?? '');

if (!empty($_GET['keluar'])) {
    $_SESSION = [];
    @session_regenerate_id(true);
    session_destroy();
    header('Location: admin-iklan.php');
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && ($_POST['aksi'] ?? '') === 'masuk') {
    $r = rahasia_muat();

    if (!boleh_coba()) {
        $galat = 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.';
    } elseif (empty($r['sandi_hash'])) {
        $galat = 'Berkas kata sandi belum dibuat.';
    } elseif (!csrf_cocok($_POST['csrf'] ?? null)) {
        $galat = 'Sesi kedaluwarsa. Muat ulang halaman.';
    } else {
        $sandi = (string) ($_POST['sandi'] ?? '');

        if (password_verify($sandi, (string) $r['sandi_hash'])) {
            session_regenerate_id(true);
            $_SESSION['iklan_admin'] = (string) ($r['pengguna'] ?? 'admin');
            @unlink(IKLAN_DIR . '/hits/masuk-' . sha1((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0')) . '.txt');
            header('Location: admin-iklan.php');
            exit;
        }

        $galat = 'Kata sandi salah.';
    }
}

if (sudah_masuk() && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $aksi = (string) ($_POST['aksi'] ?? '');

    if (!csrf_cocok($_POST['csrf'] ?? null)) {
        $galat = 'Sesi kedaluwarsa. Muat ulang halaman.';
    } elseif ($aksi === 'simpan') {
        $id = (string) ($_POST['id'] ?? '');
        $data = iklan_muat();
        $lama = $id !== '' ? iklan_cari($data, $id) : null;

        [$gambar, $galatGambar] = simpan_gambar((array) ($_FILES['gambar'] ?? []));

        if ($galatGambar !== '') {
            $galat = $galatGambar;
        } else {
            $urlGambar = (string) ($_POST['gambar_url'] ?? '');

            if ($gambar === '' && $urlGambar !== '' && preg_match('~^https?://~i', $urlGambar) === 1) {
                $gambar = $urlGambar;
            }

            if ($gambar === '' && $lama) {
                $gambar = (string) ($lama['gambar'] ?? '');
            }

            $baris = [
                'id'       => $lama ? (string) $lama['id'] : iklan_id(),
                'judul'    => iklan_teks($_POST['judul'] ?? '', 120),
                'pemesan'  => iklan_teks($_POST['pemesan'] ?? '', 80),
                'isi'      => iklan_teks($_POST['isi'] ?? '', 600),
                'gambar'   => $gambar,
                'tautan'   => iklan_url_aman((string) ($_POST['tautan'] ?? '')),
                'cta'      => iklan_teks($_POST['cta'] ?? '', 40),
                'jenis'    => ($_POST['jenis'] ?? 'iklan') === 'sponsor' ? 'sponsor' : 'iklan',
                'aktif'    => !empty($_POST['aktif']),
                'mulai'    => preg_match('~^\d{4}-\d{2}-\d{2}$~', (string) ($_POST['mulai'] ?? '')) ? (string) $_POST['mulai'] : '',
                'selesai'  => preg_match('~^\d{4}-\d{2}-\d{2}$~', (string) ($_POST['selesai'] ?? '')) ? (string) $_POST['selesai'] : '',
                'urutan'   => max(0, (int) ($_POST['urutan'] ?? 0)),
                'dibuat'   => $lama ? (string) ($lama['dibuat'] ?? date('c')) : date('c'),
                'tayangan' => $lama ? (int) ($lama['tayangan'] ?? 0) : 0,
                'dilihat'  => $lama ? (int) ($lama['dilihat'] ?? 0) : 0,
                'klik'     => $lama ? (int) ($lama['klik'] ?? 0) : 0,
            ];

            if ($baris['judul'] === '') {
                $galat = 'Judul iklan wajib diisi.';
            } else {
                $ketemu = false;

                foreach ($data['iklan'] as $i => $ik) {
                    if ((string) ($ik['id'] ?? '') === $baris['id']) {
                        $data['iklan'][$i] = $baris;
                        $ketemu = true;
                        break;
                    }
                }

                if (!$ketemu) {
                    $data['iklan'][] = $baris;
                }

                if (iklan_tulis($data)) {
                    header('Location: admin-iklan.php?pesan=' . urlencode($lama ? 'Iklan diperbarui.' : 'Iklan ditambahkan.'));
                    exit;
                }

                $galat = 'Gagal menyimpan data iklan.';
            }
        }
    } elseif ($aksi === 'hapus') {
        $id = (string) ($_POST['id'] ?? '');
        $data = iklan_muat();
        $data['iklan'] = array_values(array_filter($data['iklan'], static function ($ik) use ($id) {
            return (string) ($ik['id'] ?? '') !== $id;
        }));

        if (iklan_tulis($data)) {
            header('Location: admin-iklan.php?pesan=' . urlencode('Iklan dihapus.'));
            exit;
        }

        $galat = 'Gagal menghapus.';
    } elseif ($aksi === 'alih') {
        $id = (string) ($_POST['id'] ?? '');
        $data = iklan_muat();

        foreach ($data['iklan'] as $i => $ik) {
            if ((string) ($ik['id'] ?? '') === $id) {
                $data['iklan'][$i]['aktif'] = empty($ik['aktif']);
                break;
            }
        }

        if (iklan_tulis($data)) {
            header('Location: admin-iklan.php?pesan=' . urlencode('Status diubah.'));
            exit;
        }

        $galat = 'Gagal mengubah status.';
    }
}

/* ---------------- data untuk tampilan ---------------- */

$data = iklan_muat();
$semua = array_reverse($data['iklan']);
$aktifnya = iklan_aktif($data['iklan']);

$ubah = null;

if (sudah_masuk() && ($_GET['aksi'] ?? '') === 'ubah') {
    $ubah = iklan_cari($data, (string) ($_GET['id'] ?? ''));
}

function e($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

/* ---------------- tampilan ---------------- */
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin Iklan — Mushaf Al-Qubba</title>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{
  --hijau:#14503f; --hijau-terang:#1f6b53; --hijau-muda:#e6f0eb;
  --krem:#f3efe6; --krem-tua:#e0d9c9; --tinta:#23201a; --tinta-lembut:#6b6152;
  --merah:#b4342b; --radius:14px;
}
body{
  margin:0; background:var(--krem); color:var(--tinta);
  font-family:"Segoe UI",Tahoma,Arial,system-ui,sans-serif; font-size:15px; line-height:1.6;
}
.wadah{max-width:960px; margin:0 auto; padding:22px 18px 60px}
a{color:var(--hijau-terang)}
h1{font-size:21px; margin:0 0 4px; letter-spacing:-.01em}
h2{font-size:16px; margin:0 0 12px}
.kecil{font-size:13px; color:var(--tinta-lembut)}
.bar-atas{display:flex; align-items:center; gap:12px; margin-bottom:20px; flex-wrap:wrap}
.bar-atas .kanan{margin-left:auto; display:flex; gap:8px; align-items:center}
.kartu{background:#fff; border:1px solid var(--krem-tua); border-radius:var(--radius); padding:18px; margin-bottom:16px; box-shadow:0 1px 2px rgba(60,45,20,.05)}
.tombol{
  display:inline-block; padding:10px 16px; border-radius:10px; border:0; cursor:pointer;
  background:var(--hijau); color:#fff; font-weight:700; font-size:14px; text-decoration:none; font-family:inherit;
}
.tombol:hover{background:var(--hijau-terang)}
.tombol.abub{background:#fff; color:var(--tinta-lembut); border:1px solid var(--krem-tua)}
.tombol.abub:hover{background:var(--krem); color:var(--tinta)}
.tombol.merah{background:#fff; color:var(--merah); border:1px solid #e6cfcb}
.tombol.merah:hover{background:#fbeeec}
.tombol.kecil2{padding:6px 11px; font-size:12.5px; border-radius:8px}
label{display:block; font-weight:600; font-size:13px; margin:0 0 5px}
input[type=text],input[type=date],input[type=number],input[type=password],textarea,select{
  width:100%; padding:10px 12px; border:1px solid var(--krem-tua); border-radius:10px;
  background:#fdfcf9; font-family:inherit; font-size:14px; color:var(--tinta);
}
input:focus,textarea:focus,select:focus{outline:2px solid var(--hijau-terang); outline-offset:1px}
textarea{min-height:92px; resize:vertical}
.baris{display:grid; gap:14px; grid-template-columns:1fr 1fr}
.baris.penuh{grid-template-columns:1fr}
@media(max-width:640px){.baris{grid-template-columns:1fr}}
.bidang{margin-bottom:14px}
.petunjuk{font-size:12px; color:var(--tinta-lembut); margin:4px 0 0}
table{width:100%; border-collapse:collapse; font-size:13.5px}
th,td{text-align:left; padding:9px 8px; border-bottom:1px solid var(--krem-tua); vertical-align:middle}
th{font-size:11.5px; text-transform:uppercase; letter-spacing:.6px; color:var(--tinta-lembut)}
tr:last-child td{border-bottom:0}
.mini{width:46px; height:46px; border-radius:8px; object-fit:cover; background:var(--hijau-muda); border:1px solid var(--krem-tua)}
.tanda{display:inline-block; padding:2px 8px; border-radius:999px; font-size:11.5px; font-weight:700}
.tanda.ya{background:var(--hijau-muda); color:var(--hijau)}
.tanda.tidak{background:#efeae0; color:var(--tinta-lembut)}
.angka{font-variant-numeric:tabular-nums}
.galat{background:#fbeeec; border:1px solid #e6cfcb; color:#8d2a22; padding:11px 14px; border-radius:10px; margin-bottom:14px; font-size:14px}
.sukses{background:var(--hijau-muda); border:1px solid #c9ded5; color:var(--hijau); padding:11px 14px; border-radius:10px; margin-bottom:14px; font-size:14px}
.kosong{text-align:center; padding:26px 10px; color:var(--tinta-lembut)}
.gulung{overflow-x:auto}
.catat{font-size:12px; color:var(--tinta-lembut); margin-top:10px}
</style>
</head>
<body>
<div class="wadah">

<?php if (!sudah_masuk()): ?>

  <div class="bar-atas">
    <div>
      <h1>Admin Iklan</h1>
      <div class="kecil">Mushaf Al-Qubba — kelola iklan &amp; sponsor</div>
    </div>
  </div>

  <?php if ($galat !== ''): ?><div class="galat"><?= e($galat) ?></div><?php endif; ?>

  <div class="kartu" style="max-width:400px">
    <h2>Masuk</h2>
    <form method="post" autocomplete="off">
      <input type="hidden" name="aksi" value="masuk">
      <input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
      <div class="bidang">
        <label for="sandi">Kata sandi</label>
        <input type="password" id="sandi" name="sandi" required autofocus autocomplete="current-password">
      </div>
      <button class="tombol" type="submit" style="width:100%">Masuk</button>
    </form>
    <p class="petunjuk">Belum punya kata sandi? Berkas <code>rahasia.json</code> dibuat saat pemasangan.</p>
  </div>

<?php else: ?>

  <div class="bar-atas">
    <div>
      <h1>Admin Iklan</h1>
      <div class="kecil">Masuk sebagai <?= e((string) ($_SESSION['iklan_admin'] ?? 'admin')) ?> &middot;
        <?= count($aktifnya) ?> tayang dari <?= count($semua) ?> iklan</div>
    </div>
    <div class="kanan">
      <a class="tombol abub kecil2" href="./" target="_blank" rel="noopener">Lihat situs</a>
      <a class="tombol abub kecil2" href="?keluar=1">Keluar</a>
    </div>
  </div>

  <?php if ($galat !== ''): ?><div class="galat"><?= e($galat) ?></div><?php endif; ?>
  <?php if ($pesan !== ''): ?><div class="sukses"><?= e($pesan) ?></div><?php endif; ?>

  <?php if (($GET_AKSI = ($_GET['aksi'] ?? '')) === 'baru' || $ubah): ?>
    <?php $f = $ubah ?: ['id'=>'','judul'=>'','pemesan'=>'','isi'=>'','gambar'=>'','tautan'=>'','cta'=>'Kunjungi situs','jenis'=>'iklan','aktif'=>1,'mulai'=>'','selesai'=>'','urutan'=>0]; ?>
    <div class="kartu">
      <h2><?= $ubah ? 'Ubah iklan' : 'Iklan baru' ?></h2>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="aksi" value="simpan">
        <input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
        <input type="hidden" name="id" value="<?= e($f['id'] ?? '') ?>">

        <div class="baris">
          <div>
            <label for="judul">Judul iklan *</label>
            <input type="text" id="judul" name="judul" required maxlength="120" value="<?= e($f['judul'] ?? '') ?>">
          </div>
          <div>
            <label for="pemesan">Nama pemasang / sponsor</label>
            <input type="text" id="pemesan" name="pemesan" maxlength="80" value="<?= e($f['pemesan'] ?? '') ?>">
          </div>
        </div>

        <div class="bidang">
          <label for="isi">Keterangan singkat</label>
          <textarea id="isi" name="isi" maxlength="600"><?= e($f['isi'] ?? '') ?></textarea>
          <p class="petunjuk">Muncul di tampilan saat iklan diklik.</p>
        </div>

        <div class="baris">
          <div>
            <label for="tautan">Tautan tujuan</label>
            <input type="text" id="tautan" name="tautan" maxlength="500" placeholder="https://contoh.com" value="<?= e($f['tautan'] ?? '') ?>">
          </div>
          <div>
            <label for="cta">Tulisan tombol</label>
            <input type="text" id="cta" name="cta" maxlength="40" value="<?= e($f['cta'] ?? 'Kunjungi situs') ?>">
          </div>
        </div>

        <div class="baris">
          <div>
            <label for="jenis">Jenis</label>
            <select id="jenis" name="jenis">
              <option value="iklan"<?= ($f['jenis'] ?? '') === 'iklan' ? ' selected' : '' ?>>Iklan</option>
              <option value="sponsor"<?= ($f['jenis'] ?? '') === 'sponsor' ? ' selected' : '' ?>>Sponsor</option>
            </select>
          </div>
          <div>
            <label for="urutan">Urutan tampil</label>
            <input type="number" id="urutan" name="urutan" min="0" max="999" value="<?= (int) ($f['urutan'] ?? 0) ?>">
          </div>
        </div>

        <div class="baris">
          <div>
            <label for="mulai">Mulai tayang</label>
            <input type="date" id="mulai" name="mulai" value="<?= e($f['mulai'] ?? '') ?>">
            <p class="petunjuk">Kosongkan untuk langsung tayang.</p>
          </div>
          <div>
            <label for="selesai">Berakhir</label>
            <input type="date" id="selesai" name="selesai" value="<?= e($f['selesai'] ?? '') ?>">
            <p class="petunjuk">Kosongkan untuk tanpa batas.</p>
          </div>
        </div>

        <div class="baris">
          <div>
            <label for="gambar">Unggah gambar (maks 2 MB)</label>
            <input type="file" id="gambar" name="gambar" accept="image/jpeg,image/png,image/webp,image/gif">
          </div>
          <div>
            <label for="gambar_url">atau URL gambar</label>
            <input type="text" id="gambar_url" name="gambar_url" placeholder="https://contoh.com/poster.jpg" value="">
          </div>
        </div>

        <?php if (!empty($f['gambar'])): ?>
          <div class="bidang">
            <label>Gambar sekarang</label>
            <img class="mini" style="width:88px;height:88px" src="./<?= e($f['gambar']) ?>" alt="">
          </div>
        <?php endif; ?>

        <div class="bidang">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin:0">
            <input type="checkbox" name="aktif" value="1" <?= !empty($f['aktif']) ? 'checked' : '' ?> style="width:auto">
            Aktifkan iklan ini
          </label>
        </div>

        <button class="tombol" type="submit">Simpan</button>
        <a class="tombol abub" href="admin-iklan.php">Batal</a>
      </form>
    </div>
  <?php endif; ?>

  <div class="kartu">
    <div class="bar-atas" style="margin-bottom:12px">
      <h2 style="margin:0">Daftar iklan</h2>
      <div class="kanan"><a class="tombol kecil2" href="?aksi=baru">+ Iklan baru</a></div>
    </div>

    <?php if (!$semua): ?>
      <div class="kosong">
        Belum ada iklan. Tekan <b>+ Iklan baru</b> untuk menambahkan.<br>
        <span class="kecil">Selama tidak ada iklan aktif, bilah iklan tidak muncul di situs.</span>
      </div>
    <?php else: ?>
      <div class="gulung">
        <table>
          <thead>
            <tr>
              <th>Gambar</th><th>Judul</th><th>Jenis</th><th>Status</th>
              <th class="angka">Tayang</th><th class="angka">Dilihat</th><th class="angka">Klik</th>
              <th>Masa</th><th></th>
            </tr>
          </thead>
          <tbody>
          <?php foreach ($semua as $ik): ?>
            <?php $g = (string) ($ik['gambar'] ?? ''); $srcG = $g === '' ? '' : (preg_match('~^https?://~i', $g) ? $g : './' . $g); ?>
            <tr>
              <td><?php if ($srcG !== ''): ?><img class="mini" src="<?= e($srcG) ?>" alt=""><?php else: ?><span class="kecil">—</span><?php endif; ?></td>
              <td>
                <b><?= e($ik['judul'] ?? '') ?></b>
                <?php if (!empty($ik['pemesan'])): ?><div class="kecil"><?= e($ik['pemesan']) ?></div><?php endif; ?>
              </td>
              <td class="kecil"><?= ($ik['jenis'] ?? 'iklan') === 'sponsor' ? 'Sponsor' : 'Iklan' ?></td>
              <td>
                <?php $nyala = !empty($ik['aktif']) && in_array($ik, $aktifnya, true); ?>
                <span class="tanda <?= $nyala ? 'ya' : 'tidak' ?>"><?= $nyala ? 'tayang' : (!empty($ik['aktif']) ? 'dijadwal' : 'nonaktif') ?></span>
              </td>
              <td class="angka"><?= (int) ($ik['tayangan'] ?? 0) ?></td>
              <td class="angka"><?= (int) ($ik['dilihat'] ?? 0) ?></td>
              <td class="angka"><?= (int) ($ik['klik'] ?? 0) ?></td>
              <td class="kecil">
                <?= e($ik['mulai'] ?? '') !== '' ? e($ik['mulai']) : '—' ?><br>
                <?= e($ik['selesai'] ?? '') !== '' ? e($ik['selesai']) : '—' ?>
              </td>
              <td style="white-space:nowrap">
                <a class="tombol abub kecil2" href="?aksi=ubah&amp;id=<?= e($ik['id'] ?? '') ?>">Ubah</a>
                <form method="post" style="display:inline">
                  <input type="hidden" name="aksi" value="alih">
                  <input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
                  <input type="hidden" name="id" value="<?= e($ik['id'] ?? '') ?>">
                  <button class="tombol abub kecil2" type="submit"><?= !empty($ik['aktif']) ? 'Matikan' : 'Nyalakan' ?></button>
                </form>
                <form method="post" style="display:inline" onsubmit="return confirm('Hapus iklan ini?')">
                  <input type="hidden" name="aksi" value="hapus">
                  <input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
                  <input type="hidden" name="id" value="<?= e($ik['id'] ?? '') ?>">
                  <button class="tombol merah kecil2" type="submit">Hapus</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <p class="catat">
        <b>Tayang</b> = bilah iklan tampil. <b>Dilihat</b> = pengunjung mengklik bilah.
        <b>Klik</b> = pengunjung menekan tombol tujuan. Angka dibatasi agar tidak bisa digelembungkan.
      </p>
    <?php endif; ?>
  </div>

<?php endif; ?>

</div>
</body>
</html>
