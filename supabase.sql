-- KAS KEUANGAN RT 08
-- Jalankan di Supabase Dashboard > SQL Editor.
-- Jalankan di proyek baru/bersih. Periksa nama kebijakan jika tabel sudah ada.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null default 'warga' check (role in ('admin', 'warga')),
  created_at timestamptz not null default now()
);

create table if not exists public.transaksi_kas (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  jenis text not null check (jenis in ('pemasukan', 'pengeluaran')),
  kategori text not null,
  keterangan text not null,
  jumlah numeric(15,2) not null check (jumlah > 0),
  dibuat_oleh uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transaksi_kas enable row level security;

-- Profil: pengguna hanya dapat membaca profilnya sendiri.
drop policy if exists "Pengguna melihat profil sendiri" on public.profiles;
create policy "Pengguna melihat profil sendiri"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

-- Fungsi admin menggunakan tabel profiles. Pengguna biasa tidak diberi
-- hak INSERT/UPDATE/DELETE pada profiles, sehingga tidak dapat menaikkan role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Transaksi hanya dapat dibaca pengguna yang sudah login.
drop policy if exists "Publik dapat melihat transaksi" on public.transaksi_kas;
drop policy if exists "Warga login dapat melihat transaksi" on public.transaksi_kas;
create policy "Warga login dapat melihat transaksi"
on public.transaksi_kas for select to authenticated
using (true);

drop policy if exists "Admin dapat menambah transaksi" on public.transaksi_kas;
create policy "Admin dapat menambah transaksi"
on public.transaksi_kas for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admin dapat mengedit transaksi" on public.transaksi_kas;
create policy "Admin dapat mengedit transaksi"
on public.transaksi_kas for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin dapat menghapus transaksi" on public.transaksi_kas;
create policy "Admin dapat menghapus transaksi"
on public.transaksi_kas for delete to authenticated
using (public.is_admin());

-- Pastikan tidak ada akses anon ke tabel dan pengguna tidak bisa mengubah profil.
revoke all on public.transaksi_kas from anon;
revoke all on public.transaksi_kas from authenticated;
grant select, insert, update, delete on public.transaksi_kas to authenticated;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- Membuat profil otomatis untuk akun baru dengan peran warga.
-- Nama awal berasal dari metadata saat akun dibuat; dapat disunting oleh admin
-- lewat SQL tepercaya jika perlu.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nama', ''), split_part(new.email, '@', 1), 'Warga'),
    'warga'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Periksa grants dan policies di Supabase Dashboard setelah menjalankan skrip.
-- Jangan menaruh service_role key di app.js atau repo GitHub publik.

-- LANGKAH AKTIVASI ADMIN (jalankan SETELAH akun admin dibuat melalui Supabase Auth):
-- 1. Supabase Dashboard > Authentication > Users, salin UUID akun admin.
-- 2. Jalankan query berikut dengan UUID asli:
-- update public.profiles set role = 'admin', nama = 'Nama Bendahara'
-- where id = 'GANTI-DENGAN-UUID-AKUN-ADMIN';
