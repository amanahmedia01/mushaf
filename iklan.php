<?php
/**
 * Endpoint publik iklan/sponsor Mushaf.
 *
 *   GET  -> { ok: true, iklan: [ ... ] }
 *   POST application/json { aksi: "tayangan"|"dilihat"|"klik", id: "ik-xxxx" }
 *        -> { ok: true, dihitung: true|false }
 */
declare(strict_types=1);

require __DIR__ . '/iklan-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function balas(int $kode, array $isi): void
{
    http_response_code($kode);
    echo json_encode($isi, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$metode = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($metode === 'GET') {
    $data = iklan_muat();
    $daftar = [];

    foreach (iklan_aktif($data['iklan']) as $ik) {
        $daftar[] = [
            'id'      => (string) ($ik['id'] ?? ''),
            'jenis'   => (string) ($ik['jenis'] ?? 'iklan'),
            'judul'   => (string) ($ik['judul'] ?? ''),
            'pemesan' => (string) ($ik['pemesan'] ?? ''),
            'isi'     => (string) ($ik['isi'] ?? ''),
            'gambar'  => (string) ($ik['gambar'] ?? ''),
            'tautan'  => (string) ($ik['tautan'] ?? ''),
            'cta'     => (string) ($ik['cta'] ?? ''),
        ];
    }

    balas(200, ['ok' => true, 'iklan' => $daftar]);
}

if ($metode !== 'POST') {
    balas(405, ['ok' => false, 'pesan' => 'metode tidak didukung']);
}

$masukan = json_decode((string) file_get_contents('php://input'), true);

if (!is_array($masukan)) {
    balas(400, ['ok' => false, 'pesan' => 'badan tidak sah']);
}

$aksi = (string) ($masukan['aksi'] ?? '');
$id   = (string) ($masukan['id'] ?? '');

if (!in_array($aksi, ['tayangan', 'dilihat', 'klik'], true) || $id === '') {
    balas(400, ['ok' => false, 'pesan' => 'permintaan tidak sah']);
}

balas(200, ['ok' => true, 'dihitung' => iklan_hitung($id, $aksi)]);
