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
import { getActiveUiFaultConfigs } from "./api/uiFaults";
import { getProductImageSrc } from "./productImages";
import {
  checkoutBankTransfer,
  checkoutGatewayInit,
  checkoutMockPay,
  type BankTransferDetails,
  type BuyerFormPayload,
} from "./api/checkout";

type ViewMode = "shop" | "admin" | "bugs";

type CheckoutStep = "buyer" | "payment" | "bankResult" | "gatewayPay";

const emptyBuyer: BuyerFormPayload = {
  customerEmail: "",
  customerFirstName: "",
  customerLastName: "",
  customerPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "",
};

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
  const [activeUiFaultConfigs, setActiveUiFaultConfigs] = useState<
    Array<{ key: string; failureRate: number }>
  >([]);
  const [productSearch, setProductSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("buyer");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [buyerForm, setBuyerForm] = useState<BuyerFormPayload>(emptyBuyer);
  const [buyerFieldErrors, setBuyerFieldErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [paymentChoice, setPaymentChoice] = useState<
    "bank" | "gateway"
  >("bank");
  const [bankTransferInfo, setBankTransferInfo] =
    useState<BankTransferDetails | null>(null);
  const [bankEmailInfo, setBankEmailInfo] = useState<{
    message: string;
    emailConfigured: boolean;
    emailSent: boolean;
    emailPreviewUrl?: string;
    emailError?: string;
  } | null>(null);
  const [gatewayOrderId, setGatewayOrderId] = useState<number | null>(null);

  useEffect(() => {
    // pokud je v localStorage rozbitý stav (token bez role nebo naopak), vyčisti ho
    if (!adminToken || !adminRole) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getProducts(), getCart(), getActiveUiFaultConfigs()])
      .then(([productsData, cartData, uiFaultConfigs]) => {
        if (!cancelled) {
          setProducts(productsData);
          setCart(cartData);
          setActiveUiFaultConfigs(uiFaultConfigs);
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

  const uiDoubleAddFailureRate =
    activeUiFaultConfigs.find((f) => f.key === "cart_add_ui_double_call")
      ?.failureRate ?? 0;

  const uiDoubleAddAlways = uiDoubleAddFailureRate >= 1;

  const handleProductSearchSubmit: React.FormEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await getProducts(productSearch);
      setProducts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClearProductSearch = async () => {
    setProductSearch("");
    setError(null);
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      setCartError(null);
      const currentQty =
        cart?.items.find((i) => i.productId === productId)?.quantity ?? 0;

      const uiShouldTriggerDoubleAdd =
        uiDoubleAddAlways || Math.random() < uiDoubleAddFailureRate;

      if (uiShouldTriggerDoubleAdd) {
        // UI mutace: v rámci jednoho kliknutí zavoláme backend 2x,
        // pokaždé přidáme po 1 kuse. Druhý call dopočítáme z odpovědi
        // z prvního volání, aby decrement zůstalo správné.
        const first = await updateCartItem(productId, currentQty + 1);
        const firstQty =
          first.items.find((i) => i.productId === productId)?.quantity ??
          currentQty + 1;

        const second = await updateCartItem(productId, firstQty + 1);
        setCart(second);
        return;
      }

      const updated = await updateCartItem(productId, currentQty + 1);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Cart update failed",
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
        err instanceof Error ? err.message : "Cart update failed",
      );
    }
  };

  const refreshShopData = async () => {
    const q = productSearch.trim() || undefined;
    const [productsData, cartData] = await Promise.all([
      getProducts(q),
      getCart(),
    ]);
    setProducts(productsData);
    setCart(cartData);
  };

  const openCheckout = () => {
    setCheckoutOpen(true);
    setCheckoutStep("buyer");
    setCheckoutError(null);
    setBuyerForm(emptyBuyer);
    setBuyerFieldErrors({});
    setPaymentChoice("bank");
    setBankTransferInfo(null);
    setBankEmailInfo(null);
    setGatewayOrderId(null);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setCheckoutBusy(false);
    setCheckoutError(null);
  };

  const validateBuyerClient = (): boolean => {
    const next: Partial<Record<string, string>> = {};
    if (!buyerForm.customerEmail.trim()) {
      next.customerEmail = "Email is required";
    }
    if (!buyerForm.customerFirstName.trim()) {
      next.customerFirstName = "First name is required";
    }
    if (!buyerForm.customerLastName.trim()) {
      next.customerLastName = "Last name is required";
    }
    if (!buyerForm.customerPhone.trim()) {
      next.customerPhone = "Phone is required";
    }
    setBuyerFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCheckoutContinueFromBuyer = () => {
    setCheckoutError(null);
    if (!validateBuyerClient()) return;
    setCheckoutStep("payment");
  };

  const handleCheckoutPaymentSubmit = async () => {
    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      if (paymentChoice === "bank") {
        const res = await checkoutBankTransfer(buyerForm);
        setBankTransferInfo(res.bankTransfer);
        setBankEmailInfo({
          message: res.message,
          emailConfigured: res.emailConfigured,
          emailSent: res.emailSent,
          emailPreviewUrl: res.emailPreviewUrl,
          emailError: res.emailError,
        });
        await refreshShopData();
        setCheckoutStep("bankResult");
      } else {
        const res = await checkoutGatewayInit(buyerForm);
        setGatewayOrderId(res.order.id);
        setCheckoutStep("gatewayPay");
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Checkout failed",
      );
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleMockGatewayPay = async () => {
    if (gatewayOrderId == null) return;
    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      const res = await checkoutMockPay(gatewayOrderId);
      if (res.success) {
        await refreshShopData();
        closeCheckout();
      } else {
        const rule =
          res.mockPaymentBehavior != null
            ? ` Rule: ${res.mockPaymentBehavior}${res.mockRandomRollSuccess === false ? " (random → declined)" : res.mockRandomRollSuccess === true ? " (random → approved)" : ""}.`
            : "";
        setCheckoutError(res.message + rule);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Mock payment failed",
      );
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleRemoveCartItem = async (productId: number) => {
    try {
      setCartError(null);
      const updated = await updateCartItem(productId, 0);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : "Cart update failed",
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
        err instanceof Error ? err.message : "Failed to load products",
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
        err instanceof Error ? err.message : "Failed to load faults",
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
        err instanceof Error ? err.message : "Login failed",
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
              ...(field === "active"
                ? { active: Boolean(value) }
                : field === "inStock"
                  ? { inStock: Number(value) }
                  : field === "price"
                    ? {
                        price: {
                          ...p.price,
                            amount: Number(value),
                        },
                      }
                    : { [field]: value }),
            }
          : p,
      ),
    );
  };

  const sortedAdminProducts = [...adminProducts].sort((a, b) => {
    const dir = adminSort.direction === "asc" ? 1 : -1;
    const col = adminSort.column;

    if (col === "price") {
      return (a.price.amount - b.price.amount) * dir;
    }

    const av = a[col] as unknown;
    const bv = b[col] as unknown;

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }

    return String(av ?? "").localeCompare(String(bv ?? ""), "cs") * dir;
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
        price: product.price,
        inStock: product.inStock,
        active: product.active,
      });
      setAdminProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Product save failed",
      );
    }
  };

  const handleAdminAddNewProduct = async () => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const created = await createAdminProduct(adminToken, {
        name: "New product",
        description: "Product description",
        price: { amount: 100, currencyCode: "CZK" },
        inStock: 0,
        active: false,
      });
      setAdminProducts((prev) => [...prev, created]);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Product creation failed",
      );
    }
  };

  const handleAdminToggleFault = async (fault: AdminFault) => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      const enabling = !fault.enabled;
      const updated = await updateAdminFault(adminToken, fault.key, {
        enabled: enabling,
        // Při zapnutí automaticky nastavíme chybovost na "vždy".
        ...(enabling ? { failureRate: 1 } : {}),
      });
      setAdminFaults((prev) =>
        prev.some((f) => f.key === updated.key)
          ? prev.map((f) => (f.key === updated.key ? updated : f))
          : [...prev, updated],
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Fault update failed",
      );
    }
  };

  const handleAdminFaultChange = (
    key: string,
    field: "latencyMs" | "failureRate" | "name" | "description" | "level",
    value: string,
  ) => {
    setAdminFaults((prev) =>
      prev.map((f) =>
        f.key === key
          ? {
              ...f,
              [field]:
                field === "name" || field === "description" || field === "level"
                  ? value
                  : value.trim() === ""
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
        name: fault.name,
        description: fault.description,
        level: fault.level,
      });
      setAdminFaults((prev) =>
        prev.map((f) => (f.key === updated.key ? updated : f)),
      );
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : "Fault save failed",
      );
    }
  };

  return (
    <div className="store">
      <header className="store-header">
        <div className="store-header-inner">
          <div className="store-brand">
            <h1>AI Testing Shop</h1>
            <p className="store-tagline">
              A simple e-shop for AI testing experiments and fault injection.
            </p>
          </div>
          <form
            className="store-search"
            role="search"
            onSubmit={handleProductSearchSubmit}
          >
            <input
              className="store-search-input"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products by name or description"
              aria-label="Search products"
              autoComplete="off"
              name="q"
            />
            <button
              type="submit"
              className={`store-search-btn${productSearch.trim() !== "" ? " store-search-btn--with-clear" : ""}`}
            >
              Go
            </button>
            {productSearch.trim() !== "" && (
              <button
                type="button"
                className="store-search-clear"
                onClick={() => void handleClearProductSearch()}
              >
                Clear
              </button>
            )}
          </form>
          <div className="store-actions">
            <button
              type="button"
              onClick={handleSwitchToShop}
              className={`btn btn-nav${viewMode === "shop" ? " btn-nav-active" : ""}`}
            >
              Shop
            </button>
            {!adminToken && (
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={`btn btn-nav${viewMode === "admin" ? " btn-nav-active" : ""}`}
              >
                Login
              </button>
            )}
            {adminToken && adminRole === "ADMIN" && (
              <button
                type="button"
                onClick={handleSwitchToAdmin}
                className={`btn btn-nav${viewMode === "admin" ? " btn-nav-active" : ""}`}
              >
                Admin
              </button>
            )}
            {adminToken && adminRole === "TESTER" && (
              <button
                type="button"
                onClick={handleSwitchToBugs}
                className={`btn btn-nav${viewMode === "bugs" ? " btn-nav-active" : ""}`}
              >
                Bugs
              </button>
            )}
            {adminToken && adminRole && (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="btn btn-ghost-dark"
                title="Logout"
              >
                <span className="store-user-chip">
                  {adminRole.toLowerCase()} · Logout
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="store-subnav">
        <div className="store-subnav-inner">
          <span>Demo storefront · All categories</span>
          {cart && cart.items.length > 0 && (
            <span className="muted" style={{ marginLeft: "auto" }}>
              Cart: {cart.items.reduce((n, i) => n + i.quantity, 0)} item(s)
            </span>
          )}
        </div>
      </div>

      <main className="store-main">
        <div className="store-alerts">
          {loading && (
            <p className="store-alert store-alert--info">Loading products…</p>
          )}
          {error && (
            <p className="store-alert store-alert--error">Error: {error}</p>
          )}
          {cartError && (
            <p className="store-alert store-alert--error">
              Cart error: {cartError}
            </p>
          )}
        </div>

      {viewMode === "admin" ? (
        <section className="panel">
          <h2 className="panel-title">Admin · Products</h2>
          {!adminToken ? (
            <form
              onSubmit={handleAdminLoginSubmit}
              className="form-stack"
            >
              <label>
                Username
                <input name="username" defaultValue="admin" />
              </label>
              <label>
                Password
                <input name="password" type="password" defaultValue="admin" />
              </label>
              {adminLoginError && (
                <p className="store-alert store-alert--error">{adminLoginError}</p>
              )}
              <button type="submit" className="btn btn-primary">
                Sign in
              </button>
            </form>
          ) : (
            <>
              <div className="admin-toolbar">
                <button
                  type="button"
                  onClick={handleAdminAddNewProduct}
                  className="btn btn-success"
                >
                  Add new product
                </button>
              </div>
              {adminError && (
                <p className="store-alert store-alert--error" style={{ marginBottom: "0.75rem" }}>
                  {adminError}
                </p>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("id")}
                          className="sort-btn"
                        >
                          ID {getSortArrow("id")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("name")}
                          className="sort-btn"
                        >
                          Name {getSortArrow("name")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("description")}
                          className="sort-btn"
                        >
                          Description {getSortArrow("description")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("price")}
                          className="sort-btn"
                        >
                          Price (CZK) {getSortArrow("price")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("inStock")}
                          className="sort-btn"
                        >
                          Stock {getSortArrow("inStock")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("active")}
                          className="sort-btn"
                        >
                          Active {getSortArrow("active")}
                        </button>
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAdminProducts.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>
                          <input
                            value={p.name}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "name",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={p.description}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "description",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.price.amount}
                            onChange={(e) =>
                              handleAdminProductChange(
                                p.id,
                                "price",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
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
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
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
                        <td>
                          <button
                            type="button"
                            onClick={() => handleAdminSaveProduct(p)}
                            className="btn-table"
                          >
                            Save
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
        <section className="panel">
          <h2 className="panel-title">Fault injection</h2>
          {!adminToken ? (
            <p className="muted">
              To manage faults, please sign in as Admin or Tester first.
            </p>
          ) : (
            <>
              {adminError && (
                <p className="store-alert store-alert--error" style={{ marginBottom: "0.75rem" }}>
                  {adminError}
                </p>
              )}
              <div className="table-wrap">
                {adminFaults.length === 0 ? (
                  <p className="empty-state">No faults defined yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Level</th>
                        <th>Enabled</th>
                        <th>Latency (ms)</th>
                        <th>Failure rate (0–1)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {adminFaults.map((f) => (
                        <tr key={f.key}>
                          <td>{f.key}</td>
                          <td>
                            <input
                              type="text"
                              value={f.name}
                              onChange={(e) =>
                                handleAdminFaultChange(
                                  f.key,
                                  "name",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.description}
                              onChange={(e) =>
                                handleAdminFaultChange(
                                  f.key,
                                  "description",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={f.level}
                              onChange={(e) =>
                                handleAdminFaultChange(
                                  f.key,
                                  "level",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="UI">UI</option>
                              <option value="API">API</option>
                              <option value="Unit">Unit</option>
                            </select>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={() => handleAdminToggleFault(f)}
                            />
                          </td>
                          <td>
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
                            />
                          </td>
                          <td>
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
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleAdminFaultSave(f)}
                              className="btn-table"
                            >
                              Save
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
        <section className="shop-layout">
          <div>
            {!loading && !error && products.length === 0 && (
              <p className="empty-state">No products available yet.</p>
            )}

            <div className="product-grid">
              {products.map((p) => {
                const inCartQty =
                  cart?.items.find((i) => i.productId === p.id)?.quantity ?? 0;
                const step = uiDoubleAddAlways ? 2 : 1;
                const canAddFromList = inCartQty + step <= p.inStock;
                const imgSrc = getProductImageSrc(p.name);
                return (
                  <article key={p.id} className="product-card">
                    <div className="product-card__image">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={p.name}
                          width={220}
                          height={165}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="product-card__placeholder">Photo</span>
                      )}
                    </div>
                    <h3 className="product-card__title">{p.name}</h3>
                    <p className="product-card__desc">{p.description}</p>
                    <div className="product-card__price">
                      {p.price.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: p.price.currencyCode,
                      })}
                    </div>
                    <p className="product-card__stock">
                      In Stock · {p.inStock} left
                    </p>
                    <button
                      type="button"
                      className="btn-add-cart"
                      onClick={() => handleAddToCart(p.id)}
                      disabled={!canAddFromList}
                    >
                      {canAddFromList ? "Add to Cart" : "Max in stock"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="cart-panel">
            <div className="cart-panel__title">Shopping Cart</div>
            {!cart || cart.items.length === 0 ? (
              <p className="muted">Your cart is empty.</p>
            ) : (
              <>
                <ul className="cart-list">
                  {cart.items.map((item) => {
                    const plusDisabled =
                      uiDoubleAddAlways
                        ? item.quantity + 2 > item.inStock
                        : item.quantity >= item.inStock;
                    return (
                      <li key={item.productId} className="cart-item">
                        <button
                          type="button"
                          className="cart-item__remove"
                          onClick={() =>
                            handleRemoveCartItem(item.productId)
                          }
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          ×
                        </button>
                        <div className="cart-item__body">
                          <div className="cart-item__name">{item.name}</div>
                          <div className="cart-item__meta">
                            Unit price:{" "}
                            {item.price.amount.toLocaleString("en-US", {
                              style: "currency",
                              currency: item.price.currencyCode,
                            })}
                          </div>
                          <div className="cart-item__controls">
                            <button
                              type="button"
                              className="cart-qty-btn"
                              onClick={() => handleAddToCart(item.productId)}
                              disabled={plusDisabled}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="cart-qty-btn"
                              onClick={() =>
                                handleDecreaseCartItem(item.productId)
                              }
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="cart-qty-label">
                              {item.quantity}
                            </span>
                            <span className="cart-qty-stock">
                              of {item.inStock}
                            </span>
                          </div>
                        </div>
                        <div className="cart-item__sub">
                          <div className="cart-item__sub-label">Subtotal</div>
                          <strong>
                            {item.lineTotal.amount.toLocaleString("en-US", {
                              style: "currency",
                              currency: item.lineTotal.currencyCode,
                            })}
                          </strong>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <hr className="cart-divider" />
                <div className="cart-total-row">
                  <span>Estimated total</span>
                  <strong>
                    {cart.total.amount.toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.total.currencyCode,
                    })}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn-add-cart"
                  onClick={openCheckout}
                >
                  Proceed to checkout
                </button>
              </>
            )}
          </aside>
        </section>
      )}
      </main>

      {checkoutOpen && (
        <div
          className="checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
        >
          <div className="checkout-modal">
            <button
              type="button"
              className="checkout-close"
              onClick={closeCheckout}
              aria-label="Close checkout"
            >
              ×
            </button>
            <h2 id="checkout-title" className="checkout-title">
              Checkout
            </h2>

            {checkoutError && (
              <p className="store-alert store-alert--error checkout-alert">
                {checkoutError}
              </p>
            )}

            {checkoutStep === "buyer" && (
              <div className="checkout-form-stack">
                <p className="muted checkout-hint">
                  Required fields are marked. Address fields are optional.
                </p>
                <label>
                  Email <span className="req">*</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={buyerForm.customerEmail}
                    onChange={(e) =>
                      setBuyerForm((f) => ({
                        ...f,
                        customerEmail: e.target.value,
                      }))
                    }
                    className={
                      buyerFieldErrors.customerEmail ? "input-invalid" : ""
                    }
                  />
                  {buyerFieldErrors.customerEmail && (
                    <span className="field-error">
                      {buyerFieldErrors.customerEmail}
                    </span>
                  )}
                </label>
                <label>
                  First name <span className="req">*</span>
                  <input
                    autoComplete="given-name"
                    value={buyerForm.customerFirstName}
                    onChange={(e) =>
                      setBuyerForm((f) => ({
                        ...f,
                        customerFirstName: e.target.value,
                      }))
                    }
                    className={
                      buyerFieldErrors.customerFirstName ? "input-invalid" : ""
                    }
                  />
                  {buyerFieldErrors.customerFirstName && (
                    <span className="field-error">
                      {buyerFieldErrors.customerFirstName}
                    </span>
                  )}
                </label>
                <label>
                  Last name <span className="req">*</span>
                  <input
                    autoComplete="family-name"
                    value={buyerForm.customerLastName}
                    onChange={(e) =>
                      setBuyerForm((f) => ({
                        ...f,
                        customerLastName: e.target.value,
                      }))
                    }
                    className={
                      buyerFieldErrors.customerLastName ? "input-invalid" : ""
                    }
                  />
                  {buyerFieldErrors.customerLastName && (
                    <span className="field-error">
                      {buyerFieldErrors.customerLastName}
                    </span>
                  )}
                </label>
                <label>
                  Phone <span className="req">*</span>
                  <input
                    autoComplete="tel"
                    value={buyerForm.customerPhone}
                    onChange={(e) =>
                      setBuyerForm((f) => ({
                        ...f,
                        customerPhone: e.target.value,
                      }))
                    }
                    className={
                      buyerFieldErrors.customerPhone ? "input-invalid" : ""
                    }
                  />
                  {buyerFieldErrors.customerPhone && (
                    <span className="field-error">
                      {buyerFieldErrors.customerPhone}
                    </span>
                  )}
                </label>
                <fieldset className="checkout-fieldset">
                  <legend>Address (optional)</legend>
                  <label>
                    Street / line 1
                    <input
                      value={buyerForm.addressLine1 ?? ""}
                      onChange={(e) =>
                        setBuyerForm((f) => ({
                          ...f,
                          addressLine1: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Street / line 2
                    <input
                      value={buyerForm.addressLine2 ?? ""}
                      onChange={(e) =>
                        setBuyerForm((f) => ({
                          ...f,
                          addressLine2: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    City
                    <input
                      value={buyerForm.city ?? ""}
                      onChange={(e) =>
                        setBuyerForm((f) => ({
                          ...f,
                          city: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      value={buyerForm.postalCode ?? ""}
                      onChange={(e) =>
                        setBuyerForm((f) => ({
                          ...f,
                          postalCode: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Country
                    <input
                      value={buyerForm.country ?? ""}
                      onChange={(e) =>
                        setBuyerForm((f) => ({
                          ...f,
                          country: e.target.value,
                        }))
                      }
                    />
                  </label>
                </fieldset>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-ghost-dark"
                    onClick={closeCheckout}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCheckoutContinueFromBuyer}
                  >
                    Continue to payment
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="checkout-form-stack">
                <p className="muted">
                  Choose how you want to pay. Stock is updated after bank
                  transfer confirmation or after a successful mock gateway
                  payment.
                </p>
                <label className="checkout-radio">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentChoice === "bank"}
                    onChange={() => setPaymentChoice("bank")}
                  />
                  <span>
                    <strong>Bank transfer</strong> — mock email with order PDF +
                    dummy payment details (no real email sent).
                  </span>
                </label>
                <label className="checkout-radio">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentChoice === "gateway"}
                    onChange={() => setPaymentChoice("gateway")}
                  />
                  <span>
                    <strong>Payment gateway</strong> — mock result is driven by
                    buyer email in{" "}
                    <code className="inline-code">MockConfigs/PaymentConfigs.json</code>{" "}
                    on the server (emails not listed → success).
                  </span>
                </label>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-ghost-dark"
                    onClick={() => setCheckoutStep("buyer")}
                    disabled={checkoutBusy}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCheckoutPaymentSubmit()}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy ? "Processing…" : "Continue"}
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "bankResult" && bankTransferInfo && (
              <div className="checkout-form-stack">
                <p
                  className={`store-alert checkout-alert ${bankEmailInfo?.emailError ? "store-alert--error" : "store-alert--info"}`}
                >
                  {bankEmailInfo?.emailConfigured && bankEmailInfo.emailError
                    ? `Order placed but email failed: ${bankEmailInfo.emailError}`
                    : bankEmailInfo?.message ??
                      `Order placed. Add SMTP_USE_ETHEREAL=true or SMTP to the backend .env to send mail to ${buyerForm.customerEmail}.`}
                </p>
                {bankEmailInfo?.emailPreviewUrl && (
                  <p className="checkout-ethereal-link">
                    <a
                      href={bankEmailInfo.emailPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open email in Ethereal (preview in browser)
                    </a>
                  </p>
                )}
                <div className="bank-box">
                  <h3 className="bank-box__title">Dummy transfer details</h3>
                  <p className="bank-box__note">{bankTransferInfo.note}</p>
                  <dl className="bank-dl">
                    <dt>Beneficiary</dt>
                    <dd>{bankTransferInfo.beneficiary}</dd>
                    <dt>IBAN</dt>
                    <dd className="mono">{bankTransferInfo.iban}</dd>
                    <dt>BIC</dt>
                    <dd className="mono">{bankTransferInfo.bic}</dd>
                    <dt>Bank</dt>
                    <dd>{bankTransferInfo.bankName}</dd>
                    <dt>Variable symbol</dt>
                    <dd className="mono">{bankTransferInfo.variableSymbol}</dd>
                    <dt>Specific symbol</dt>
                    <dd className="mono">{bankTransferInfo.specificSymbol}</dd>
                    <dt>Amount</dt>
                    <dd>
                      {bankTransferInfo.amount.value.toLocaleString("en-US", {
                        style: "currency",
                        currency: bankTransferInfo.amount.currencyCode,
                      })}
                    </dd>
                  </dl>
                </div>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={closeCheckout}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "gatewayPay" && (
              <div className="checkout-form-stack">
                <p>
                  Order <strong>#{gatewayOrderId}</strong> is waiting for mock
                  gateway payment. Stock is not reduced until the mock gateway
                  succeeds. If you go back and submit again, the same pending
                  order is reused when possible.
                </p>
                <p className="muted" style={{ fontSize: "0.82rem" }}>
                  Result for <strong>{buyerForm.customerEmail}</strong> is read
                  from <code className="inline-code">PaymentConfigs.json</code>{" "}
                  (<code className="inline-code">byBuyerEmail</code>). Example
                  test emails: <code className="inline-code">pay-fail@example.com</code>
                  ,{" "}
                  <code className="inline-code">pay-random@example.com</code>.
                </p>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-ghost-dark"
                    onClick={() => setCheckoutStep("payment")}
                    disabled={checkoutBusy}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleMockGatewayPay()}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy ? "Processing…" : "Pay with mock gateway"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
