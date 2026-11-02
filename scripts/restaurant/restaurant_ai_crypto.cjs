"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const mode = process.argv[2];
const keyPath = process.argv[3];
const key = fs.readFileSync(keyPath);
if (key.length !== 32) throw Error("INVALID_32_BYTE_ENCRYPTION_KEY");
const AAD = Buffer.from("restaurant-ai:delibocados:v1");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  input += chunk;
  if (input.length > 60000) process.exit(2);
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    if (mode === "encrypt") {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(AAD);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
      process.stdout.write(JSON.stringify({
        v: 1, iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64")
      }));
    } else if (mode === "decrypt") {
      if (data.v !== 1) throw Error("INVALID_FORMAT");
      const iv = Buffer.from(data.iv, "base64");
      const tag = Buffer.from(data.tag, "base64");
      if (iv.length !== 12 || tag.length !== 16) throw Error("INVALID_CIPHERTEXT");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      const clear = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]);
      process.stdout.write(clear.toString("utf8"));
    } else {
      throw Error("INVALID_OPERATION");
    }
  } catch {
    process.stderr.write("CRYPTO_OPERATION_FAILED\n");
    process.exitCode = 1;
  }
});
