# FokusTrack v3.0 Max (PWA + Sistem Pengingat & Alarm Otomatis)

FokusTrack v3.0 Max adalah pembaruan penuh yang dirancang tetap setia pada konsep awal yang tenang dan fokus, namun diperkaya dengan sistem pengingat alarm real-time, kendali lengkap langsung di Beranda, dan instalasi Layar Beranda HP (PWA).

## Pembaruan Utama di v3.0 Max
1. **Perbaikan Bug Streak Konsistensi (`0` Sebelum Dimulai)**:
   - Menghapus data palsu/residu yang membuat streak langsung tertulis `4` saat pengguna belum memulai konsistensi.
   - Streak kini dimulai murni dari `0 hari beruntun` dengan status `"Belum dimulai"`, dan hanya bertambah setelah pengguna menyelesaikan minimal 1 sesi fokus atau 1 tugas terjadwal secara nyata.
   - Tersedia tombol **Reset Streak (0)** dan **Reset Semua Data** di menu pengaturan Dompet.
2. **Beranda All-in-One & Pasang ke Layar Beranda HP**:
   - **Banner Pasang ke Layar Beranda**: Instal langsung ke Layar Utama Android/iOS agar ikon FokusTrack muncul di beranda HP dan dapat dibuka sekali ketuk.
   - **Aksi Cepat 4-in-1 di Beranda**: Tambah jadwal + alarm, mulai fokus 25 menit, catat pengeluaran, dan catat pemasukan langsung dari Beranda tanpa berpindah tab.
   - **Kartu Pengingat Berikutnya & Live Timer Mini-Bar**: Pantau hitung mundur kegiatan berikutnya dan timer fokus aktif langsung dari Beranda.
3. **Sistem Pengingat, Notifikasi & Alarm Kegiatan**:
   - Setel waktu pengingat per kegiatan (`tepat waktu`, `5`, `10`, `15`, `30`, atau `60 menit sebelum`) dan mode pengingat (`Alarm + Notifikasi`, `Nada Lembut + Notifikasi`, atau `Visual Saja`).
   - **Alarm Overlay Prioritas Tinggi** dengan suara alarm Web Audio berulang, getaran HP, notifikasi sistem browser/PWA, serta tombol **Mulai Fokus**, **Tunda 5 Menit (Snooze)**, dan **Matikan Alarm**.
   - **Pusat Pengingat (ikon lonceng di bilah atas)** untuk mengaktifkan izin notifikasi dan melakukan **Tes Alarm & Notifikasi** kapan saja.

## Cara Menjalankan
```bash
npm install
npm run dev
```
