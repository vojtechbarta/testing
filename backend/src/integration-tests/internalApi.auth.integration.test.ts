import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, setupInternalApiSuite } from "./helpers/internalApiTestHarness";

describe("Internal API - auth", () => {
  setupInternalApiSuite();

  it("POST /auth/login rejects bad credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "wrong" })
      .expect(401);
    expect(res.body.message).toBeDefined();
  });
});
