# Mock configs (dev / testing)

## `PaymentConfigs.json`

- **`byBuyerEmail`**: map of **buyer email** (from checkout) → mock gateway result:
  - **`success`** — payment always succeeds
  - **`failure`** — payment always fails (order → `CANCELLED`, no stock change)
  - **`random`** — 50/50 success/failure (`Math.random()`)

Matching is **case-insensitive**. If an email is **not** listed, the mock gateway treats it as **`success`**.

Edit the JSON while the server runs; each `/mock-pay` request re-reads the file.
