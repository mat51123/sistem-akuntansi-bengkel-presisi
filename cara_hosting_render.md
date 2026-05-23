# Panduan Hosting Gratis di Render.com - Bengkel Presisi

Dokumen ini berisi panduan praktis untuk meng-hosting sistem akuntansi Bengkel Presisi secara gratis di Render.com menggunakan database **SQLite** (praktis dan langsung jalan) atau **MySQL** (untuk jangka panjang).

---

## OPSI A: Menggunakan SQLite (Paling Mudah & Langsung Jalan)

Opsi ini sangat cocok untuk demo presentasi UAS karena tidak membutuhkan setting database cloud tambahan.

### Langkah 1: Upload Kode ke GitHub
1. Masuk ke akun [GitHub](https://github.com/) Anda.
2. Buat repositori baru dengan nama `sistem-akuntansi-bengkel-presisi` (pilih **Public** atau **Private**).
3. Jalankan perintah git ini di terminal VSCode komputer Anda untuk mengunggah berkas:
   ```bash
   git init
   git add .
   git commit -m "commit awal sistem akuntansi"
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/sistem-akuntansi-bengkel-presisi.git
   git push -u origin main
   ```
   *(Ganti `USERNAME_ANDA` dengan username GitHub Anda).*

### Langkah 2: Hubungkan ke Render.com
1. Masuk ke [Render.com](https://render.com/) menggunakan akun GitHub Anda.
2. Di dashboard Render, klik tombol **New +** lalu pilih **Web Service**.
3. Hubungkan repositori GitHub `sistem-akuntansi-bengkel-presisi` yang baru saja Anda buat.

### Langkah 3: Konfigurasi Deployment di Render
Isi formulir dengan detail berikut:
* **Name**: `bengkel-presisi` (atau nama lain)
* **Region**: `Singapore` (terdekat dengan Indonesia)
* **Branch**: `main`
* **Runtime**: `Node`
* **Build Command**: `npm install && npm run build`
* **Start Command**: `npm start`
* **Instance Type**: Pilih **Free** ($0/month)

### Langkah 4: Aktifkan Disk Storage (PENTING untuk SQLite)
Karena Render free tier akan menghapus database SQLite (`bengkel.db`) setiap kali server tidur/restart, Anda wajib menambahkan disk persistent (opsional tapi disarankan agar data tidak hilang):
1. Di menu navigasi layanan Render Anda, pilih tab **Disk**.
2. Klik **Add Disk**.
3. Isi konfigurasi Disk:
   * **Name**: `bengkel-disk`
   * **Mount Path**: `/data`
   * **Size**: `1 GB` (cukup untuk menyimpan jutaan transaksi)
4. Buka berkas `.env` atau atur Environment Variable di Render:
   * `DATABASE_URL` = `/data/bengkel.db` (sesuaikan path database di kode jika Anda menggunakan path dinamis).
   *(Catatan: Jika hanya untuk demo singkat presentasi UAS, Anda bisa melewati langkah Disk Storage ini dan langsung deploy).*

---

## OPSI B: Menggunakan MySQL Cloud (Rekomendasi Jangka Panjang)

Jika Anda ingin data transaksi tersimpan permanen dan terhubung ke phpMyAdmin/MySQL online.

### Langkah 1: Buat Database MySQL Gratis di Aiven
1. Daftar akun di [Aiven.io](https://aiven.io/).
2. Buat layanan baru (**Create Service**), pilih **MySQL**, lalu pilih paket **Free Tier**.
3. Setelah aktif, salin informasi koneksi berikut:
   * **Host** (Host URI)
   * **Port**
   * **User** (biasanya `avnadmin`)
   * **Password**
   * **Database Name** (default: `defaultdb`)

### Langkah 2: Hubungkan GitHub & Render
1. Upload kode ke GitHub (seperti Langkah 1 pada Opsi A).
2. Buat **Web Service** baru di Render (seperti Langkah 2 & 3 pada Opsi A).

### Langkah 3: Masukkan Environment Variables di Render
Di halaman pengaturan Render, masuk ke tab **Environment** dan klik **Add Environment Variable**. Tambahkan variabel berikut berdasarkan data dari Aiven:

| Key | Value |
| :--- | :--- |
| `DB_HOST` | *Host dari Aiven (contoh: mysql-xxx.aivencloud.com)* |
| `DB_USER` | `avnadmin` |
| `DB_PASSWORD` | *Password dari Aiven* |
| `DB_NAME` | `defaultdb` |
| `DB_PORT` | *Port dari Aiven (contoh: 12345)* |

### Langkah 4: Klik Deploy!
Render akan otomatis menginstal paket, melakukan kompilasi, dan menghubungkan aplikasi ke MySQL cloud Anda. Aplikasi juga akan otomatis membuatkan tabel `pengguna` dan mengisi akun admin (`admin` / `admin123`) di database MySQL cloud tersebut pada saat pertama kali berjalan!
