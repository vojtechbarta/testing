import request from "supertest";
import { app } from "./internalApiTestHarness";

type Credentials = {
  username: string;
  password: string;
};

async function loginAndGetToken(credentials: Credentials) {
  const login = await request(app).post("/auth/login").send(credentials).expect(200);
  return (login.body as { token: string }).token;
}

export async function loginAsAdmin() {
  return loginAndGetToken({ username: "admin", password: "admin" });
}

export async function loginAsTester() {
  return loginAndGetToken({ username: "tester", password: "tester" });
}
