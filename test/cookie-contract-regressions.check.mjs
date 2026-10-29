import assert from "node:assert/strict";
import test from "node:test";
import { hasCookieUse } from "../scripts/verify-cookie-contract.mjs";

const forbidden = [
  "document.cookie = 'session=x'",
  "const saved = document['cookie']",
  "cookieStore.set('session', 'x')",
  "response.setHeader('Set-Cookie', 'sid=x')",
  "headers.append('Set-Cookie', 'sid=x')",
  "response.headers.set('set-cookie', 'sid=x')",
  "new Headers({ 'Set-Cookie': 'sid=x' })",
  "const response = { headers: { 'Set-Cookie': 'sid=x' } }",
  "createCookieSessionStorage({ cookie: {} })",
];

for (const [index, source] of forbidden.entries()) {
  test(`undeclared cookie API fixture ${index + 1} is rejected`, () => {
    assert.equal(hasCookieUse(source), true);
  });
}

const allowed = [
  "headers.set('Content-Type', 'application/json')",
  "localStorage.setItem('theme', 'dark')",
  "const cookiePolicy = 'no browser cookie operations';",
];
for (const [index, source] of allowed.entries()) {
  test(`unrelated source fixture ${index + 1} stays allowed`, () => {
    assert.equal(hasCookieUse(source), false);
  });
}
