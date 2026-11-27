/**
 * Contratos e regras puras compartilhadas entre API, web e mobile.
 * Nenhuma regra de negócio com efeito colateral vive aqui.
 */

export type Role = 'consumer' | 'merchant' | 'courier' | 'admin';
export type EstablishmentStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OrderStatus =
  | 'placed' | 'awaiting_confirmation' | 'accepted' | 'preparing' | 'awaiting_courier'
  | 'courier_to_store' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled' | 'failed';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'pix_manual';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'not_required';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Pedido realizado',
  awaiting_confirmation: 'Aguardando confirmação',
  accepted: 'Pedido aceito',
  preparing: 'Em preparação',
  awaiting_courier: 'Aguardando entregador',
  courier_to_store: 'Entregador a caminho do estabelecimento',
  picked_up: 'Pedido retirado',
  on_the_way: 'A caminho do cliente',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  failed: 'Falha no pedido',
};

export const ORDER_ACTIVE_STATUSES: OrderStatus[] = [
  'placed', 'awaiting_confirmation', 'accepted', 'preparing', 'awaiting_courier',
  'courier_to_store', 'picked_up', 'on_the_way',
];

export interface Address {
  id: string; label: string; cep: string; street: string; number: string;
  complement: string | null; neighborhood: string; city: string; state: string;
  latitude: number | null; longitude: number | null; is_default: boolean;
}

export interface Category { id: string; name: string; slug: string; icon: string; active: boolean; sort_order: number }
export interface ProductOption { id: string; group_id: string; name: string; price_cents: number; available: boolean }
export interface ProductOptionGroup { id: string; product_id: string; name: string; min_selected: number; max_selected: number; sort_order: number; options: ProductOption[] }
export interface Product {
  id: string; establishment_id: string; category_id: string | null; name: string; description: string;
  price_cents: number; image_url: string | null; available: boolean; sort_order: number; prep_minutes: number;
  groups?: ProductOptionGroup[];
}
export interface Establishment {
  id: string; owner_id: string; name: string; slug: string; description: string; category_id: string | null;
  logo_url: string | null; cover_url: string | null; phone: string; email: string; cep: string; street: string;
  number: string; complement: string | null; neighborhood: string; city: string; state: string;
  latitude: number | null; longitude: number | null; delivery_fee_cents: number; min_order_cents: number;
  prep_time_min: number; delivery_radius_km: number; delivery_enabled: boolean; pickup_enabled: boolean;
  status: EstablishmentStatus; open_hours: Record<string, { open: string; close: string; closed: boolean }>;
  rating_avg: number; rating_count: number; distance_km?: number; is_open?: boolean;
  created_at: string; category_name?: string;
}

export interface CartItem {
  key: string; product_id: string; name: string; unit_price_cents: number; quantity: number;
  options: { group_name: string; option_name: string; price_cents: number; option_id?: string }[];
  notes: string | null; image_url: string | null;
}

export interface CartTotals { subtotal_cents: number; discount_cents: number; delivery_fee_cents: number; total_cents: number }

export function itemUnitCents(item: CartItem): number {
  return item.unit_price_cents + item.options.reduce((sum, o) => sum + o.price_cents, 0);
}

export function calculateCartTotals(input: {
  items: CartItem[]; deliveryFeeCents: number; coupon?: { kind: 'percent' | 'fixed'; value: number } | null;
}): CartTotals {
  const subtotal_cents = input.items.reduce((sum, i) => sum + itemUnitCents(i) * i.quantity, 0);
  let discount_cents = 0;
  if (input.coupon) {
    discount_cents = input.coupon.kind === 'percent'
      ? Math.round(subtotal_cents * input.coupon.value / 100)
      : Math.round(input.coupon.value * 100);
    discount_cents = Math.min(Math.max(0, discount_cents), subtotal_cents);
  }
  const delivery_fee_cents = Math.max(0, input.deliveryFeeCents);
  return { subtotal_cents, discount_cents, delivery_fee_cents, total_cents: Math.max(0, subtotal_cents - discount_cents + delivery_fee_cents) };
}

/**
 * Comissão: 8% sobre valor elegível dos produtos (base = subtotal - desconto) e 8% sobre taxa de entrega.
 * Cada pedido gera no máximo UM lançamento de comissão (UNIQUE no banco).
 */
export interface CommissionInput { productBaseCents: number; deliveryFeeCents: number; productRateBps?: number; deliveryRateBps?: number }
export interface CommissionResult {
  productBaseCents: number; productRateBps: number; deliveryFeeCents: number; deliveryRateBps: number;
  productCommissionCents: number; deliveryCommissionCents: number;
  platformRevenueCents: number; courierPayoutCents: number; merchantPayoutCents: number;
}
export function calculateCommission(input: CommissionInput): CommissionResult {
  const productRateBps = input.productRateBps ?? 800;
  const deliveryRateBps = input.deliveryRateBps ?? 800;
  const productBaseCents = Math.max(0, Math.round(input.productBaseCents));
  const deliveryFeeCents = Math.max(0, Math.round(input.deliveryFeeCents));
  const productCommissionCents = Math.round(productBaseCents * productRateBps / 10000);
  const deliveryCommissionCents = Math.round(deliveryFeeCents * deliveryRateBps / 10000);
  return {
    productBaseCents, productRateBps, deliveryFeeCents, deliveryRateBps,
    productCommissionCents,
    deliveryCommissionCents,
    platformRevenueCents: productCommissionCents + deliveryCommissionCents,
    courierPayoutCents: deliveryFeeCents - deliveryCommissionCents,
    merchantPayoutCents: productBaseCents - productCommissionCents,
  };
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
export function formatDateBR(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6371, dLat = (bLat - aLat) * Math.PI / 180, dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}
export const CATEGORY_ICONS = ['hamburger', 'pizza', 'sandwich', 'ice-cream', 'pastel', 'utensils', 'soup', 'cake', 'coffee', 'shopping-bag'];
