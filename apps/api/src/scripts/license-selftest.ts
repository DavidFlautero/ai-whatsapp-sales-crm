import {
  getRuntimeState,
} from "../services/runtime/core-state.service.js";


const status =
  getRuntimeState({
    refresh:
      true,
  });


console.log("");
console.log(
  "===== INTERNAL LICENSE SELFTEST =====",
);

console.log({
  signatureValid:
    status.signatureValid,

  fingerprintMatch:
    status.fingerprintMatch,

  customerMatch:
    status.customerMatch,

  notExpired:
    status.notExpired,

  featuresValid:
    status.featuresValid,

  valid:
    status.valid,

  reason:
    status.reason,

  customer:
    status.customer,

  licenseId:
    status.licenseId,
});

console.log("");


if (!status.valid) {
  console.error(
    "❌ INTERNAL LICENSE SELFTEST FAILED",
  );

  process.exitCode =
    1;
} else {
  console.log(
    "✅ INTERNAL LICENSE SELFTEST PASSED",
  );
}
