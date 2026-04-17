import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus, PaymentMethod } from "@prisma/client";

const {
  mockPrisma,
  mockIsFaultEnabled,
  mockLoadMockPaymentOutcomeForEmail,
} = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  mockIsFaultEnabled: vi.fn(),
  mockLoadMockPaymentOutcomeForEmail: vi.fn(),
}));

vi.mock("../../db/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../faults/faultService", () => ({
  isFaultEnabled: mockIsFaultEnabled,
}));

vi.mock("../mockPaymentConfigService", () => ({
  loadMockPaymentOutcomeForEmail: mockLoadMockPaymentOutcomeForEmail,
}));

import {
  buildDummyBankTransferInfo,
  checkoutBankTransfer,
  checkoutGatewayInit,
  mockGatewayPayment,
  validateBuyer,
} from "../checkoutService";

const buyer = {
  email: "shopper@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "+420123456789",
};

const TEST_CART_KEY = "aaaaaaaa-bbbb-4ccc-bddd-111111111111";

const activeProductCartRow = {
  productId: 101,
  quantity: 2,
  product: {
    name: "Keyboard",
    price: 400,
    active: true,
    inStock: 10,
    currencyId: 1,
    currency: { code: "CZK", id: 1 },
  },
};

/** Unit tests for bank-transfer checkout, gateway init, and mock PSP capture (Prisma + config mocked). */
describe("checkoutService", () => {
  beforeEach(() => {
    mockIsFaultEnabled.mockReturnValue(false);
    mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
    mockPrisma.order.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("validateBuyer", () => {
    // Rejects checkout when the mandatory customerEmail field is empty so bad data never reaches Prisma.
    it("throws when email is missing", () => {
      expect(() =>
        validateBuyer({ ...buyer, email: "" }),
      ).toThrowError(/customerEmail is required/);
    });

    // Rejects whitespace-only phone; same validation rules as email for required contact fields.
    it("throws when phone is missing", () => {
      expect(() =>
        validateBuyer({ ...buyer, phone: "   " }),
      ).toThrowError(/customerPhone is required/);
    });

    it.each([
      ["customerFirstName", { ...buyer, firstName: "" }],
      ["customerLastName", { ...buyer, lastName: "   " }],
    ])("throws when %s is missing", (_field, payload) => {
      expect(() => validateBuyer(payload)).toThrowError(/is required/);
    });
  });

  describe("buildDummyBankTransferInfo", () => {
    it("includes dummy IBAN and order-based variable symbol", () => {
      const info = buildDummyBankTransferInfo({
        id: 12,
        total: 1999,
        currency: { code: "CZK" },
      });
      expect(info.iban).toContain("CZ65");
      expect(info.variableSymbol).toBe(String(900_000_012));
      expect(info.amount).toEqual({ value: 1999, currencyCode: "CZK" });
    });

    it("uses English note and defaults currency code to CZK", () => {
      const info = buildDummyBankTransferInfo({
        id: 13,
        total: 100,
        currency: null,
        lang: "en",
      });
      expect(info.amount.currencyCode).toBe("CZK");
      expect(info.note).toContain("DUMMY PAYMENT DETAILS");
    });
  });

  describe("checkoutBankTransfer", () => {
    // Bank-transfer path must not create an order when there are no cart lines.
    it("throws when cart is empty", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([]),
            deleteMany: vi.fn(),
          },
          order: { create: vi.fn() },
          product: { update: vi.fn() },
        };
        return fn(tx);
      });

      await expect(checkoutBankTransfer(TEST_CART_KEY, buyer)).rejects.toThrow(
        "Cart is empty",
      );
    });

    it("creates PAID bank-transfer order, decrements stock, clears cart", async () => {
      const createdOrder = {
        id: 55,
        userId: 1,
        total: 800,
        status: OrderStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        items: [],
        currency: { code: "CZK" },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([activeProductCartRow]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          order: {
            create: vi.fn().mockResolvedValue(createdOrder),
          },
          product: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await checkoutBankTransfer(TEST_CART_KEY, buyer);

      expect(result).toBe(createdOrder);
      const fn = mockPrisma.$transaction.mock.calls[0]?.[0];
      expect(typeof fn).toBe("function");
    });

    it("trims optional address fields to null/trimmed values in created order payload", async () => {
      const createSpy = vi.fn().mockResolvedValue({
        id: 56,
        userId: 1,
        total: 800,
        status: OrderStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        items: [],
        currency: { code: "CZK" },
      });
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([activeProductCartRow]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          order: { create: createSpy },
          product: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await checkoutBankTransfer(TEST_CART_KEY, {
        ...buyer,
        addressLine1: "  Main street  ",
        addressLine2: "   ",
        city: " Prague ",
        postalCode: "",
        country: " CZ ",
      });

      const createArg = createSpy.mock.calls[0]?.[0];
      expect(createArg.data).toMatchObject({
        addressLine1: "Main street",
        addressLine2: null,
        city: "Prague",
        postalCode: null,
        country: "CZ",
      });
    });

    it("throws when cart contains inactive product", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([
              {
                ...activeProductCartRow,
                product: { ...activeProductCartRow.product, active: false },
              },
            ]),
            deleteMany: vi.fn(),
          },
          order: { create: vi.fn() },
          product: { update: vi.fn() },
        };
        return fn(tx);
      });

      await expect(checkoutBankTransfer(TEST_CART_KEY, buyer)).rejects.toThrow(/not available/);
    });

    it("throws when cart quantity exceeds in-stock during checkout", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([
              {
                ...activeProductCartRow,
                quantity: 9,
                product: { ...activeProductCartRow.product, inStock: 2 },
              },
            ]),
            deleteMany: vi.fn(),
          },
          order: { create: vi.fn() },
          product: { update: vi.fn() },
        };
        return fn(tx);
      });

      await expect(checkoutBankTransfer(TEST_CART_KEY, buyer)).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe("checkoutGatewayInit", () => {
    // Idempotency guard: if the user already has a PENDING PAYMENT_GATEWAY order, reuse it instead of duplicating checkout.
    it("returns existing pending gateway order without starting a new transaction", async () => {
      const existing = {
        id: 99,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        items: [],
      };
      mockPrisma.order.findFirst.mockResolvedValue(existing);

      const result = await checkoutGatewayInit(TEST_CART_KEY, buyer);

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
          guestCartKey: TEST_CART_KEY,
          status: OrderStatus.PENDING,
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        },
        orderBy: { id: "desc" },
        include: { items: { include: { product: true } }, currency: true },
      });

      expect(result).toBe(existing);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // New gateway checkout still requires a non-empty cart when there is no reusable pending order.
    it("throws when cart empty and no existing pending order", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          order: { create: vi.fn() },
        };
        return fn(tx);
      });

      await expect(checkoutGatewayInit(TEST_CART_KEY, buyer)).rejects.toThrow(
        "Cart is empty",
      );
    });

    it("throws early when customer first name is missing", async () => {
      const invalidBuyer = { ...buyer, firstName: " " };
      await expect(checkoutGatewayInit(TEST_CART_KEY, invalidBuyer)).rejects.toThrow(
        "customerFirstName is required",
      );
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws when gateway-init cart contains inactive product", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          cartItem: {
            findMany: vi.fn().mockResolvedValue([
              {
                ...activeProductCartRow,
                product: { ...activeProductCartRow.product, active: false },
              },
            ]),
          },
          order: { create: vi.fn() },
        };
        return fn(tx);
      });

      await expect(checkoutGatewayInit(TEST_CART_KEY, buyer)).rejects.toThrow(/not available/);
    });
  });

  describe("mockGatewayPayment", () => {
    // PSP mock cannot run if the order id does not exist.
    it("throws when order not found", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(mockGatewayPayment(404)).rejects.toThrow("Order not found");
    });

    it("throws when payment method is not gateway", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 1,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        customerEmail: "a@b.com",
        items: [],
        userId: 1,
        currency: null,
      });

      await expect(mockGatewayPayment(1)).rejects.toThrow(
        "not using the payment gateway flow",
      );
    });

    it("throws when order is not in pending status", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 2,
        status: OrderStatus.PAID,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "a@b.com",
        items: [],
        userId: 1,
        currency: null,
      });

      await expect(mockGatewayPayment(2)).rejects.toThrow(/cannot be processed/);
    });

    // When PaymentConfigs maps the buyer email to failure: mark order CANCELLED, no stock change, no $transaction capture.
    it("cancels order when mock config resolves to failure", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 3,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "pay-fail@example.com",
        items: [{ productId: 1, quantity: 1 }],
        userId: 1,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("failure");
      mockPrisma.order.update.mockResolvedValue({});

      const result = await mockGatewayPayment(3);

      expect(result.success).toBe(false);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // Success path: re-load order in tx, check stock, decrement products, set PAID, empty the user’s cart.
    it("captures payment: decrements stock, PAID, clears cart when config is success", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 10,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");

      const cartDeleteMany = vi.fn().mockResolvedValue({ count: 2 });

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 10,
              status: OrderStatus.PENDING,
              userId: 7,
              guestCartKey: TEST_CART_KEY,
              items: [{ productId: 20, quantity: 1 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 5 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: cartDeleteMany,
          },
        };
        return fn(tx);
      });

      const result = await mockGatewayPayment(10);

      expect(result.success).toBe(true);
      expect(result.mockPaymentBehavior).toBe("success");
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(cartDeleteMany).toHaveBeenCalledWith({
        where: { cartKey: TEST_CART_KEY },
      });
    });

    it("fails capture when product stock is insufficient during transaction", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 12,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 3 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 12,
              status: OrderStatus.PENDING,
              userId: 7,
              guestCartKey: TEST_CART_KEY,
              items: [{ productId: 20, quantity: 3 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 1 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return fn(tx);
      });

      await expect(mockGatewayPayment(12)).rejects.toThrow(/Insufficient stock/);
    });

    it("fails when order is no longer awaiting payment inside transaction", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 14,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 14,
              status: OrderStatus.PAID,
              userId: 7,
              guestCartKey: TEST_CART_KEY,
              items: [{ productId: 20, quantity: 1 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 5 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await expect(mockGatewayPayment(14)).rejects.toThrow(/no longer awaiting payment/);
    });

    it("fails when order disappears inside capture transaction", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 16,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 5 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await expect(mockGatewayPayment(16)).rejects.toThrow(/no longer awaiting payment/);
    });

    it("success path skips cart cleanup when guestCartKey is missing", async () => {
      const deleteManySpy = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 15,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: null,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 15,
              status: OrderStatus.PENDING,
              userId: 7,
              guestCartKey: null,
              items: [{ productId: 20, quantity: 1 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 5 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: deleteManySpy,
          },
        };
        return fn(tx);
      });

      const result = await mockGatewayPayment(15);
      expect(result.success).toBe(true);
      expect(deleteManySpy).not.toHaveBeenCalled();
    });

    it("fails when a product row is missing during stock check", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 17,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "ok@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("success");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 17,
              status: OrderStatus.PENDING,
              userId: 7,
              guestCartKey: TEST_CART_KEY,
              items: [{ productId: 20, quantity: 1 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return fn(tx);
      });

      await expect(mockGatewayPayment(17)).rejects.toThrow(/Insufficient stock/);
    });

    // With behavior "random", payment fails when Math.random() < 0.5; here we fix 0.1 so the outcome is a declined random roll.
    it("uses random outcome: mocks Math.random for deterministic decline", async () => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

      mockPrisma.order.findUnique.mockResolvedValue({
        id: 11,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "pay-random@example.com",
        items: [],
        userId: 1,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("random");
      mockPrisma.order.update.mockResolvedValue({});

      const result = await mockGatewayPayment(11);

      expect(result.success).toBe(false);
      expect(result.mockPaymentBehavior).toBe("random");
      expect(result.mockRandomRollSuccess).toBe(false);
      randomSpy.mockRestore();
    });

    it("uses random outcome: success branch when Math.random >= 0.5", async () => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 13,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        customerEmail: "pay-random-success@example.com",
        items: [{ productId: 20, quantity: 1 }],
        userId: 7,
        guestCartKey: TEST_CART_KEY,
        currency: null,
      });
      mockLoadMockPaymentOutcomeForEmail.mockReturnValue("random");
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 13,
              status: OrderStatus.PENDING,
              userId: 7,
              guestCartKey: TEST_CART_KEY,
              items: [{ productId: 20, quantity: 1 }],
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          product: {
            findUnique: vi.fn().mockResolvedValue({ id: 20, inStock: 5 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      const result = await mockGatewayPayment(13);

      expect(result.success).toBe(true);
      expect(result.mockPaymentBehavior).toBe("random");
      expect(result.mockRandomRollSuccess).toBe(true);
      randomSpy.mockRestore();
    });
  });
});
