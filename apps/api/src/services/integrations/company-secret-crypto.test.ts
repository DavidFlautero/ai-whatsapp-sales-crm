import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptCompanySecret,
  decryptCompanySecret,
} from "./company-secret-crypto.js";

const key = randomBytes(32);
const context = {
  companyId: "delibocados",
  provider: "toteat",
  keyVersion: 1,
};

test("cifrado y descifrado", () => {
  const encrypted = encryptCompanySecret("prueba", context, key);
  assert.equal(
    decryptCompanySecret(encrypted, context, key),
    "prueba",
  );
});

test("aislamiento entre empresas", () => {
  const encrypted = encryptCompanySecret("prueba", context, key);
  assert.throws(() =>
    decryptCompanySecret(
      encrypted,
      { ...context, companyId: "fulanitas" },
      key,
    ),
  );
});

test("aislamiento entre proveedores", () => {
  const encrypted = encryptCompanySecret("prueba", context, key);
  assert.throws(() =>
    decryptCompanySecret(
      encrypted,
      { ...context, provider: "ninox" },
      key,
    ),
  );
});

test("rechaza clave maestra incorrecta", () => {
  const encrypted = encryptCompanySecret("prueba", context, key);
  assert.throws(() =>
    decryptCompanySecret(encrypted, context, randomBytes(32)),
  );
});

test("detecta modificaciones del contenido", () => {
  const encrypted = encryptCompanySecret("prueba", context, key);
  const corrupted = {
    ...encrypted,
    ciphertext: Buffer.from(encrypted.ciphertext),
  };
  corrupted.ciphertext[0] ^= 1;
  assert.throws(() =>
    decryptCompanySecret(corrupted, context, key),
  );
});

test("utiliza IV distintos", () => {
  const a = encryptCompanySecret("prueba", context, key);
  const b = encryptCompanySecret("prueba", context, key);
  assert.notDeepEqual(a.iv, b.iv);
});
