/**
 * Client API BoutikFlow
 * ────────────────────────────────────────────────────────────────────────
 * Client HTTP typé pour l'API FastAPI (voir backend/app/modules/*).
 * - Base URL configurable via NEXT_PUBLIC_API_URL (fallback: localhost:8000)
 * - Injection automatique du Bearer token (localStorage)
 * - Rafraîchissement automatique du token sur 401 (une seule tentative)
 * - Extraction du message d'erreur FastAPI (`detail`)
 */
import type {
  LoginRequest,
  RegisterRequest,
  Client as CrmClient,
  ClientCreate,
  ClientUpdate,
  ClientStatus,
  Segment,
  SegmentCreate,
  SegmentUpdate,
  Category,
  CategoryCreate,
  CategoryUpdate,
  Product,
  ProductCreate,
  Order,
  OrderCreate,
  OrderStatus,
  DashboardKPIs,
  AnalyticsData,
  Campaign,
  CampaignCreate,
  CampaignUpdate,
  CampaignChannel,
  AdminStats,
  AdminTenantListItem,
  AdminTenantDetail,
  AdminNotification,
  PaginatedAdminTenants,
  TenantStatus,
  TenantPlan,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  TeamMember,
  InviteUserRequest,
  AuditLog,
  FinancialTransaction,
  FinanceSummary,
  TransactionListResponse,
  TransactionCreatePayload,
  ClientDebt,
} from '@/types';

// ─── Configuration ──────────────────────────────────────────────────────────

let rawApiUrl = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://boutik-flow.onrender.com/api/v1';
rawApiUrl = rawApiUrl.replace(/\/$/, '');
if (!rawApiUrl.endsWith('/api/v1')) {
  rawApiUrl = `${rawApiUrl}/api/v1`;
}
const API_BASE_URL = rawApiUrl;

const ACCESS_TOKEN_KEY = 'boutikflow_access_token';
const REFRESH_TOKEN_KEY = 'boutikflow_refresh_token';

// ─── Gestion des tokens ─────────────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Erreur API ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ─── Rafraîchissement de token (dédupliqué) ────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

// ─── Helper requête générique ───────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Connexion au serveur en cours... Veuillez réessayez dans quelques secondes.', 0);
  }

  // Tentative de rafraîchissement automatique en cas de 401
  if (res.status === 401) {
    if (allowRetry && getRefreshToken()) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);
      }
    }
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && path !== '/auth/login') {
      window.location.href = '/login?expired=true';
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
      : detail || res.statusText || 'Une erreur est survenue';
    throw new ApiError(message, res.status);
  }

  return body as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function withPages<T>(raw: { items: T[]; total: number; page: number; per_page: number }) {
  return { ...raw, pages: raw.per_page > 0 ? Math.ceil(raw.total / raw.per_page) : 0 };
}

// ─── Types locaux (non couverts par src/types/index.ts) ────────────────────

interface UserInfo {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInfo;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string | null;
}

interface CheckoutPayload {
  plan_id: string;
  phone_number: string;
}

interface CheckoutResult {
  transaction_id: string;
  status: string;
  message: string;
}

type ProductUpdate = Partial<ProductCreate>;

interface OrderStatusUpdatePayload {
  status: OrderStatus;
  note?: string;
}

interface WhatsAppChat {
  id: string;
  client: string;
  lastMessage: string;
  time: string;
  unread: number;
  aiSuggestion: string | null;
}

interface WhatsAppSendPayload {
  to: string;
  message: string;
}

interface AISuggestReplyPayload {
  message: string;
  context?: string;
}

interface AISuggestReplyResult {
  suggestion: string;
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setTokens(res.access_token, res.refresh_token);
    return res;
  },

  async register(data: RegisterRequest): Promise<{ message: string; boutique_slug: string; status: string }> {
    return request<{ message: string; boutique_slug: string; status: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    clearTokens();
  },

  getMe(): Promise<UserInfo> {
    return request('/auth/me');
  },

  forgotPassword(data: { boutique_slug: string; email: string }): Promise<{ message: string }> {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) });
  },

  resetPassword(data: { token: string; new_password: string }): Promise<{ message: string }> {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });
  },

  getTenant(): Promise<TenantInfo> {
    return request('/auth/tenant');
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  getDashboardKPIs(): Promise<DashboardKPIs> {
    return request('/dashboard/kpis');
  },

  getAnalyticsData(period: string = '7j'): Promise<AnalyticsData> {
    return request(`/dashboard/analytics${buildQuery({ period })}`);
  },

  // ── CRM — Clients ─────────────────────────────────────────────────────
  async getClients(page = 1, perPage = 20, search?: string, status?: ClientStatus) {
    const raw = await request<{ items: CrmClient[]; total: number; page: number; per_page: number }>(
      `/clients${buildQuery({ page, per_page: perPage, search, status })}`
    );
    return withPages(raw);
  },

  getClient(id: string): Promise<CrmClient> {
    return request(`/clients/${id}`);
  },

  createClient(data: ClientCreate): Promise<CrmClient> {
    return request('/clients', { method: 'POST', body: JSON.stringify(data) });
  },

  updateClient(id: string, data: ClientUpdate): Promise<CrmClient> {
    return request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteClient(id: string): Promise<void> {
    return request(`/clients/${id}`, { method: 'DELETE' });
  },

  // ── CRM — Debts ───────────────────────────────────────────────────────
  async createDebt(data: { client_id: string; order_id?: string; original_amount: number; description?: string; due_date?: string }): Promise<{ id: string; message: string; remaining_amount: number }> {
    return request('/crm/debts', { method: 'POST', body: JSON.stringify(data) });
  },
  async getDebts(clientId?: string, statusFilter?: string): Promise<ClientDebt[]> {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);
    if (statusFilter) params.set('status_filter', statusFilter);
    return request(`/crm/debts?${params.toString()}`);
  },
  async recordDebtPayment(debtId: string, data: { amount: number; payment_method: string; notes?: string }): Promise<{ message: string; remaining_amount: number; status: string }> {
    return request(`/crm/debts/${debtId}/pay`, { method: 'POST', body: JSON.stringify(data) });
  },

  // ── CRM — Segments ────────────────────────────────────────────────────
  async getSegments(page = 1, perPage = 20) {
    const raw = await request<{ items: Segment[]; total: number; page: number; per_page: number }>(
      `/clients/segments${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createSegment(data: SegmentCreate): Promise<Segment> {
    return request('/clients/segments', { method: 'POST', body: JSON.stringify(data) });
  },

  updateSegment(id: string, data: SegmentUpdate): Promise<Segment> {
    return request(`/clients/segments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteSegment(id: string): Promise<void> {
    return request(`/clients/segments/${id}`, { method: 'DELETE' });
  },

  // ── Catalogue — Catégories ────────────────────────────────────────────
  async getCategories(page = 1, perPage = 20) {
    const raw = await request<{ items: Category[]; total: number; page: number; per_page: number }>(
      `/products/categories${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createCategory(data: CategoryCreate): Promise<Category> {
    return request('/products/categories', { method: 'POST', body: JSON.stringify(data) });
  },

  updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
    return request(`/products/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteCategory(id: string): Promise<void> {
    return request(`/products/categories/${id}`, { method: 'DELETE' });
  },

  // ── Catalogue — Produits ──────────────────────────────────────────────
  async getProducts(page = 1, perPage = 20, search?: string, categoryId?: string, inStock?: boolean) {
    const raw = await request<{ items: Product[]; total: number; page: number; per_page: number }>(
      `/products${buildQuery({
        page,
        per_page: perPage,
        search,
        category_id: categoryId,
        in_stock: inStock,
      })}`
    );
    return withPages(raw);
  },

  getProduct(id: string): Promise<Product> {
    return request(`/products/${id}`);
  },

  createProduct(data: ProductCreate): Promise<Product> {
    return request('/products', { method: 'POST', body: JSON.stringify(data) });
  },

  updateProduct(id: string, data: ProductUpdate): Promise<Product> {
    return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteProduct(id: string): Promise<void> {
    return request(`/products/${id}`, { method: 'DELETE' });
  },

  // ── Commandes ─────────────────────────────────────────────────────────
  async getOrders(page = 1, status?: OrderStatus, perPage = 100, clientId?: string) {
    const raw = await request<{ items: Order[]; total: number; page: number; per_page: number }>(
      `/orders${buildQuery({ page, per_page: perPage, status, client_id: clientId })}`
    );
    return withPages(raw);
  },

  getOrder(id: string): Promise<Order> {
    return request(`/orders/${id}`);
  },

  createOrder(data: OrderCreate): Promise<Order> {
    return request('/orders', { method: 'POST', body: JSON.stringify(data) });
  },

  updateOrderStatus(orderId: string, status: OrderStatus | string, note?: string): Promise<Order> {
    const payload: OrderStatusUpdatePayload = { status: status as OrderStatus, note };
    return request(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  returnOrderItems(orderId: string, items: { product_id: string; quantity: number }[], reason: string, restockInventory = true): Promise<any> {
    return request(`/orders/${orderId}/return`, {
      method: 'POST',
      body: JSON.stringify({ items, reason, restock_inventory: restockInventory }),
    });
  },

  // ── Billing ───────────────────────────────────────────────────────────
  getSubscription(): Promise<SubscriptionInfo> {
    return request('/billing/subscription');
  },

  checkout(data: CheckoutPayload): Promise<CheckoutResult> {
    return request('/billing/checkout', { method: 'POST', body: JSON.stringify(data) });
  },

  // ── Marketing — Campagnes ─────────────────────────────────────────────
  async getCampaigns(page = 1, perPage = 20) {
    const raw = await request<{ items: Campaign[]; total: number; page: number; per_page: number }>(
      `/campaigns${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createCampaign(data: CampaignCreate): Promise<Campaign> {
    return request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
  },

  updateCampaign(id: string, data: CampaignUpdate): Promise<Campaign> {
    return request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteCampaign(id: string): Promise<void> {
    return request(`/campaigns/${id}`, { method: 'DELETE' });
  },

  // ── WhatsApp ──────────────────────────────────────────────────────────
  getWhatsAppChats(): Promise<WhatsAppChat[]> {
    return request('/whatsapp/chats');
  },

  sendWhatsAppMessage(data: WhatsAppSendPayload): Promise<{ status: string; message_id: string }> {
    return request('/whatsapp/send', { method: 'POST', body: JSON.stringify(data) });
  },

  suggestReply(data: AISuggestReplyPayload): Promise<AISuggestReplyResult> {
    return request('/ai/suggest-reply', { method: 'POST', body: JSON.stringify(data) });
  },

  analyzeProductImage(imageData: string): Promise<{
    name?: string;
    category?: string;
    description?: string;
    brand?: string;
    attributes?: Record<string, any>;
  }> {
    return request('/ai/analyze-product-image', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData }),
    });
  },

  // ── Admin — Stats ──────────────────────────────────────────────────────
  getAdminStats(): Promise<AdminStats> {
    return request('/admin/stats');
  },

  // ── Admin — Tenants (boutiques) ────────────────────────────────────────
  async getAdminTenants(
    page = 1,
    perPage = 20,
    search?: string,
    status?: TenantStatus,
    plan?: TenantPlan,
  ): Promise<PaginatedAdminTenants> {
    return request(
      `/admin/tenants${buildQuery({ page, per_page: perPage, search, status, plan })}`
    );
  },

  getAdminTenant(id: string): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}`);
  },

  updateTenantStatus(
    id: string,
    data: { status: TenantStatus; note?: string }
  ): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateTenantPlan(id: string, plan: TenantPlan): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ plan }),
    });
  },

  deleteAdminTenant(id: string): Promise<void> {
    return request(`/admin/tenants/${id}`, { method: 'DELETE' });
  },

  // ── Admin — Notifications ──────────────────────────────────────────────
  getAdminNotifications(unreadOnly = false): Promise<AdminNotification[]> {
    return request(`/admin/notifications${buildQuery({ unread_only: unreadOnly })}`);
  },

  markNotificationRead(id: string): Promise<void> {
    return request(`/admin/notifications/${id}/read`, { method: 'PATCH' });
  },

  // ─── Suppliers ────────────────────────────────────────────────────────
  getSuppliers: (page = 1, perPage = 50, search?: string) =>
    request<{ items: Supplier[]; total: number; page: number; per_page: number }>(
      `/suppliers?page=${page}&per_page=${perPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    ),
  getSupplier: (id: string) => request<Supplier>(`/suppliers/${id}`),
  createSupplier: (data: SupplierCreate) => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: SupplierUpdate) => request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request<void>(`/suppliers/${id}`, { method: 'DELETE' }),

  // ─── Team Management ─────────────────────────────────────────────────
  getTeamMembers: () => request<TeamMember[]>('/auth/team'),
  inviteTeamMember: (data: InviteUserRequest) => request<TeamMember>('/auth/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  changeTeamMemberPassword: async (userId: string, newPassword: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/auth/team/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    });
  },
  updateTeamMemberRole: (userId: string, role: string) => request<TeamMember>(`/auth/team/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateTeamMemberStatus: (userId: string, isActive: boolean) => request<TeamMember>(`/auth/team/${userId}/status`, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }),
  deleteTeamMember: (userId: string) => request<void>(`/auth/team/${userId}`, { method: 'DELETE' }),

  // ─── Audit Log ────────────────────────────────────────────────────────
  async getAuditLogs(page = 1, perPage = 50, action?: string, userEmail?: string) {
    const raw = await request<{ items: AuditLog[]; total: number; page: number; per_page: number }>(
      `/audit${buildQuery({ page, per_page: perPage, action, user_email: userEmail })}`
    );
    return withPages(raw);
  },

  // ─── Finance & Trésorerie ────────────────────────────────────────────
  async getFinanceTransactions(
    page = 1,
    perPage = 50,
    type?: string,
    category?: string,
    period?: string,
    startDate?: string,
    endDate?: string
  ): Promise<TransactionListResponse> {
    const raw = await request<{
      items: FinancialTransaction[];
      total: number;
      page: number;
      per_page: number;
      summary: FinanceSummary;
    }>(`/finance${buildQuery({ page, per_page: perPage, type, category, period, start_date: startDate, end_date: endDate })}`);
    return {
      ...withPages(raw),
      summary: raw.summary,
    };
  },

  createFinanceTransaction(data: TransactionCreatePayload): Promise<FinancialTransaction> {
    return request('/finance', { method: 'POST', body: JSON.stringify(data) });
  },
};

export type { CampaignChannel };
