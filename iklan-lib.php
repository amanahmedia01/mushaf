<?php
/**
 * Pustaka bersama iklan/sponsor Mushaf Al-Qubba.
 *
 * Data disimpan sebagai JSON di LUAR docroot:
 *   /var/www/iklan-mushaf/iklan.json
 * Gambar unggahan disimpan di dalam docroot agar bisa disajikan langsung:
 *   /var/www/mushaf/iklan/
 */
declare(strict_types=1);

const IKLAN_DIR     = __DIR__ . '/../iklan-mushaf';
const IKLAN_BERKAS  = IKLAN_DIR . '/iklan.json';
const IKLAN_RAHASIA = IKLAN_DIR . '/rahasia.json';
const IKLAN_GAMBAR  = __DIR__ . '/iklan';
const IKLAN_GAMBAR_URL = 'iklan';
const IKLAN_MAKS    = 20;
const IKLAN_MULAI   = '06:00';   // jam mulai tayang tiap hari

/* ---------- baca / tulis ---------- */

function iklan_muat(): array
{
    if (!is_file(IKLAN_BERKAS)) {
        return ['iklan' => []];
    }

    $raw = @file_get_contents(IKLAN_BERKAS);
    $data = json_decode((string) $raw, true);

    if (!is_array($data) || !isset($data['iklan']) || !is_array($data['iklan'])) {
        return ['iklan' => []];
    }

    return $data;
}

function iklan_tulis(array $data): bool
{
    if (!is_dir(IKLAN_DIR)) {
        @mkdir(IKLAN_DIR, 0755, true);
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        return false;
    }

    $tmp = IKLAN_BERKAS . '.tmp';

    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }

    return @rename($tmp, IKLAN_BERKAS);
}

/* ---------- penyaring ---------- */

function iklan_aktif(array $semua): array
{
    $hari  = date('Y-m-d');
    $hasil = [];

    foreach ($semua as $ik) {
        if (empty($ik['aktif'])) {
            continue;
        }
        if (!empty($ik['mulai']) && (string) $ik['mulai'] > $hari) {
            continue;
        }
        if (!empty($ik['selesai']) && (string) $ik['selesai'] < $hari) {
            continue;
        }
        $hasil[] = $ik;
    }

    usort($hasil, static function (array $a, array $b): int {
        $oa = (int) ($a['urutan'] ?? 0);
        $ob = (int) ($b['urutan'] ?? 0);

        if ($oa !== $ob) {
            return $oa <=> $ob;
        }

        return strcmp((string) ($b['dibuat'] ?? ''), (string) ($a['dibuat'] ?? ''));
    });

    return $hasil;
}

/* ---------- hitungan tayang / lihat / klik ---------- */

function iklan_hitung(string $id, string $jenis): bool
{
    if (!in_array($jenis, ['tayangan', 'dilihat', 'klik'], true)) {
        return false;
    }

    // Batasi agar satu pengunjung tidak bisa menggelembungkan angka.
    if (!iklan_boleh_hitung($id, $jenis)) {
        return false;
    }

    $kunciBerkas = IKLAN_DIR . '/iklan.lock';
    $fp = @fopen($kunciBerkas, 'c');

    if ($fp === false) {
        return false;
    }

    flock($fp, LOCK_EX);

    $data = iklan_muat();
    $ketemu = false;

    foreach ($data['iklan'] as $i => $ik) {
        if ((string) ($ik['id'] ?? '') === $id) {
            $data['iklan'][$i][$jenis] = (int) ($ik[$jenis] ?? 0) + 1;
            $ketemu = true;
            break;
        }
    }

    if ($ketemu) {
        iklan_tulis($data);
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    return $ketemu;
}

function iklan_boleh_hitung(string $id, string $jenis): bool
{
    $dir = IKLAN_DIR . '/hits';

    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    // jendela 30 menit per pengunjung per iklan per jenis
    $jendela = $jenis === 'tayangan' ? 3600 : 1800;
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $berkas = $dir . '/' . sha1($ip . '|' . $jenis . '|' . $id) . '.txt';
    $sekarang = time();

    if (is_file($berkas) && ($sekarang - (int) @filemtime($berkas)) < $jendela) {
        return false;
    }

    @touch($berkas);

    // Bersihkan sesekali agar folder tidak menumpuk.
    if (random_int(1, 50) === 1) {
        $batas = $sekarang - 86400;
        foreach ((array) @glob($dir . '/*.txt') as $f) {
            if ((int) @filemtime($f) < $batas) {
                @unlink($f);
            }
        }
    }

    return true;
}

/* ---------- bantuan ---------- */

function iklan_id(): string
{
    return 'ik-' . bin2hex(random_bytes(4));
}

function iklan_e($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

function iklan_teks($v, int $maks): string
{
    $s = is_string($v) ? $v : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    $s = trim($s);

    return function_exists('mb_substr') ? mb_substr($s, 0, $maks) : substr($s, 0, $maks);
}

function iklan_url_aman(string $u): string
{
    $u = trim($u);

    if ($u === '') {
        return '';
    }

    if (preg_match('~^https?://~i', $u) !== 1) {
        return '';
    }

    return $u;
}

function iklan_cari(array $data, string $id): ?array
{
    foreach ($data['iklan'] as $ik) {
        if ((string) ($ik['id'] ?? '') === $id) {
            return $ik;
        }
    }

    return null;
}
