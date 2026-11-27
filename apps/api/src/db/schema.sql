PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('consumer','merchant','courier','admin')),
  avatar_url TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  email_verified INTEGER NOT NULL DEFAULT 0, lgpd_consent_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, label TEXT NOT NULL,
  cep TEXT NOT NULL, street TEXT NOT NULL, number TEXT NOT NULL, complement TEXT, neighborhood TEXT NOT NULL,
  city TEXT NOT NULL, state TEXT NOT NULL, latitude REAL, longitude REAL, is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, icon TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS establishments (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', category_id TEXT REFERENCES categories(id), logo_url TEXT, cover_url TEXT,
  document TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, cep TEXT NOT NULL, street TEXT NOT NULL,
  number TEXT NOT NULL, complement TEXT, neighborhood TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
  latitude REAL, longitude REAL, delivery_fee_cents INTEGER NOT NULL DEFAULT 0, min_order_cents INTEGER NOT NULL DEFAULT 0,
  prep_time_min INTEGER NOT NULL DEFAULT 30, delivery_radius_km REAL NOT NULL DEFAULT 8,
  delivery_enabled INTEGER NOT NULL DEFAULT 1, pickup_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', open_hours TEXT NOT NULL DEFAULT '{}',
  commission_products_bps INTEGER NOT NULL DEFAULT 800, commission_delivery_bps INTEGER NOT NULL DEFAULT 800,
  rejection_reason TEXT, approved_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_est_status ON establishments(status);
CREATE INDEX IF NOT EXISTS idx_est_category ON establishments(category_id);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), image_url TEXT, available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0, prep_minutes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_est ON products(establishment_id, available);

CREATE TABLE IF NOT EXISTS product_option_groups (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL, min_selected INTEGER NOT NULL DEFAULT 0, max_selected INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_options (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, establishment_id TEXT REFERENCES establishments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')), value INTEGER NOT NULL, min_order_cents INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT, ends_at TEXT, usage_limit INTEGER, used_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), establishment_id TEXT NOT NULL REFERENCES establishments(id),
  address_id TEXT REFERENCES addresses(id), coupon_id TEXT REFERENCES coupons(id), status TEXT NOT NULL DEFAULT 'placed',
  subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL DEFAULT 0, delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT, payment_id TEXT, notes TEXT, cancellation_reason TEXT, courier_requested_at TEXT,
  created_at TEXT NOT NULL, accepted_at TEXT, delivered_at TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_est ON orders(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL, unit_price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL,
  options_snapshot TEXT NOT NULL DEFAULT '[]', notes TEXT, total_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, from_status TEXT, to_status TEXT NOT NULL,
  actor_id TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS couriers (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), document TEXT NOT NULL, vehicle TEXT NOT NULL,
  vehicle_plate TEXT, bank_info TEXT, status TEXT NOT NULL DEFAULT 'pending', online INTEGER NOT NULL DEFAULT 0,
  latitude REAL, longitude REAL, rating_avg REAL NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT, approved_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  courier_id TEXT REFERENCES couriers(id), status TEXT NOT NULL DEFAULT 'awaiting_courier',
  fee_cents INTEGER NOT NULL DEFAULT 0, distance_km REAL, offered_at TEXT, accepted_at TEXT, picked_at TEXT, delivered_at TEXT,
  version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id, status);

CREATE TABLE IF NOT EXISTS delivery_locations (
  id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  courier_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, order_id TEXT REFERENCES orders(id) ON DELETE CASCADE, type TEXT NOT NULL,
  customer_id TEXT REFERENCES users(id), merchant_id TEXT REFERENCES users(id), courier_id TEXT REFERENCES users(id),
  establishment_id TEXT REFERENCES establishments(id), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conv_merchant ON conversations(merchant_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, provider_payment_id TEXT, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, reply_json TEXT, raw_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, payment_id TEXT REFERENCES payments(id) ON DELETE CASCADE, order_id TEXT REFERENCES orders(id),
  type TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL, external_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  product_base_cents INTEGER NOT NULL, product_rate_bps INTEGER NOT NULL, product_commission_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL, delivery_rate_bps INTEGER NOT NULL, delivery_commission_cents INTEGER NOT NULL,
  platform_revenue_cents INTEGER NOT NULL, courier_payout_cents INTEGER NOT NULL, merchant_payout_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), recipient_id TEXT NOT NULL, recipient_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', external_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON payouts(recipient_id, recipient_type);
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), order_id TEXT NOT NULL REFERENCES orders(id),
  amount_cents INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', external_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(provider, event_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(order_id, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, PRIMARY KEY(user_id, establishment_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', read_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', response TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT, actor_role TEXT, action TEXT NOT NULL, target_type TEXT, target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}', ip TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until TEXT, updated_at TEXT NOT NULL
);
