import { API_BASE_URL } from "./client";

export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  category: string;
  newCategoryName?: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  inStock: number;
  active: boolean;
}

export type AdminProductInput = Omit<AdminProduct, "id" | "category" | "categoryId"> & {
  categoryId?: number;
};

export interface AdminLoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

export interface ProductTranslation {
  locale: string;
  name: string;
  description: string;
}

export interface AdminCategory {
  id: number;
  name: string;
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed with status ${res.status}`);
  }

  return res.json();
}

export async function getAdminProducts(token: string): Promise<AdminProduct[]> {
  const res = await fetch(`${API_BASE_URL}/admin/products`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load admin products (${res.status})`);
  }

  return res.json();
}

export async function updateAdminProduct(
  token: string,
  id: number,
  data: AdminProductInput,
): Promise<AdminProduct> {
  const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to update product (${res.status})`);
  }

  return res.json();
}

export async function createAdminProduct(
  token: string,
  data: AdminProductInput,
): Promise<AdminProduct> {
  const res = await fetch(`${API_BASE_URL}/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to create product (${res.status})`);
  }

  return res.json();
}

export async function getAdminCategories(token: string): Promise<AdminCategory[]> {
  const res = await fetch(`${API_BASE_URL}/admin/products/categories`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load admin categories (${res.status})`);
  }

  return res.json();
}

export async function getAdminProductTranslations(
  token: string,
  productId: number,
): Promise<ProductTranslation[]> {
  const res = await fetch(`${API_BASE_URL}/admin/products/${productId}/translations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load product translations (${res.status})`);
  }

  return res.json();
}

export async function saveAdminProductTranslation(
  token: string,
  productId: number,
  locale: string,
  data: { name: string; description: string },
): Promise<ProductTranslation> {
  const res = await fetch(
    `${API_BASE_URL}/admin/products/${productId}/translations/${encodeURIComponent(locale)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to save product translation (${res.status})`);
  }

  return res.json();
}

