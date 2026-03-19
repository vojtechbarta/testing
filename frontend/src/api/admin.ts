const API_BASE_URL = "http://localhost:4000";

export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  inStock: number;
  active: boolean;
}

export interface AdminLoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
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
  data: Omit<AdminProduct, "id">,
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
  data: Omit<AdminProduct, "id">,
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

