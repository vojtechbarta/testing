import { useEffect, useState } from "react";
import "./App.css";
import { getProducts, type Product } from "./api/products";
import { getCart, updateCartItem, type Cart } from "./api/cart";
import {
  adminLogin,
  createAdminProduct,
  getAdminProducts,
  updateAdminProduct,
  type AdminProduct,
} from "./api/admin";
import {
  getAdminFaults,
  updateAdminFault,
  type AdminFault,
} from "./api/faults";

type ViewMode = "shop" | "admin" | "bugs";

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("shop");
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    const storedRole = localStorage.getItem("adminRole");
    const storedToken = localStorage.getItem("adminToken");
    return storedRole && storedToken ? storedToken : null;
  });
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [adminSort, setAdminSort] = useState<{
    column: keyof AdminProduct;
    direction: "asc" | "desc";
  }>({ column: "id", direction: "asc" });
  const [adminRole, setAdminRole] = useState<string | null>(() =>
    localStorage.getItem("adminRole"),
  );
  const [adminFaults, setAdminFaults] = useState<AdminFault[]>([]);

  useEffect(() => {
    // pokud je v localStorage rozbitý stav (token bez role nebo naopak), vyčisti ho
    if (!adminToken || !adminRole) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getProducts(), getCart()])
      .then(([productsData, cartData]) => {
        if (!cancelled) {
          setProducts(productsData);
          setCart(cartData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddToCart = async (productId: number) => {
    try {
      setCartError(null);
      const currentQty =
        cart?.items.find((i) => i.productId === productId)?.quantity ?? 0;
      const updated = await updateCartItem(productId, currentQty + 1);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Chyba při aktualizaci košíku",
      );
    }
  };

  const handleDecreaseCartItem = async (productId: number) => {
    try {
      setCartError(null);
      const currentQty =
        cart?.items.find((i) => i.productId === productId)?.quantity ?? 0;
      const nextQty = currentQty - 1;
      const updated = await updateCartItem(productId, nextQty);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Chyba při aktualizaci košíku",
      );
    }
  };

  const handleRemoveCartItem = async (productId: number) => {
    try {
      setCartError(null);
      const updated = await updateCartItem(productId, 0);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Chyba při aktualizaci košíku",
      );
    }
  };

  const handleSwitchToAdmin = async () => {
    setViewMode("admin");
    setAdminError(null);
    if (!adminToken) {
      return;
    }
    try {
      const productsData = await getAdminProducts(adminToken);
      setAdminProducts(productsData);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Nepodařilo se načíst produkty",
      );
    }
  };

  const handleSwitchToBugs = async () => {
    setViewMode("bugs");
    setAdminError(null);
    if (!adminToken) {
      return;
    }
    try {
      const faultsData = await getAdminFaults(adminToken);
      setAdminFaults(faultsData);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Nepodařilo se načíst chyby",
      );
    }
  };

  const handleSwitchToShop = () => {
    setViewMode("shop");
  };

  const handleAdminLoginSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      setAdminLoginError(null);
      const res = await adminLogin(username, password);
      setAdminToken(res.token);
      localStorage.setItem("adminToken", res.token);
      setAdminRole(res.user.role);
      localStorage.setItem("adminRole", res.user.role);
      const productsData =
        res.user.role === "ADMIN" ? await getAdminProducts(res.token) : [];
      setAdminProducts(productsData);
    } catch (err) {
      setAdminLoginError(
        err instanceof Error ? err.message : "Přihlášení selhalo",
      );
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem("adminToken");
    setAdminRole(null);
    localStorage.removeItem("adminRole");
    setAdminProducts([]);
    setAdminFaults([]);
    setViewMode("shop");
  };

  const handleAdminProductChange = (
    id: number,
    field: keyof Omit<AdminProduct, "id">,
    value: string | boolean,
  ) => {
    setAdminProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]:
                field === "active"
                  ? Boolean(value)
                  : field === "priceCents"
                    ? Math.round(Number(value) * 100)
                    : field === "inStock"
                      ? Number(value)
                      : value,
            }
          : p,
      ),
    );
  };

  const sortedAdminProducts = [...adminProducts].sort((a, b) => {
    const dir = adminSort.direction === "asc" ? 1 : -1;
    const col = adminSort.column;
    const av = a[col];
    const bv = b[col];
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    const as = String(av ?? "");
    const bs = String(bv ?? "");
    return as.localeCompare(bs, "cs") * dir;
  });

  const handleAdminSort = (column: keyof AdminProduct) => {
    setAdminSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  };

  const getSortArrow = (column: keyof AdminProduct) => {
    if (adminSort.column !== column) {
      return "↕";
    }
    return adminSort.direction === "asc" ? "↑" : "↓";
  };

  const handleAdminSaveProduct = async (product: AdminProduct) => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const updated = await updateAdminProduct(adminToken, product.id, {
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        inStock: product.inStock,
        active: product.active,
      });
      setAdminProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Uložení produktu selhalo",
      );
    }
  };

  const handleAdminAddNewProduct = async () => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const created = await createAdminProduct(adminToken, {
        name: "Nový produkt",
        description: "Popis nového produktu",
        priceCents: 10000,
        inStock: 0,
        active: false,
      });
      setAdminProducts((prev) => [...prev, created]);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Vytvoření produktu selhalo",
      );
    }
  };

  const handleAdminToggleFault = async (fault: AdminFault) => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const updated = await updateAdminFault(adminToken, fault.key, {
        enabled: !fault.enabled,
      });
      setAdminFaults((prev) =>
        prev.some((f) => f.key === updated.key)
          ? prev.map((f) => (f.key === updated.key ? updated : f))
          : [...prev, updated],
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Aktualizace chyby selhala",
      );
    }
  };

  const handleAdminFaultChange = (
    key: string,
    field: "latencyMs" | "failureRate",
    value: string,
  ) => {
    setAdminFaults((prev) =>
      prev.map((f) =>
        f.key === key
          ? {
              ...f,
              [field]:
                value.trim() === ""
                  ? null
                  : field === "latencyMs"
                    ? Number(value)
                    : Number(value),
            }
          : f,
      ),
    );
  };

  const handleAdminFaultSave = async (fault: AdminFault) => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const updated = await updateAdminFault(adminToken, fault.key, {
        enabled: fault.enabled,
        latencyMs: fault.latencyMs,
        failureRate: fault.failureRate,
      });
      setAdminFaults((prev) =>
        prev.map((f) => (f.key === updated.key ? updated : f)),
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Uložení chyby selhalo",
      );
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1>AI Testing Shop</h1>
          <p>
            Jednoduchý e-shop pro experimenty s AI testováním a chybami
            (fault-injection).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSwitchToShop}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 999,
              border: "none",
              background:
                viewMode === "shop" ? "#2563eb" : "rgba(148,163,184,0.3)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Obchod
          </button>
          {!adminToken && (
            <button
              type="button"
              onClick={() => setViewMode("admin")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                background:
                  viewMode === "admin" ? "#2563eb" : "rgba(148,163,184,0.3)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Login
            </button>
          )}
          {adminToken && adminRole === "ADMIN" && (
            <button
              type="button"
              onClick={handleSwitchToAdmin}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                background:
                  viewMode === "admin" ? "#2563eb" : "rgba(148,163,184,0.3)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Admin
            </button>
          )}
          {adminToken && adminRole === "TESTER" && (
            <button
              type="button"
              onClick={handleSwitchToBugs}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                background:
                  viewMode === "bugs" ? "#2563eb" : "rgba(148,163,184,0.3)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Bugs
            </button>
          )}
          {adminToken && adminRole && (
            <button
              type="button"
              onClick={handleAdminLogout}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "transparent",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: 12,
              }}
              title="Odhlásit"
            >
              {adminRole.toLowerCase()} · Logout
            </button>
          )}
        </div>
      </header>

      {loading && <p>Načítám produkty…</p>}
      {error && <p style={{ color: "red" }}>Chyba: {error}</p>}
      {cartError && <p style={{ color: "red" }}>Chyba košíku: {cartError}</p>}

      {viewMode === "admin" ? (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
          }}
        >
          {!adminToken ? (
            <form
              onSubmit={handleAdminLoginSubmit}
              style={{ maxWidth: 320, marginTop: "1rem" }}
            >
              <div style={{ marginBottom: "0.5rem" }}>
                <label>
                  Uživatelské jméno
                  <input
                    name="username"
                    defaultValue="admin"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: "0.5rem" }}>
                <label>
                  Heslo
                  <input
                    name="password"
                    type="password"
                    defaultValue="admin"
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>
              </div>
              {adminLoginError && (
                <p style={{ color: "red" }}>{adminLoginError}</p>
              )}
              <button
                type="submit"
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Přihlásit se
              </button>
            </form>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  style={{
                    padding: "0.35rem 0.7rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Odhlásit
                </button>
              </div>
              {adminError && (
                <p style={{ color: "red", marginBottom: "0.75rem" }}>
                  {adminError}
                </p>
              )}
              <div style={{ marginBottom: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleAdminAddNewProduct}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Přidat nový produkt
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("id")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          ID {getSortArrow("id")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("name")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          Název {getSortArrow("name")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("description")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          Popis {getSortArrow("description")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("priceCents")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          Cena (Kč) {getSortArrow("priceCents")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("inStock")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          Sklad {getSortArrow("inStock")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }}>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("active")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#111827",
                          }}
                        >
                          Aktivní {getSortArrow("active")}
                        </button>
                      </th>
                      <th style={{ borderBottom: "1px solid #ddd" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAdminProducts.map((p) => (
                      <tr key={p.id}>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          {p.id}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          <input
                            value={p.name}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "name",
                                e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          <input
                            value={p.description}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "description",
                                e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.priceCents / 100}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "priceCents",
                                e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          <input
                            type="number"
                            value={p.inStock}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "inStock",
                                e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            textAlign: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={p.active}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "active",
                                e.target.checked,
                              )
                            }
                          />
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            padding: "0.25rem 0.4rem",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleAdminSaveProduct(p)}
                            style={{
                              padding: "0.25rem 0.6rem",
                              borderRadius: 4,
                              border: "none",
                              background: "#2563eb",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Uložit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : viewMode === "bugs" ? (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
          }}
        >
          {!adminToken ? (
            <p>Pro správu chyb se nejprve přihlas jako admin nebo tester.</p>
          ) : (
            <>
              {adminError && (
                <p style={{ color: "red", marginBottom: "0.75rem" }}>
                  {adminError}
                </p>
              )}
              <div style={{ overflowX: "auto" }}>
                {adminFaults.length === 0 ? (
                  <p>Zatím nejsou definovány žádné chyby.</p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ borderBottom: "1px solid #ddd" }}>Klíč</th>
                        <th style={{ borderBottom: "1px solid #ddd" }}>
                          Zapnuto
                        </th>
                        <th style={{ borderBottom: "1px solid #ddd" }}>
                          Latence (ms)
                        </th>
                        <th style={{ borderBottom: "1px solid #ddd" }}>
                          Chybovost (0–1)
                        </th>
                        <th style={{ borderBottom: "1px solid #ddd" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {adminFaults.map((f) => (
                        <tr key={f.key}>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              padding: "0.25rem 0.4rem",
                            }}
                          >
                            {f.key}
                          </td>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              textAlign: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={() => handleAdminToggleFault(f)}
                            />
                          </td>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              padding: "0.25rem 0.4rem",
                            }}
                          >
                            <input
                              type="number"
                              value={f.latencyMs ?? ""}
                              onChange={(e) =>
                                handleAdminFaultChange(
                                  f.key,
                                  "latencyMs",
                                  e.target.value,
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              padding: "0.25rem 0.4rem",
                            }}
                          >
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={f.failureRate ?? ""}
                              onChange={(e) =>
                                handleAdminFaultChange(
                                  f.key,
                                  "failureRate",
                                  e.target.value,
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              padding: "0.25rem 0.4rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleAdminFaultSave(f)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                borderRadius: 4,
                                border: "none",
                                background: "#2563eb",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Uložit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </section>
      ) : (
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "2rem",
          alignItems: "flex-start",
        }}
      >
        <div>
          {!loading && !error && products.length === 0 && (
            <p>Žádné produkty zatím nejsou.</p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.5rem",
              marginTop: 0,
            }}
          >
            {products.map((p) => {
              const inCartQty =
                cart?.items.find((i) => i.productId === p.id)?.quantity ?? 0;
              const canAddFromList = inCartQty < p.inStock;
              return (
                <article
                key={p.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "1rem",
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                  <p>{p.description}</p>
                </div>
                <div>
                  <p style={{ marginBottom: "0.5rem" }}>
                    <strong>
                      {(p.priceCents / 100).toLocaleString("cs-CZ", {
                        style: "currency",
                        currency: "CZK",
                      })}
                    </strong>
                  </p>
                  <p style={{ fontSize: 12, color: "#555" }}>
                    Sklad: {p.inStock}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(p.id)}
                    disabled={!canAddFromList}
                    style={{
                      marginTop: "0.5rem",
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: 6,
                      border: "none",
                      background: canAddFromList ? "#2563eb" : "#94a3b8",
                      color: "#fff",
                      cursor: canAddFromList ? "pointer" : "not-allowed",
                    }}
                  >
                    {canAddFromList ? "Přidat do košíku" : "Max na skladě"}
                  </button>
                </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
            color: "#0f172a",
          }}
        >
          {!cart || cart.items.length === 0 ? (
            <p>Košík je prázdný.</p>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {cart.items.map((item) => (
                  <li
                    key={item.productId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      columnGap: "0.75rem",
                      marginBottom: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "0.65rem",
                      background: "#f8fafc",
                    }}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <div style={{ fontSize: 12, marginTop: 2, color: "#475569" }}>
                        Jednotková cena:{" "}
                        {(item.priceCents / 100).toLocaleString("cs-CZ", {
                          style: "currency",
                          currency: "CZK",
                        })}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item.productId)}
                          disabled={item.quantity >= item.inStock}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background:
                              item.quantity >= item.inStock ? "#e2e8f0" : "#fff",
                            color:
                              item.quantity >= item.inStock ? "#94a3b8" : "#0f172a",
                            cursor:
                              item.quantity >= item.inStock
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 16,
                            lineHeight: "24px",
                            padding: 0,
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecreaseCartItem(item.productId)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            color: "#0f172a",
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: "22px",
                            padding: 0,
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: 24, textAlign: "center" }}>
                          {item.quantity} ks
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          / sklad {item.inStock}
                        </span>
                        <div style={{ marginLeft: "auto" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.productId)}
                            style={{
                              padding: "0.15rem 0.4rem",
                              borderRadius: 4,
                              border: "1px solid #fecaca",
                              background: "#fee2e2",
                              color: "#b91c1c",
                              cursor: "pointer",
                              fontSize: 11,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Odebrat všechny
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Mezisoučet</div>
                      {(item.lineTotalCents / 100).toLocaleString("cs-CZ", {
                        style: "currency",
                        currency: "CZK",
                      })}
                    </div>
                  </li>
                ))}
              </ul>
              <hr />
              <p style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Celkem:</span>
                <strong>
                  {(cart.totalCents / 100).toLocaleString("cs-CZ", {
                    style: "currency",
                    currency: "CZK",
                  })}
                </strong>
              </p>
              <button
                type="button"
                style={{
                  marginTop: "0.75rem",
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Dokončit objednávku (zatím mock)
              </button>
            </>
          )}
        </aside>
      </section>
      )}
    </main>
  );
}

export default App;
