<?php
/**
 * Menerima catatan pembaca Mushaf Al-Qubba.
 *
 *   POST  application/json  { id, juz, halaman, berkas, jenis, isi, nama, kontak, ayat, dibuat }
 *         -> { ok: true, id: "...", tersimpan: <jumlah> }
 *
 *   GET   ?token=<token>&batas=<n>   (untuk pemilik; token dibaca dari berkas token.txt)
 *         -> { ok: true, jumlah: N, catatan: [ ... ] }
 *
 * Catatan disimpan sebagai JSON Lines DI LUAR docroot:
 *   <induk docroot>/catatan-mushaf/catatan.jsonl
 *
 * Bila permintaan tidak datang ke server utama (mis. lewat tunnel dari komputer lain),
 * catatan ikut diteruskan ke server utama supaya semua catatan terkumpul di satu tempat.
 */
declare(strict_types=1);

const JENIS_SAH = ['cerita', 'koreksi', 'pengalaman', 'lainnya'];
const MAKS_ISI = 4000;
const MAKS_BADAN = 32768;      // 32 KB
const MAKS_PER_JAM = 30;
const TUJUAN_UTAMA = 'https://mushaf.103-253-213-113.sslip.io/catatan.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$dir = dirname(__DIR__) . '/catatan-mushaf';
$berkas = $dir . '/catatan.jsonl';

function balas(int $kode, array $isi): void
{
    http_response_code($kode);
    echo json_encode($isi, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function teks($v, int $maks): string
{
    $s = is_string($v) ? $v : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
    if ($s === null) { $s = ''; }
    $s = trim($s);
    $s = function_exists('mb_substr') ? mb_substr($s, 0, $maks) : substr($s, 0, $maks);
    return $s;
}

function bulat($v): int
{
    return is_numeric($v) ? (int) $v : 0;
}

function hitungBaris(string $berkas): int
{
    if (!is_file($berkas)) { return 0; }
    $n = 0;
    $fp = @fopen($berkas, 'rb');
    if ($fp === false) { return 0; }
    while (!feof($fp)) { fgets($fp); $n++; }
    fclose($fp);
    return max(0, $n - 1);
}

/* Jejak ringkas untuk penelusuran masalah (tanpa isi catatan). */
function jejak(string $teks): void
{
    global $dir;
    $berkas = $dir . '/jejak.log';
    if (is_file($berkas) && filesize($berkas) > 200000) { @rename($berkas, $berkas . '.lama'); }
    @file_put_contents($berkas, date('c') . ' ' . $teks . "\n", FILE_APPEND | LOCK_EX);
}

$metode = $_SERVER['REQUEST_METHOD'] ?? '';

/* ---------------- GET publik: catatan yang boleh dibaca semua pengguna ---------------- */
if ($metode === 'GET' && isset($_GET['publik'])) {
    $batas = bulat($_GET['batas'] ?? 100);
    if ($batas < 1) { $batas = 100; }
    if ($batas > 200) { $batas = 200; }

    // Salinan lokal (tunnel) mengambil daftar dari server utama supaya isinya sama.
    $berkasTujuan = $dir . '/tujuan.txt';
    $tujuan = is_file($berkasTujuan) ? trim((string) file_get_contents($berkasTujuan)) : '';
    if ($tujuan !== '' && function_exists('curl_init')) {
        $ch = curl_init($tujuan . '?publik=1&batas=' . $batas);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT => 'MushafCatatan/1.0',
        ]);
        $hasil = curl_exec($ch);
        $kode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($kode === 200 && is_string($hasil) && strpos($hasil, '"ok":true') !== false) {
            jejak('publik: diambil dari server utama, ' . strlen($hasil) . ' bita');
            header('X-Mushaf-Sumber: utama');
            echo $hasil;
            exit;
        }
        jejak('publik: gagal mengambil dari server utama (kode ' . $kode . '), pakai catatan lokal');
    }

    $semua = [];
    if (is_file($berkas)) {
        foreach (file($berkas, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $baris) {
            $satu = json_decode($baris, true);
            if (!is_array($satu)) { continue; }
            if (isset($satu['tampil']) && $satu['tampil'] === false) { continue; }
            $semua[] = [
                'id' => $satu['id'] ?? '',
                'diterima' => $satu['diterima'] ?? '',
                'juz' => $satu['juz'] ?? 0,
                'halaman' => $satu['halaman'] ?? 0,
                'berkas' => $satu['berkas'] ?? '',
                'jenis' => $satu['jenis'] ?? 'lainnya',
                'isi' => $satu['isi'] ?? '',
                'nama' => $satu['nama'] ?? '',
                'ayat' => $satu['ayat'] ?? null,
                // kontak, ip, dan agen TIDAK pernah ikut pada daftar publik
            ];
        }
    }
    header('X-Mushaf-Sumber: lokal');
    balas(200, ['ok' => true, 'jumlah' => count($semua), 'catatan' => array_slice($semua, -$batas)]);
}

/* ---------------- GET: ringkasan lengkap untuk pemilik ---------------- */
if ($metode === 'GET') {
    $berkasToken = $dir . '/token.txt';
    $token = is_file($berkasToken) ? trim((string) file_get_contents($berkasToken)) : '';
    $kirim = (string) ($_GET['token'] ?? '');
    if ($token === '' || $kirim === '' || !hash_equals($token, $kirim)) {
        balas(403, ['ok' => false, 'pesan' => 'Perlu token yang benar']);
    }
    $semua = [];
    if (is_file($berkas)) {
        foreach (file($berkas, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $baris) {
            $satu = json_decode($baris, true);
            if (is_array($satu)) { $semua[] = $satu; }
        }
    }
    $batas = bulat($_GET['batas'] ?? 200);
    if ($batas < 1) { $batas = 200; }
    if ($batas > 500) { $batas = 500; }
    balas(200, ['ok' => true, 'jumlah' => count($semua), 'catatan' => array_slice($semua, -$batas)]);
}

if ($metode !== 'POST') {
    balas(405, ['ok' => false, 'pesan' => 'Hanya POST atau GET']);
}

/* ---------------- POST: simpan catatan baru ---------------- */
$panjang = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($panjang > MAKS_BADAN) { balas(413, ['ok' => false, 'pesan' => 'Terlalu besar']); }

$mentah = file_get_contents('php://input', false, null, 0, MAKS_BADAN + 1);
if ($mentah === false || $mentah === '') { balas(400, ['ok' => false, 'pesan' => 'Badan kosong']); }
if (strlen($mentah) > MAKS_BADAN) { balas(413, ['ok' => false, 'pesan' => 'Terlalu besar']); }

$data = json_decode($mentah, true);
if (!is_array($data)) { balas(400, ['ok' => false, 'pesan' => 'JSON tidak sah']); }

$isi = teks($data['isi'] ?? '', MAKS_ISI);
if ($isi === '') { balas(422, ['ok' => false, 'pesan' => 'Catatan masih kosong']); }

$jenis = teks($data['jenis'] ?? '', 20);
if (!in_array($jenis, JENIS_SAH, true)) { $jenis = 'lainnya'; }

$ayat = null;
if (isset($data['ayat']) && is_array($data['ayat'])) {
    $surat = bulat($data['ayat']['surat'] ?? 0);
    if ($surat > 0) {
        $ayat = [
            'surat' => $surat,
            'ayat' => bulat($data['ayat']['ayat'] ?? 0),
            'baris' => bulat($data['ayat']['baris'] ?? 0),
            'kata' => teks($data['ayat']['kata'] ?? '', 80),
        ];
    }
}

$catatan = [
    'id' => teks($data['id'] ?? '', 60) ?: bin2hex(random_bytes(8)),
    'diterima' => date('c'),
    'juz' => bulat($data['juz'] ?? 0),
    'halaman' => bulat($data['halaman'] ?? 0),
    'berkas' => teks($data['berkas'] ?? '', 60),
    'jenis' => $jenis,
    'isi' => $isi,
    'nama' => teks($data['nama'] ?? '', 80),
    'kontak' => teks($data['kontak'] ?? '', 80),
    'ayat' => $ayat,
    'dibuat' => teks($data['dibuat'] ?? '', 30),
    'ip' => substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|mushaf'), 0, 12),
    'agen' => teks($_SERVER['HTTP_USER_AGENT'] ?? '', 120),
];

if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
if (!is_dir($dir) || !is_writable($dir)) {
    balas(500, ['ok' => false, 'pesan' => 'Penyimpanan belum siap']);
}

$kunciRate = $dir . '/rate-' . substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('YmdH')), 0, 16) . '.txt';
$jumlah = is_file($kunciRate) ? (int) file_get_contents($kunciRate) : 0;
if ($jumlah >= MAKS_PER_JAM) {
    balas(429, ['ok' => false, 'pesan' => 'Terlalu banyak kiriman, coba lagi nanti']);
}
@file_put_contents($kunciRate, (string) ($jumlah + 1), LOCK_EX);

$fp = @fopen($berkas, 'ab');
if ($fp === false) { balas(500, ['ok' => false, 'pesan' => 'Gagal menyimpan']); }
flock($fp, LOCK_EX);
fwrite($fp, json_encode($catatan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
flock($fp, LOCK_UN);
fclose($fp);

/* Teruskan ke server utama HANYA bila diminta secara eksplisit lewat berkas
 * catatan-mushaf/tujuan.txt (berisi URL endpoint utama). Salinan utama TIDAK punya
 * berkas itu, jadi tidak mungkin saling-meneruskan (dulu sempat terjadi putaran). */
$tuan = $_SERVER['HTTP_HOST'] ?? '';
$berkasTujuan = $dir . '/tujuan.txt';
$tujuan = is_file($berkasTujuan) ? trim((string) file_get_contents($berkasTujuan)) : '';
$sudahTerusan = isset($_SERVER['HTTP_X_MUSHAF_ASAL']);
$diteruskan = false;

jejak(sprintf('host=%s ip=%s ua=%s tujuan=%s terusan=%s',
    $tuan, $catatan['ip'], $catatan['agen'] === '' ? '-' : substr($catatan['agen'], 0, 30),
    $tujuan === '' ? '-' : 'ada', $sudahTerusan ? 'ya' : 'tidak'));

if ($tujuan !== '' && !$sudahTerusan && function_exists('curl_init')) {
    $ch = curl_init($tujuan);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($catatan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Mushaf-Asal: terusan'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_USERAGENT => 'MushafCatatan/1.0',
    ]);
    $hasil = curl_exec($ch);
    $kode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $diteruskan = ($kode === 200 && is_string($hasil) && strpos($hasil, '"ok":true') !== false);
    jejak('terusan -> ' . $tujuan . ' kode=' . $kode . ' hasil=' . ($diteruskan ? 'ok' : 'gagal'));
}

balas(200, [
    'ok' => true,
    'id' => $catatan['id'],
    'tersimpan' => hitungBaris($berkas),
    'diteruskan' => $diteruskan,
]);
