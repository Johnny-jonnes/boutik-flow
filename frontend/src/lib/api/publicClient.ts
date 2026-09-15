/**
 * Client HTTP pour la vitrine publique (/boutique/[slug]) — délibérément
 * séparé de lib/api/client.ts. Un visiteur non authentifié n'a ni JWT, ni
 * refresh token, ni file de synchronisation hors-ligne : reprendre le
 * client interne (rafraîchissement automatique, file IndexedDB, etc.)
 * pour ce cas ferait porter à un simple visiteur toute la complexité
 * pensée pour un utilisateur BoutikFlow connecté, pour rien.
 */
let rawApiUrl =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') ||
  'https://boutik-flow.onrender.com/api/v1';
rawApiUrl = rawApiUrl.replace(/\/$/, '');
if (!rawApiUrl.endsWith('/api/v1')) {
  rawApiUrl = `${rawApiUrl}/api/v1`;
}
const API_BASE_URL = rawApiUrl;

export class PublicApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PublicApiError';
    this.status = status;
  }
}

async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail || message;
    } catch {
      // corps non-JSON, garder le message générique
    }
    throw new PublicApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export interface PublicStore {
  name: string;
  slug: string;
  description: string | null;
  theme_color: string | null;
  has_logo: boolean;
  public_whatsapp: string | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_name: string | null;
  is_available: boolean;
  has_image: boolean;
}

export interface PublicProductList {
  items: PublicProduct[];
  total: number;
  page: number;
  per_page: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  count: number;
}

export const publicApi = {
  getStore(slug: string): Promise<PublicStore> {
    return publicRequest(`/storefront/${encodeURIComponent(slug)}`);
  },
  getCategories(slug: string): Promise<PublicCategory[]> {
    return publicRequest(`/storefront/${encodeURIComponent(slug)}/categories`);
  },
  listProducts(slug: string, page = 1, perPage = 20, q?: string, categoryId?: string): Promise<PublicProductList> {
    const query =
      (q && q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '') +
      (categoryId ? `&category_id=${encodeURIComponent(categoryId)}` : '');
    return publicRequest(`/storefront/${encodeURIComponent(slug)}/products?page=${page}&per_page=${perPage}${query}`);
  },
  getProduct(slug: string, productId: string): Promise<PublicProduct> {
    return publicRequest(`/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`);
  },
  imageUrl(slug: string, productId: string): string {
    return `${API_BASE_URL}/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/image`;
  },
  logoUrl(slug: string): string {
    return `${API_BASE_URL}/storefront/${encodeURIComponent(slug)}/logo`;
  },
};
