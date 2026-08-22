import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowLoginAttempt,
  isPublicApi,
  parseCookie,
  readSession,
  resetLoginAttempts,
  safeEqual,
  signSession,
  verifyCredentials,
} from "./auth.ts";

const config = {
  username: "nikan",
  password: "secret-pass",
  secret: "test-secret",
  configured: true,
};

test("only matching operator credentials succeed", () => {
  assert.equal(verifyCredentials("nikan", "secret-pass", config), true);
  assert.equal(verifyCredentials("nikan", "wrong", config), false);
  assert.equal(verifyCredentials("other", "secret-pass", config), false);
  assert.equal(verifyCredentials("nikan", "secret-pass", { ...config, configured: false }), false);
});

test("signed sessions expire and reject tampering", () => {
  const token = signSession("nikan", config, 1_700_000_000_000);
  assert.equal(readSession(token, config, 1_700_000_000_000), "nikan");
  assert.equal(readSession(`${token}x`, config, 1_700_000_000_000), null);
  assert.equal(readSession(token, config, 1_800_000_000_000), null);
  assert.equal(readSession(token, { ...config, username: "other" }, 1_700_000_000_000), null);
});

test("cookie parser reads the session value", () => {
  assert.equal(parseCookie("a=1; price_update_session=abc%2Edef; b=2", "price_update_session"), "abc.def");
  assert.equal(parseCookie("a=1", "price_update_session"), null);
});

test("login and session status stay public", () => {
  assert.equal(isPublicApi("POST", "/api/login"), true);
  assert.equal(isPublicApi("POST", "/api/logout"), true);
  assert.equal(isPublicApi("GET", "/api/auth/me"), true);
  assert.equal(isPublicApi("GET", "/api/health"), false);
  assert.equal(isPublicApi("GET", "/api/daily-prices"), false);
});

test("timing-safe compare rejects different strings", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
});

test("login attempts are rate limited per key", () => {
  const key = `test-${Date.now()}`;
  for (let i = 0; i < 10; i += 1) assert.equal(allowLoginAttempt(key, 1000), true);
  assert.equal(allowLoginAttempt(key, 1000), false);
  resetLoginAttempts(key);
  assert.equal(allowLoginAttempt(key, 1000), true);
  resetLoginAttempts(key);
});
