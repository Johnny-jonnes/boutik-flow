/**
 * Types TypeScript stricts — BoutikFlow
 * Interdiction d'utiliser `any` dans tout le projet.
 */

// ─── Auth ────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'freemium' | 'starter' | 'pro';
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'staff' | 'admin';
  is_active: boolean;
  tenant: Tenant;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  boutique_slug: string;
}

export interface RegisterRequest {
  boutique_name: string;
  boutique_slug: string;
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}

// ─── CRM Clients ─────────────────────────────────────────────────────────

export type ClientStatus = 'nouveau' | 'actif' | 'vip' | 'inactif';

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  status: ClientStatus;
  tags: string[];
  notes: string | null;
  birthday: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  name: string;
  phone: string;
  email?: string;
  status?: ClientStatus;
  tags?: string[];
  notes?: string;
  birthday?: string;
}

export interface ClientUpdate extends Partial<ClientCreate> {}

// ─── CRM Segments ────────────────────────────────────────────────────────

export interface Segment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  client_count: number;
  created_at: string;
  updated_at: string;
}

export interface SegmentCreate {
  name: string;
  description?: string;
  filters?: Record<string, any>;
}

export interface SegmentUpdate extends Partial<SegmentCreate> {}

// ─── Catégories ───────────────────────────────────────────────────────────

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
  image_url?: string;
}

export interface CategoryUpdate extends Partial<CategoryCreate> {}

// ─── Produits ─────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category_id: string | null;
  category_rel: Category | null;
  images: string[];
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  price: number;
  stock?: number;
  description?: string;
  category_id?: string;
  images?: string[];
  is_available?: boolean;
}

// ─── Commandes ────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface Order {
  id: string;
  tenant_id: string;
  client_id: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  items: OrderItem[];
  client?: Client;
  created_at: string;
  updated_at: string;
}

export interface OrderCreate {
  client_id: string;
  items: { product_id: string; quantity: number }[];
  notes?: string;
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────

export interface DashboardKPIs {
  total_revenue: number;
  total_orders: number;
  total_clients: number;
  active_clients: number;
  vip_clients: number;
  pending_orders: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

// ─── API Response ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface APIError {
  detail: string;
  status_code?: number;
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────

export type MessageDirection = 'inbound' | 'outbound';

export interface WhatsAppMessage {
  id: string;
  tenant_id: string;
  client_id: string | null;
  direction: MessageDirection;
  content: string;
  message_type: string;
  status: string;
  created_at: string;
  client?: Client;
}

// ─── Analytics ────────────────────────────────────────────────────────────

export interface RevenueChartPoint {
  name: string;
  value: number;
}

export interface OrderChartPoint {
  name: string;
  commandes: number;
  livrees: number;
}

export interface TopProductPoint {
  name: string;
  ventes: number;
  revenue: number;
}

export interface ClientSegmentPoint {
  name: string;
  value: number;
  color: string;
}

export interface AnalyticsKPIs {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  conversion_rate: number;
  revenue_change: string;
  orders_change: string;
  aov_change: string;
  conversion_change: string;
}

export interface AnalyticsData {
  kpis: AnalyticsKPIs;
  revenue_data: RevenueChartPoint[];
  orders_data: OrderChartPoint[];
  top_products: TopProductPoint[];
  client_segments: ClientSegmentPoint[];
}

// ─── Campagnes Marketing ────────────────────────────────────────────────────

export type CampaignChannel = 'whatsapp' | 'sms' | 'email';
export type CampaignStatus = 'brouillon' | 'programmee' | 'envoyee' | 'echouee';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  segment_id: string | null;
  channel: CampaignChannel;
  message: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignCreate {
  name: string;
  segment_id?: string;
  channel: CampaignChannel;
  message: string;
  status?: CampaignStatus;
  scheduled_at?: string;
}

export interface CampaignUpdate extends Partial<CampaignCreate> {}

// ─── Admin ────────────────────────────────────────────────────────────────────

export type TenantStatus = 'pending' | 'active' | 'blocked' | 'rejected';
export type TenantPlan = 'freemium' | 'starter' | 'pro';

export interface AdminStats {
  total_tenants: number;
  pending_tenants: number;
  active_tenants: number;
  blocked_tenants: number;
  rejected_tenants: number;
  total_users: number;
  unread_notifications: number;
}

export interface AdminTenantOwner {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminTenantListItem {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  is_active: boolean;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
}

export interface AdminTenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  is_active: boolean;
  whatsapp_phone_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner: AdminTenantOwner | null;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedAdminTenants {
  items: AdminTenantListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
