-- =============================================
-- TECONEX — Schema completo de base de datos
-- Ejecuta esto en Supabase SQL Editor
-- =============================================

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- =============================================
-- CATEGORÍAS
-- =============================================
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  icon text,
  image_url text,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

insert into categories (name, slug, icon, image_url) values
  ('Aire Acondicionado', 'aire-acondicionado', '❄️', 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400'),
  ('Plomería', 'plomeria', '🔧', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'),
  ('Electricidad', 'electricidad', '⚡', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400'),
  ('Limpieza', 'limpieza', '🧹', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400'),
  ('Mudanzas', 'mudanzas', '📦', 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400'),
  ('Pintura', 'pintura', '🖌️', 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=400'),
  ('Construcción', 'construccion', '🏗️', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400'),
  ('Carpintería', 'carpinteria', '🪚', 'https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=400'),
  ('Jardinería', 'jardineria', '🌿', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'),
  ('Ayuda Digital', 'ayuda-digital', '💻', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400'),
  ('Mover Muebles', 'mover-muebles', '🛋️', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'),
  ('Asistencia Personal', 'asistencia-personal', '🤝', 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400')
on conflict (slug) do nothing;

-- =============================================
-- PERFILES DE USUARIO
-- =============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  whatsapp text,
  zone text,
  bio text,
  role text default 'client' check (role in ('client', 'tasker', 'both', 'admin')),
  is_business boolean default false,
  business_name text,
  ruc text,
  tier text default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  completion_rate numeric default 0,
  avg_rating numeric default 0,
  total_reviews int default 0,
  total_completed int default 0,
  earnings_30d numeric default 0,
  is_verified boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TAREAS
-- =============================================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  poster_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category_id uuid references categories(id),
  budget numeric,
  location_text text,
  location_zone text,
  lat numeric,
  lng numeric,
  is_remote boolean default false,
  date_type text check (date_type in ('specific', 'before', 'flexible')) default 'flexible',
  task_date date,
  time_preference text check (time_preference in ('morning', 'afternoon', 'evening', 'anytime')) default 'anytime',
  images text[] default '{}',
  status text default 'open' check (status in ('open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed')),
  offers_count int default 0,
  views_count int default 0,
  whatsapp_created boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- OFERTAS
-- =============================================
create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade not null,
  tasker_id uuid references profiles(id) on delete cascade not null,
  price numeric not null,
  message text,
  estimated_time text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz default now(),
  unique(task_id, tasker_id)
);

-- =============================================
-- CONTRATOS (cuando se acepta una oferta)
-- =============================================
create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) not null,
  offer_id uuid references offers(id) not null,
  poster_id uuid references profiles(id) not null,
  tasker_id uuid references profiles(id) not null,
  agreed_price numeric not null,
  connection_fee numeric default 0,
  service_fee_pct numeric default 20,
  payment_status text default 'pending' check (payment_status in ('pending', 'held', 'released', 'refunded', 'disputed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- MENSAJES
-- =============================================
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references contracts(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  content text not null,
  is_whatsapp boolean default false,
  read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- RESEÑAS
-- =============================================
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references contracts(id) not null,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  overall_rating int check (overall_rating between 1 and 5),
  communication int check (communication between 1 and 5),
  punctuality int check (punctuality between 1 and 5),
  detail_quality int check (detail_quality between 1 and 5),
  efficiency int check (efficiency between 1 and 5),
  text text,
  is_published boolean default false,
  created_at timestamptz default now(),
  unique(contract_id, reviewer_id)
);

-- =============================================
-- NOTIFICACIONES
-- =============================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table offers enable row level security;
alter table contracts enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;
alter table categories enable row level security;

-- Profiles: cualquiera puede ver, solo tú editas el tuyo
create policy "profiles_public_read" on profiles for select using (true);
create policy "profiles_own_update" on profiles for update using (auth.uid() = id);
create policy "profiles_own_insert" on profiles for insert with check (auth.uid() = id);

-- Categories: solo lectura pública
create policy "categories_public_read" on categories for select using (true);

-- Tasks: lectura pública, solo el dueño crea/edita
create policy "tasks_public_read" on tasks for select using (true);
create policy "tasks_own_insert" on tasks for insert with check (auth.uid() = poster_id);
create policy "tasks_own_update" on tasks for update using (auth.uid() = poster_id);

-- Offers: técnico ve sus propias, poster ve las de su tarea
create policy "offers_read" on offers for select using (
  auth.uid() = tasker_id or
  auth.uid() = (select poster_id from tasks where id = task_id)
);
create policy "offers_insert" on offers for insert with check (auth.uid() = tasker_id);
create policy "offers_update" on offers for update using (
  auth.uid() = tasker_id or
  auth.uid() = (select poster_id from tasks where id = task_id)
);

-- Contracts: solo las partes involucradas
create policy "contracts_read" on contracts for select using (
  auth.uid() = poster_id or auth.uid() = tasker_id
);
create policy "contracts_insert" on contracts for insert with check (auth.uid() = poster_id);
create policy "contracts_update" on contracts for update using (
  auth.uid() = poster_id or auth.uid() = tasker_id
);

-- Messages: solo las partes del contrato
create policy "messages_read" on messages for select using (
  auth.uid() = sender_id or
  auth.uid() = (select poster_id from contracts where id = contract_id) or
  auth.uid() = (select tasker_id from contracts where id = contract_id)
);
create policy "messages_insert" on messages for insert with check (
  auth.uid() = sender_id
);

-- Reviews: lectura pública si publicada
create policy "reviews_public_read" on reviews for select using (is_published = true);
create policy "reviews_own_read" on reviews for select using (auth.uid() = reviewer_id);
create policy "reviews_insert" on reviews for insert with check (auth.uid() = reviewer_id);

-- Notifications: solo el dueño
create policy "notifications_own" on notifications for all using (auth.uid() = user_id);

-- =============================================
-- FUNCIÓN: crear perfil al registrarse
-- =============================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- FUNCIÓN: actualizar contador de ofertas
-- =============================================
create or replace function update_offers_count()
returns trigger as $$
begin
  update tasks set offers_count = (
    select count(*) from offers
    where task_id = coalesce(new.task_id, old.task_id)
    and status = 'pending'
  )
  where id = coalesce(new.task_id, old.task_id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_offer_change
  after insert or update or delete on offers
  for each row execute procedure update_offers_count();

-- =============================================
-- REALTIME: activar para chat y notificaciones
-- =============================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table offers;
