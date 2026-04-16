-- 🗄️ جداول منصة شراع (PostgreSQL/Supabase)
-- انسخ هذا الكود ونفّذه في: https://app.supabase.com/project/YOUR_ID/sql/editor

-- 1. جدول المستخدمين
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('client','driver','store','admin')) DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول السائقين/المندوبين
CREATE TABLE drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  vehicle_type TEXT,
  plate_number TEXT,
  is_online BOOLEAN DEFAULT false,
  current_lat FLOAT,
  current_lng FLOAT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول المتاجر
CREATE STORES (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT,
  location POINT,
  is_active BOOLEAN DEFAULT true
);

-- 4. جدول الطلبات
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),
  store_id UUID REFERENCES stores(id),
  type TEXT CHECK (type IN ('taxi','delivery','shopping')),
  status TEXT CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')) DEFAULT 'pending',
  pickup_lat FLOAT,
  pickup_lng FLOAT,
  dropoff_lat FLOAT,
  dropoff_lng FLOAT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. تفعيل Row Level Security (أمان)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
