import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import { getExchangeRates, type ExchangeRateDto } from "./api/exchangeRates";
import { getStorefrontProducts, type Product } from "./api/products";
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
import { callInjectErrorEndpoint, getActiveUiFaultConfigs } from "./api/uiFaults";
import { getProductImageSrcById } from "./productImages";
import {
  checkoutBankTransfer,
  checkoutGatewayInit,
  checkoutMockPay,
  type BankTransferDetails,
  type BuyerFormPayload,
} from "./api/checkout";
import { toShopDisplayMoney } from "./displayMoney";

const FAILURE_RATE_SUPPORTED_KEYS = new Set<string>([
  "cart_add_ui_double_call",
  "checkout_email_wrong_language",
]);

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

/** Avoid new `{ min, max }` when values are unchanged — otherwise catalog `useEffect` + `priceFilter` dep loops forever. */
function mergePriceFilterFromBounds(
  prev: { min: number; max: number } | null,
  bounds: { min: number; max: number },
): { min: number; max: number } {
  if (!prev) {
    return { min: bounds.min, max: bounds.max };
  }
  const lo = Math.max(bounds.min, Math.min(prev.min, bounds.max));
  const hi = Math.min(bounds.max, Math.max(prev.max, bounds.min));
  const nextMin = Math.min(lo, hi);
  const nextMax = Math.max(lo, hi);
  if (prev.min === nextMin && prev.max === nextMax) {
    return prev;
  }
  return { min: nextMin, max: nextMax };
}

function isAuth401Error(err: unknown): boolean {
  return (
    err instanceof Error &&
    (/\(401\)/.test(err.message) ||
      /unauthorized/i.test(err.message) ||
      /invalid or expired token/i.test(err.message))
  );
}

function App() {
  const { t, i18n } = useTranslation();
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
  const [adminFaultSort, setAdminFaultSort] = useState<{
    column: "key" | "name" | "description" | "level";
    direction: "asc" | "desc";
  }>({ column: "key", direction: "asc" });
  const [adminRole, setAdminRole] = useState<string | null>(() =>
    localStorage.getItem("adminRole"),
  );
  const [adminFaults, setAdminFaults] = useState<AdminFault[]>([]);
  const [faultsSaving, setFaultsSaving] = useState(false);
  const [faultLevelFilter, setFaultLevelFilter] = useState<
    "ALL" | "UI" | "API" | "Unit"
  >("ALL");
  const [activeUiFaultConfigs, setActiveUiFaultConfigs] = useState<
    Array<{ key: string; failureRate: number }>
  >([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateDto[]>([]);
  const [productSearch, setProductSearch] = useState("");
  /** Search query last submitted to the storefront catalog API (not live typing). */
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [shopSort, setShopSort] = useState<
    "name-asc" | "name-desc" | "price-asc" | "price-desc"
  >("name-asc");
  /** Global price bounds for the current catalog query (before price filter), from the server. */
  const [catalogPriceBounds, setCatalogPriceBounds] = useState({
    min: 0,
    max: 0,
    currencyCode: "CZK",
  });
  const [priceFilter, setPriceFilter] = useState<{
    min: number;
    max: number;
  } | null>(null);
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

  /** After language/search reset, omit priceMin/priceMax until the next catalog response re-seeds the slider. */
  const resetCatalogPriceFilterRef = useRef(false);

  const shopLang: "en" | "cs" = i18n.language.startsWith("cs") ? "cs" : "en";

  useLayoutEffect(() => {
    resetCatalogPriceFilterRef.current = true;
    setPriceFilter(null);
  }, [shopLang]);

  useEffect(() => {
    // pokud je v localStorage rozbitý stav (token bez role nebo naopak), vyčisti ho
    if (!adminToken || !adminRole) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getActiveUiFaultConfigs(),
      getExchangeRates().catch((): ExchangeRateDto[] => []),
    ])
      .then(([uiFaultConfigs, ratesData]) => {
        if (!cancelled) {
          setActiveUiFaultConfigs(uiFaultConfigs);
          setExchangeRates(ratesData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("errors.unknown"),
          );
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

  useEffect(() => {
    let cancelled = false;
    void getCart(shopLang)
      .then((cartData) => {
        if (!cancelled) {
          setCart(cartData);
        }
      })
      .catch(() => {
        /* keep cart as-is */
      });
    return () => {
      cancelled = true;
    };
  }, [shopLang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refSkip = resetCatalogPriceFilterRef.current;
        if (refSkip) {
          resetCatalogPriceFilterRef.current = false;
        }
        const skipPrice = refSkip || priceFilter === null;
        const res = await getStorefrontProducts({
          q: submittedSearch || undefined,
          lang: shopLang,
          sort: shopSort,
          ...(!skipPrice && priceFilter !== null
            ? { priceMin: priceFilter.min, priceMax: priceFilter.max }
            : {}),
        });
        if (cancelled) {
          return;
        }
        setError(null);
        setProducts(res.products);
        setCatalogPriceBounds(res.priceBounds);
        if (skipPrice) {
          setPriceFilter((prev) => {
            const nextMin = res.priceBounds.min;
            const nextMax = res.priceBounds.max;
            if (prev && prev.min === nextMin && prev.max === nextMax) {
              return prev;
            }
            return { min: nextMin, max: nextMax };
          });
        } else {
          setPriceFilter((prev) =>
            mergePriceFilterFromBounds(prev, res.priceBounds),
          );
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("errors.unknown"),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopLang, shopSort, submittedSearch, priceFilter]);

  const uiDoubleAddFailureRate =
    activeUiFaultConfigs.find((f) => f.key === "cart_add_ui_double_call")
      ?.failureRate ?? 0;

  // Chrome detection: userAgent contains "Chrome" and vendor is "Google Inc."
  // This correctly identifies Chrome on Mac/Windows and excludes Edge (empty vendor),
  // Firefox, and Safari.
  const isChrome =
    navigator.userAgent.includes("Chrome") &&
    navigator.vendor === "Google Inc.";

  const labelTyposFaultActive = activeUiFaultConfigs.some(
    (f) => f.key === "ui_label_typos",
  );

  /** Fault: typo variants from locale files (en + cs), same UI spots (see docs/FAULTS.md). */
  const showLabelTypos = labelTyposFaultActive;

  const priceLocale = i18n.language.startsWith("cs") ? "cs-CZ" : "en-US";

  const shopMoneyCtx = useMemo(
    () => ({
      langIsCs: shopLang === "cs",
      rates: exchangeRates,
    }),
    [shopLang, exchangeRates],
  );

  /** Bank transfer amounts are stored in CZK; EN storefront shows EUR when rates exist. */
  const formatStorefrontMoney = useCallback(
    (amount: number, storageCurrencyCode: string) => {
      const d = toShopDisplayMoney(amount, storageCurrencyCode, shopMoneyCtx);
      return d.amount.toLocaleString(priceLocale, {
        style: "currency",
        currency: d.currencyCode,
      });
    },
    [shopMoneyCtx, priceLocale],
  );

  const formatCartMoney = useCallback(
    (amount: number, currencyCode: string) =>
      amount.toLocaleString(priceLocale, {
        style: "currency",
        currency: currencyCode,
      }),
    [priceLocale],
  );

  const gridBrokenFaultActive = activeUiFaultConfigs.some(
    (f) => f.key === "grid_non_chrome_broken",
  );
  const usebrokenGrid = gridBrokenFaultActive && !isChrome;
  const consoleErrorEveryMinuteFaultActive = activeUiFaultConfigs.some(
    (f) => f.key === "console_error_every_minute",
  );
  const injectErrorNetworkEveryMinuteFaultActive = activeUiFaultConfigs.some(
    (f) => f.key === "network_inject_api_fail_every minute",
  );

  const uiDoubleAddAlways = uiDoubleAddFailureRate >= 1;

  const handleProductSearchSubmit: React.FormEventHandler<
    HTMLFormElement
  > = (event) => {
    event.preventDefault();
    setError(null);
    resetCatalogPriceFilterRef.current = true;
    setPriceFilter(null);
    setSubmittedSearch(productSearch.trim());
  };

  const handleClearProductSearch = () => {
    setProductSearch("");
    setError(null);
    resetCatalogPriceFilterRef.current = true;
    setPriceFilter(null);
    setSubmittedSearch("");
  };

  const priceFilterCoversFullCatalogRange =
    priceFilter != null &&
    priceFilter.min <= catalogPriceBounds.min &&
    priceFilter.max >= catalogPriceBounds.max;

  useEffect(() => {
    if (!consoleErrorEveryMinuteFaultActive) {
      return;
    }
    const msg = shopLang === "cs" ? "toto je error" : "this is error";
    const id = window.setInterval(() => {
      // Fault injection intentionally writes to console.
      // eslint-disable-next-line no-console
      console.error(msg);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [consoleErrorEveryMinuteFaultActive, shopLang]);

  useEffect(() => {
    if (!injectErrorNetworkEveryMinuteFaultActive) {
      return;
    }
    const id = window.setInterval(() => {
      void callInjectErrorEndpoint(shopLang);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [injectErrorNetworkEveryMinuteFaultActive, shopLang]);

  useEffect(() => {
    const sync = () => {
      document.documentElement.lang = i18n.language.startsWith("cs")
        ? "cs"
        : "en";
      document.title = t("meta.documentTitle");
    };
    sync();
    i18n.on("languageChanged", sync);
    return () => {
      i18n.off("languageChanged", sync);
    };
  }, [i18n, t]);

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
        const first = await updateCartItem(
          productId,
          currentQty + 1,
          shopLang,
        );
        const firstQty =
          first.items.find((i) => i.productId === productId)?.quantity ??
          currentQty + 1;

        const second = await updateCartItem(
          productId,
          firstQty + 1,
          shopLang,
        );
        setCart(second);
        return;
      }

      const updated = await updateCartItem(
        productId,
        currentQty + 1,
        shopLang,
      );
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : t("errors.cartUpdateFailed"),
      );
    }
  };

  const handleDecreaseCartItem = async (productId: number) => {
    try {
      setCartError(null);
      const currentQty =
        cart?.items.find((i) => i.productId === productId)?.quantity ?? 0;
      const nextQty = currentQty - 1;
      const updated = await updateCartItem(productId, nextQty, shopLang);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : t("errors.cartUpdateFailed"),
      );
    }
  };

  const refreshShopData = useCallback(async () => {
    const [cartData, catalogRes] = await Promise.all([
      getCart(shopLang),
      getStorefrontProducts({
        q: submittedSearch || undefined,
        lang: shopLang,
        sort: shopSort,
        ...(priceFilter !== null
          ? { priceMin: priceFilter.min, priceMax: priceFilter.max }
          : {}),
      }),
    ]);
    setCart(cartData);
    setProducts(catalogRes.products);
    setCatalogPriceBounds(catalogRes.priceBounds);
    setPriceFilter((prev) =>
      mergePriceFilterFromBounds(prev, catalogRes.priceBounds),
    );
  }, [shopLang, submittedSearch, shopSort, priceFilter]);

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
      next.customerEmail = t("validation.emailRequired");
    }
    if (!buyerForm.customerFirstName.trim()) {
      next.customerFirstName = t("validation.firstNameRequired");
    }
    if (!buyerForm.customerLastName.trim()) {
      next.customerLastName = t("validation.lastNameRequired");
    }
    if (!buyerForm.customerPhone.trim()) {
      next.customerPhone = t("validation.phoneRequired");
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
        const res = await checkoutBankTransfer(buyerForm, shopLang);
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
        const res = await checkoutGatewayInit(buyerForm, shopLang);
        setGatewayOrderId(res.order.id);
        setCheckoutStep("gatewayPay");
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : t("errors.checkoutFailed"),
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
            ? `${t("checkout.mockRulePrefix")}${res.mockPaymentBehavior}${res.mockRandomRollSuccess === false ? t("checkout.mockRuleRandomDeclined") : res.mockRandomRollSuccess === true ? t("checkout.mockRuleRandomApproved") : ""}.`
            : "";
        setCheckoutError(res.message + rule);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : t("errors.mockPaymentFailed"),
      );
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleRemoveCartItem = async (productId: number) => {
    try {
      setCartError(null);
      const updated = await updateCartItem(productId, 0, shopLang);
      setCart(updated);
    } catch (err) {
      setCartError(
        err instanceof Error ? err.message : t("errors.cartUpdateFailed"),
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
        err instanceof Error ? err.message : t("errors.loadProductsFailed"),
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
      if (isAuth401Error(err)) {
        setAdminToken(null);
        localStorage.removeItem("adminToken");
        setAdminRole(null);
        localStorage.removeItem("adminRole");
        setAdminProducts([]);
        setAdminFaults([]);
        setAdminError(null);
        setAdminLoginError(t("errors.sessionExpired"));
        return;
      }
      setAdminError(
        err instanceof Error ? err.message : t("errors.loadFaultsFailed"),
      );
    }
  };

  /** Re-fetch enabled UI faults — they only load on initial mount otherwise, so toggling in Bugs would leave Shop stale. */
  const reloadActiveUiFaults = async () => {
    try {
      const configs = await getActiveUiFaultConfigs();
      setActiveUiFaultConfigs(configs);
    } catch {
      /* keep existing activeUiFaultConfigs */
    }
  };

  const handleSwitchToShop = () => {
    setViewMode("shop");
    void reloadActiveUiFaults();
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
        err instanceof Error ? err.message : t("errors.loginFailed"),
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

  const filteredAdminFaults =
    faultLevelFilter === "ALL"
      ? adminFaults
      : adminFaults.filter((f) => f.level === faultLevelFilter);

  const sortedAdminFaults = [...filteredAdminFaults].sort((a, b) => {
    const dir = adminFaultSort.direction === "asc" ? 1 : -1;
    const col = adminFaultSort.column;
    return String(a[col] ?? "").localeCompare(String(b[col] ?? ""), "cs") * dir;
  });

  const handleAdminFaultSort = (
    column: "key" | "name" | "description" | "level",
  ) => {
    setAdminFaultSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  };

  const getFaultSortArrow = (
    column: "key" | "name" | "description" | "level",
  ) => {
    if (adminFaultSort.column !== column) {
      return "↕";
    }
    return adminFaultSort.direction === "asc" ? "↑" : "↓";
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
        err instanceof Error ? err.message : t("errors.productSaveFailed"),
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
        err instanceof Error ? err.message : t("errors.productCreationFailed"),
      );
    }
  };

  /** Local-only: enabling still sets failure rate to 1 for faults that support it (same UX as before); nothing hits the API until Save all. */
  const handleAdminFaultEnabledLocalChange = (key: string) => {
    setAdminFaults((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const enabling = !f.enabled;
        return {
          ...f,
          enabled: enabling,
          ...(enabling && FAILURE_RATE_SUPPORTED_KEYS.has(f.key)
            ? { failureRate: 1 }
            : {}),
        };
      }),
    );
  };

  const handleAdminSaveAllFaults = async () => {
    if (!adminToken) return;
    try {
      setAdminError(null);
      setFaultsSaving(true);
      await Promise.all(
        adminFaults.map((f) =>
          updateAdminFault(adminToken, f.key, {
            enabled: f.enabled,
            latencyMs: f.latencyMs,
            failureRate: f.failureRate,
            name: f.name,
            description: f.description,
            level: f.level,
          }),
        ),
      );
      const refreshed = await getAdminFaults(adminToken);
      setAdminFaults(refreshed);
      await reloadActiveUiFaults();
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : t("errors.faultSaveFailed"),
      );
    } finally {
      setFaultsSaving(false);
    }
  };

  const handleAdminFaultChange = (
    key: string,
    field: "latencyMs" | "failureRate" | "name" | "description" | "level",
    value: string,
  ) => {
    setAdminFaults((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;

        // Never allow editing failureRate for faults that don't support it.
        if (field === "failureRate" && !FAILURE_RATE_SUPPORTED_KEYS.has(f.key)) {
          return f;
        }

        return {
          ...f,
          [field]:
            field === "name" || field === "description" || field === "level"
              ? value
              : value.trim() === ""
                ? null
                : Number(value),
        };
      }),
    );
  };

  return (
    <div className="store">
      <header className="store-header">
        <div className="store-header-inner">
          <div className="store-brand">
            <h1>{t("brand.title")}</h1>
            <p className="store-tagline">{t("brand.tagline")}</p>
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
              placeholder={t("search.placeholder")}
              aria-label={t("search.ariaLabel")}
              autoComplete="off"
              name="q"
            />
            <button
              type="submit"
              className={`store-search-btn${productSearch.trim() !== "" ? " store-search-btn--with-clear" : ""}`}
            >
              {t("search.go")}
            </button>
            {productSearch.trim() !== "" && (
              <button
                type="button"
                className="store-search-clear"
                onClick={() => void handleClearProductSearch()}
              >
                {t("search.clear")}
              </button>
            )}
          </form>
          <div
            className="store-lang"
            role="group"
            aria-label={t("lang.groupAria")}
          >
            <button
              type="button"
              className={`btn btn-lang${i18n.language.startsWith("en") ? " btn-lang-active" : ""}`}
              data-testid="lang-switch-en"
              onClick={() => void i18n.changeLanguage("en")}
            >
              {t("lang.en")}
            </button>
            <button
              type="button"
              className={`btn btn-lang${i18n.language.startsWith("cs") ? " btn-lang-active" : ""}`}
              data-testid="lang-switch-cs"
              onClick={() => void i18n.changeLanguage("cs")}
            >
              {t("lang.cs")}
            </button>
          </div>
          <div className="store-actions">
            <button
              type="button"
              onClick={handleSwitchToShop}
              className={`btn btn-nav${viewMode === "shop" ? " btn-nav-active" : ""}`}
            >
              {t("nav.shop")}
            </button>
            {!adminToken && (
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={`btn btn-nav${viewMode === "admin" ? " btn-nav-active" : ""}`}
              >
                {t("nav.login")}
              </button>
            )}
            {adminToken && adminRole === "ADMIN" && (
              <button
                type="button"
                onClick={handleSwitchToAdmin}
                className={`btn btn-nav${viewMode === "admin" ? " btn-nav-active" : ""}`}
              >
                {t("nav.admin")}
              </button>
            )}
            {adminToken && adminRole === "TESTER" && (
              <button
                type="button"
                onClick={handleSwitchToBugs}
                className={`btn btn-nav${viewMode === "bugs" ? " btn-nav-active" : ""}`}
              >
                {t("nav.bugs")}
              </button>
            )}
            {adminToken && adminRole && (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="btn btn-ghost-dark"
                title={t("nav.logoutTitle")}
              >
                <span className="store-user-chip">
                  {adminRole.toLowerCase()} · {t("nav.logout")}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="store-subnav">
        <div className="store-subnav-inner">
          <span>{t("subnav.demo")}</span>
          {cart && cart.items.length > 0 && (
            <span className="muted" style={{ marginLeft: "auto" }}>
              {t("subnav.cartCount", {
                count: cart.items.reduce((n, i) => n + i.quantity, 0),
              })}
            </span>
          )}
        </div>
      </div>

      <main className="store-main">
        <div className="store-alerts">
          {loading && (
            <p className="store-alert store-alert--info">
              {t("alerts.loadingProducts")}
            </p>
          )}
          {error && (
            <p className="store-alert store-alert--error">
              {t("alerts.errorPrefix")} {error}
            </p>
          )}
          {cartError && (
            <p className="store-alert store-alert--error">
              {t("alerts.cartErrorPrefix")} {cartError}
            </p>
          )}
        </div>

      {viewMode === "admin" ? (
        <section className="panel">
          <h2 className="panel-title">{t("admin.title")}</h2>
          {!adminToken ? (
            <form
              onSubmit={handleAdminLoginSubmit}
              className="form-stack"
            >
              <label>
                {t("admin.username")}
                <input name="username" defaultValue="admin" />
              </label>
              <label>
                {t("admin.password")}
                <input name="password" type="password" defaultValue="admin" />
              </label>
              {adminLoginError && (
                <p className="store-alert store-alert--error">{adminLoginError}</p>
              )}
              <button type="submit" className="btn btn-primary">
                {t("admin.signIn")}
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
                  {t("admin.addNewProduct")}
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
                          {t("admin.sortId")} {getSortArrow("id")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("name")}
                          className="sort-btn"
                        >
                          {t("admin.sortName")} {getSortArrow("name")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("description")}
                          className="sort-btn"
                        >
                          {t("admin.sortDescription")}{" "}
                          {getSortArrow("description")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("price")}
                          className="sort-btn"
                        >
                          {t("admin.sortPrice")} {getSortArrow("price")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("inStock")}
                          className="sort-btn"
                        >
                          {t("admin.sortStock")} {getSortArrow("inStock")}
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => handleAdminSort("active")}
                          className="sort-btn"
                        >
                          {t("admin.sortActive")} {getSortArrow("active")}
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
                            {t("admin.save")}
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
          <h2 className="panel-title">{t("faults.title")}</h2>
          {!adminToken ? (
            <p className="muted">{t("faults.signInHint")}</p>
          ) : (
            <>
              {adminError && (
                <p className="store-alert store-alert--error" style={{ marginBottom: "0.75rem" }}>
                  {adminError}
                </p>
              )}
              <div className="admin-toolbar" style={{ marginBottom: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    faultsSaving ||
                    adminFaults.length === 0 ||
                    !adminToken
                  }
                  onClick={() => void handleAdminSaveAllFaults()}
                >
                  {faultsSaving ? t("faults.saving") : t("faults.saveAll")}
                </button>
                <span className="muted" style={{ marginLeft: "0.75rem" }}>
                  {t("faults.editsLocal")}
                </span>
                <label className="faults-level-filter">
                  <span className="muted">{t("faults.filterLevel")}</span>
                  <select
                    value={faultLevelFilter}
                    onChange={(e) =>
                      setFaultLevelFilter(
                        e.target.value as "ALL" | "UI" | "API" | "Unit",
                      )
                    }
                  >
                    <option value="ALL">{t("faults.filterAllLevels")}</option>
                    <option value="UI">{t("faults.levelUi")}</option>
                    <option value="API">{t("faults.levelApi")}</option>
                    <option value="Unit">{t("faults.levelUnit")}</option>
                  </select>
                </label>
              </div>
              <div className="table-wrap">
                {adminFaults.length === 0 ? (
                  <p className="empty-state">{t("faults.empty")}</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="faults-col-key">
                          <button
                            type="button"
                            onClick={() => handleAdminFaultSort("key")}
                            className="sort-btn"
                          >
                            {t("faults.thKey")} {getFaultSortArrow("key")}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => handleAdminFaultSort("name")}
                            className="sort-btn"
                          >
                            {t("faults.thName")} {getFaultSortArrow("name")}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => handleAdminFaultSort("description")}
                            className="sort-btn"
                          >
                            {t("faults.thDescription")}{" "}
                            {getFaultSortArrow("description")}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => handleAdminFaultSort("level")}
                            className="sort-btn"
                          >
                            {t("faults.thLevel")} {getFaultSortArrow("level")}
                          </button>
                        </th>
                        <th>{t("faults.thEnabled")}</th>
                        <th className="faults-col-latency">
                          {t("faults.thLatency")}
                        </th>
                        <th className="faults-col-failure">
                          {t("faults.thFailureRate")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAdminFaults.map((f) => (
                        <tr key={f.key}>
                          <td className="faults-col-key">{f.key}</td>
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
                            <textarea
                              rows={2}
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
                              onChange={() =>
                                handleAdminFaultEnabledLocalChange(f.key)
                              }
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
                            {FAILURE_RATE_SUPPORTED_KEYS.has(f.key) ? (
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
                            ) : (
                              <input
                                type="text"
                                value="N/A"
                                disabled
                                className="faults-failure-disabled"
                              />
                            )}
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
            {!loading &&
              !error &&
              priceFilter !== null &&
              products.length === 0 &&
              priceFilterCoversFullCatalogRange && (
              <p className="empty-state">{t("shop.emptyNoProducts")}</p>
            )}
            {!loading &&
              !error &&
              priceFilter !== null &&
              products.length === 0 &&
              !priceFilterCoversFullCatalogRange && (
              <p className="empty-state">{t("shop.emptyPriceFilter")}</p>
            )}

            <div className={usebrokenGrid ? "product-grid product-grid--broken" : "product-grid"}>
              {products.map((p) => {
                const inCartQty =
                  cart?.items.find((i) => i.productId === p.id)?.quantity ?? 0;
                const step = uiDoubleAddAlways ? 2 : 1;
                const canAddFromList = inCartQty + step <= p.inStock;
                const imgSrc = getProductImageSrcById(p.id);
                return (
                  <article
                    key={p.id}
                    className="product-card"
                    data-testid={`shop-product-${p.id}`}
                  >
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
                        <span className="product-card__placeholder">
                          {t("shop.photoPlaceholder")}
                        </span>
                      )}
                    </div>
                    <h3 className="product-card__title">{p.name}</h3>
                    <p className="product-card__desc">{p.description}</p>
                    <div className="product-card__price">
                      {p.price.amount.toLocaleString(priceLocale, {
                        style: "currency",
                        currency: p.price.currencyCode,
                      })}
                    </div>
                    <p className="product-card__stock">
                      {showLabelTypos
                        ? t("shop.inSockTypo")
                        : t("shop.inStock")}{" "}
                      · {t("shop.stockLeft", { count: p.inStock })}
                    </p>
                    <button
                      type="button"
                      className="btn-add-cart"
                      data-testid={`shop-add-to-cart-${p.id}`}
                      onClick={() => handleAddToCart(p.id)}
                      disabled={!canAddFromList}
                    >
                      {canAddFromList
                        ? t("shop.addToCart")
                        : t("shop.maxInStock")}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="shop-sidebar">
            <div className="shop-controls">
              <div className="shop-controls__title">{t("shop.filterTitle")}</div>
              <label className="shop-controls__field">
                {t("shop.sortBy")}
                <select
                  value={shopSort}
                  onChange={(e) =>
                    setShopSort(
                      e.target.value as
                        | "name-asc"
                        | "name-desc"
                        | "price-asc"
                        | "price-desc",
                    )
                  }
                >
                  <option value="name-asc">
                    {showLabelTypos
                      ? t("shop.sortNameAscTypo")
                      : t("shop.sortNameAsc")}
                  </option>
                  <option value="name-desc">{t("shop.sortNameDesc")}</option>
                  <option value="price-asc">{t("shop.sortPriceAsc")}</option>
                  <option value="price-desc">{t("shop.sortPriceDesc")}</option>
                </select>
              </label>

              <div className="shop-controls__price">
                <span className="shop-controls__price-label">
                  {t("shop.priceRange")}
                </span>
                <div className="shop-controls__price-row">
                  <div className="shop-controls__price-field">
                    <label className="shop-controls__slider-label">
                      {t("shop.min")}
                      <input
                        type="range"
                        min={catalogPriceBounds.min}
                        max={catalogPriceBounds.max}
                        value={priceFilter?.min ?? catalogPriceBounds.min}
                        disabled={
                          priceFilter === null ||
                          catalogPriceBounds.min === catalogPriceBounds.max
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setPriceFilter((prev) => {
                            if (!prev) {
                              return prev;
                            }
                            return {
                              ...prev,
                              min: Math.min(value, prev.max),
                            };
                          });
                        }}
                      />
                    </label>
                    <input
                      type="number"
                      className="shop-controls__price-input"
                      min={catalogPriceBounds.min}
                      max={priceFilter?.max ?? catalogPriceBounds.max}
                      value={priceFilter?.min ?? catalogPriceBounds.min}
                      disabled={priceFilter === null}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (isNaN(value) || !priceFilter) return;
                        const clamped = Math.max(
                          catalogPriceBounds.min,
                          Math.min(value, priceFilter.max),
                        );
                        setPriceFilter((prev) =>
                          prev ? { ...prev, min: clamped } : prev,
                        );
                      }}
                    />
                  </div>
                  <span className="shop-controls__price-sep">–</span>
                  <div className="shop-controls__price-field">
                    <label className="shop-controls__slider-label">
                      {t("shop.max")}
                      <input
                        type="range"
                        min={catalogPriceBounds.min}
                        max={catalogPriceBounds.max}
                        value={priceFilter?.max ?? catalogPriceBounds.max}
                        disabled={
                          priceFilter === null ||
                          catalogPriceBounds.min === catalogPriceBounds.max
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setPriceFilter((prev) => {
                            if (!prev) {
                              return prev;
                            }
                            return {
                              ...prev,
                              max: Math.max(value, prev.min),
                            };
                          });
                        }}
                      />
                    </label>
                    <input
                      type="number"
                      className="shop-controls__price-input"
                      min={priceFilter?.min ?? catalogPriceBounds.min}
                      max={catalogPriceBounds.max}
                      value={priceFilter?.max ?? catalogPriceBounds.max}
                      disabled={priceFilter === null}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (isNaN(value) || !priceFilter) return;
                        const clamped = Math.min(
                          catalogPriceBounds.max,
                          Math.max(value, priceFilter.min),
                        );
                        setPriceFilter((prev) =>
                          prev ? { ...prev, max: clamped } : prev,
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="cart-panel">
              <div className="cart-panel__title">{t("cart.title")}</div>
              {!cart || cart.items.length === 0 ? (
                <p className="muted">{t("cart.empty")}</p>
              ) : (
                <>
                  <ul className="cart-list">
                    {cart.items.map((item) => {
                      const plusDisabled =
                        uiDoubleAddAlways
                          ? item.quantity + 2 > item.inStock
                          : item.quantity >= item.inStock;
                      return (
                        <li
                          key={item.productId}
                          className="cart-item"
                          data-testid={`cart-line-${item.productId}`}
                        >
                          <button
                            type="button"
                            className="cart-item__remove"
                            onClick={() =>
                              handleRemoveCartItem(item.productId)
                            }
                            aria-label={t("cart.removeAria", {
                              name: item.name,
                            })}
                          >
                            ×
                          </button>
                          <div className="cart-item__body">
                            <div className="cart-item__name">
                              {item.name}
                            </div>
                            <div className="cart-item__meta">
                              {t("cart.unitPrice")}{" "}
                              {formatCartMoney(
                                item.price.amount,
                                item.price.currencyCode,
                              )}
                            </div>
                            <div className="cart-item__controls">
                              <button
                                type="button"
                                className="cart-qty-btn"
                                onClick={() => handleAddToCart(item.productId)}
                                disabled={plusDisabled}
                                aria-label={t("cart.increaseQty")}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="cart-qty-btn"
                                onClick={() =>
                                  handleDecreaseCartItem(item.productId)
                                }
                                aria-label={t("cart.decreaseQty")}
                              >
                                −
                              </button>
                              <span className="cart-qty-label">
                                {item.quantity}
                              </span>
                              <span className="cart-qty-stock">
                                {t("cart.ofStock", { count: item.inStock })}
                              </span>
                            </div>
                          </div>
                          <div className="cart-item__sub">
                            <div className="cart-item__sub-label">
                              {t("cart.subtotal")}
                            </div>
                            <strong>
                              {formatCartMoney(
                                item.lineTotal.amount,
                                item.lineTotal.currencyCode,
                              )}
                            </strong>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <hr className="cart-divider" />
                  <div className="cart-total-row">
                    <span>{t("cart.estimatedTotal")}</span>
                    <strong data-testid="cart-estimated-total">
                      {formatCartMoney(
                        cart.total.amount,
                        cart.total.currencyCode,
                      )}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="btn-add-cart"
                    onClick={openCheckout}
                  >
                    {t("cart.checkout")}
                  </button>
                </>
              )}
            </div>
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
              aria-label={t("checkout.closeAria")}
            >
              ×
            </button>
            <h2 id="checkout-title" className="checkout-title">
              {t("checkout.title")}
            </h2>

            {checkoutError && (
              <p className="store-alert store-alert--error checkout-alert">
                {checkoutError}
              </p>
            )}

            {checkoutStep === "buyer" && (
              <div className="checkout-form-stack">
                <p className="muted checkout-hint">
                  {t("checkout.requiredHint")}
                </p>
                <label>
                  {t("checkout.email")}{" "}
                  <span className="req">{t("checkout.requiredStar")}</span>
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
                  {t("checkout.firstName")}{" "}
                  <span className="req">{t("checkout.requiredStar")}</span>
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
                  {t("checkout.lastName")}{" "}
                  <span className="req">{t("checkout.requiredStar")}</span>
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
                  {t("checkout.phone")}{" "}
                  <span className="req">{t("checkout.requiredStar")}</span>
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
                  <legend>
                    {showLabelTypos
                      ? t("checkout.addressLegendTypo")
                      : t("checkout.addressLegend")}
                  </legend>
                  <label>
                    {t("checkout.street1")}
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
                    {t("checkout.street2")}
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
                    {t("checkout.city")}
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
                    {t("checkout.postalCode")}
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
                    {t("checkout.country")}
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
                    {t("checkout.cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCheckoutContinueFromBuyer}
                  >
                    {t("checkout.continuePayment")}
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="checkout-form-stack">
                <p className="muted">{t("checkout.paymentHint")}</p>
                <label className="checkout-radio">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentChoice === "bank"}
                    onChange={() => setPaymentChoice("bank")}
                  />
                  <span>
                    <strong>{t("checkout.payBank")}</strong>{" "}
                    {t("checkout.payBankDesc")}
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
                    <strong>{t("checkout.payGateway")}</strong>{" "}
                    {t("checkout.payGatewayDesc")}{" "}
                    <code className="inline-code">
                      MockConfigs/PaymentConfigs.json
                    </code>{" "}
                    {t("checkout.payGatewayDescSuffix")}
                  </span>
                </label>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-ghost-dark"
                    onClick={() => setCheckoutStep("buyer")}
                    disabled={checkoutBusy}
                  >
                    {t("checkout.back")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCheckoutPaymentSubmit()}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy
                      ? t("checkout.processing")
                      : t("checkout.continue")}
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
                    ? t("checkout.bankEmailError", {
                        detail: bankEmailInfo.emailError,
                      })
                    : bankEmailInfo?.message ??
                      t("checkout.bankEmailDefault", {
                        email: buyerForm.customerEmail,
                      })}
                </p>
                {bankEmailInfo?.emailPreviewUrl && (
                  <p className="checkout-ethereal-link">
                    <a
                      href={bankEmailInfo.emailPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("checkout.etherealLink")}
                    </a>
                  </p>
                )}
                <div className="bank-box">
                  <h3 className="bank-box__title">
                    {t("checkout.dummyTransferTitle")}
                  </h3>
                  <p className="bank-box__note">{bankTransferInfo.note}</p>
                  <dl className="bank-dl">
                    <dt>{t("checkout.beneficiary")}</dt>
                    <dd>{bankTransferInfo.beneficiary}</dd>
                    <dt>{t("checkout.iban")}</dt>
                    <dd className="mono">{bankTransferInfo.iban}</dd>
                    <dt>{t("checkout.bic")}</dt>
                    <dd className="mono">{bankTransferInfo.bic}</dd>
                    <dt>{t("checkout.bankName")}</dt>
                    <dd>{bankTransferInfo.bankName}</dd>
                    <dt>{t("checkout.variableSymbol")}</dt>
                    <dd className="mono">{bankTransferInfo.variableSymbol}</dd>
                    <dt>{t("checkout.specificSymbol")}</dt>
                    <dd className="mono">{bankTransferInfo.specificSymbol}</dd>
                    <dt>{t("checkout.amount")}</dt>
                    <dd>
                      {formatStorefrontMoney(
                        bankTransferInfo.amount.value,
                        bankTransferInfo.amount.currencyCode,
                      )}
                    </dd>
                  </dl>
                </div>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={closeCheckout}
                  >
                    {t("checkout.done")}
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "gatewayPay" && (
              <div className="checkout-form-stack">
                <p>
                  {t("checkout.gatewayP1")}{" "}
                  <strong>#{gatewayOrderId}</strong> {t("checkout.gatewayP2")}
                </p>
                <p className="muted" style={{ fontSize: "0.82rem" }}>
                  {t("checkout.gatewayHelp", {
                    email: buyerForm.customerEmail,
                  })}
                </p>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="btn btn-ghost-dark"
                    onClick={() => setCheckoutStep("payment")}
                    disabled={checkoutBusy}
                  >
                    {t("checkout.back")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleMockGatewayPay()}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy
                      ? t("checkout.processing")
                      : t("checkout.payMockGateway")}
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
