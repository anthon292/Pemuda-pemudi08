# Kas Keuangan RT 08

Website statis untuk pencatatan kas RT dengan Supabase Auth, PostgreSQL RLS, dan ekspor PDF.

## Isi proyek
- `index.html` — struktur halaman
- `styles.css` — desain responsif
- `app.js` — login, dashboard, transaksi, ekspor PDF
- `supabase.sql` — tabel, trigger profil, dan kebijakan RLS

## 1. Siapkan database
1. Buka Supabase Dashboard lalu pilih proyek.
2. Masuk ke SQL Editor > New query.
3. Salin seluruh isi `supabase.sql`, lalu jalankan.
4. Periksa hasil query dan kebijakan RLS di Table Editor.

## 2. Konfigurasi aplikasi
1. Buka `app.js`.
2. Ganti `GANTI_DENGAN_PROJECT_URL` dengan Project URL dari Project Settings > API.
3. Ganti `GANTI_DENGAN_PUBLISHABLE_ATAU_ANON_KEY` dengan publishable key (atau anon key lama) dari pengaturan API.
4. Jangan pernah menggunakan `service_role` atau secret key di browser.

## 3. Buat akun admin
1. Buat akun pertama melalui Supabase Authentication > Users > Add user (atau melalui alur pembuatan akun tepercaya).
2. Pastikan trigger membuat baris profil di `profiles`.
3. Salin UUID user dari Authentication > Users.
4. Jalankan di SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin', nama = 'Nama Bendahara'
   where id = 'UUID-AKUN-ADMIN';
   ```
5. Ulangi pembuatan akun untuk warga. Semua akun baru otomatis mendapat role `warga`.

Jangan buat fitur publik yang mengizinkan pengguna mengubah role. Jangan memberikan akses SQL Editor kepada warga.

## 4. Jalankan / deploy
Cara paling sederhana:
- Uji lokal dengan server statis, misalnya ekstensi Live Server di VS Code.
- Unggah empat file utama (`index.html`, `styles.css`, `app.js`) ke repositori GitHub.
- Deploy repositori tersebut ke Netlify atau layanan static hosting yang mendukung HTTPS.
- Karena key publishable/anon ada di browser, keamanan wajib bergantung pada RLS. Ini normal untuk aplikasi Supabase.

## 5. Pengujian wajib sebelum dipakai
- Login sebagai warga: bisa melihat transaksi, tidak dapat menambah/mengubah/menghapus.
- Login sebagai admin: bisa menambah, mengubah, dan menghapus.
- Pengguna yang belum login: tidak bisa membaca transaksi melalui aplikasi.
- PDF periode tertentu hanya memuat transaksi dalam periode itu.
- Uji pada HP dan komputer.

## Catatan
- Aplikasi ini adalah starter project, bukan audit keamanan atau sistem pembukuan bersertifikat.
- Saldo kartu ringkasan menunjukkan seluruh periode; filter bulan hanya memfilter tabel dan PDF.
- Saldo berjalan pada tabel dihitung dalam urutan transaksi yang ditampilkan. Untuk laporan formal, tentukan kebijakan saldo awal dan periode pelaporan RT.
- Pustaka JavaScript dimuat dari CDN sehingga perlu koneksi internet.
