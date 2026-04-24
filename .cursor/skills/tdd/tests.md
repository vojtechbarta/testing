# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: tests observable behavior through public API
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Repository-oriented examples:

```typescript
// GOOD: backend verifies behavior via service interface
it("returns 404 for missing order", async () => {
  const response = await orderService.getOrder("missing-id");
  expect(response.kind).toBe("not_found");
});
```

```typescript
// GOOD: UI verifies user-visible behavior via E2E flow
test("shopper can add item and see cart count increment", async ({ page, shopPage }) => {
  await shopPage.goto();
  await shopPage.addFirstVisibleProductToCart();
  await expect(page.getByRole("status", { name: /cart/i })).toContainText("1");
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion focus per test

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

```typescript
// BAD: tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = vi.spyOn(paymentService, "process");
  await checkout(cart, payment);
  expect(mockPayment).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order for internal calls
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through side channels instead of the interface

```typescript
// BAD: bypasses interface to verify persistence details
test("createUser writes row", async () => {
  await createUser({ name: "Alice" });
  const row = await prisma.user.findFirst({ where: { name: "Alice" } });
  expect(row).toBeDefined();
});

// GOOD: verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```
