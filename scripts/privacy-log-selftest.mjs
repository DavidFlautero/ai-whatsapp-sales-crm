import {
  createRequire,
} from "node:module";

import {
  readFileSync,
  readdirSync,
} from "node:fs";

import path from "node:path";

const projectRoot = process.cwd();

const requireFromApi = createRequire(
  path.join(
    projectRoot,
    "apps/api/package.json",
  ),
);

const ts = requireFromApi(
  "typescript",
);

const sourceRoot = path.join(
  projectRoot,
  "apps/api/src",
);

const loggingMethods = new Set([
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
]);

const forbiddenProperties = new Set([
  "phone",
  "phonenumber",
  "customerphone",
  "customerphonenumber",
  "email",
  "address",
  "payload",
  "body",
  "rawbody",
  "requestbody",
  "transcript",
  "transcription",
  "originalmessage",
  "normalizedmessage",
  "resolvedreference",
]);

const sensitiveIdentifiers = new Set([
  "phone",
  "phonenumber",
  "customerphone",
  "customerphonenumber",
  "email",
  "address",
  "payload",
  "transcript",
  "transcription",
  "originalmessage",
  "normalizedmessage",
  "resolvedreference",
]);

function normalize(value) {
  return value
    .replace(
      /[^A-Za-z0-9]/g,
      "",
    )
    .toLowerCase();
}

function listFiles(directory) {
  const files = [];

  for (
    const entry
    of readdirSync(
      directory,
      {
        withFileTypes: true,
      },
    )
  ) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (
      entry.isDirectory()
      && entry.name !== "node_modules"
      && entry.name !== "dist"
      && entry.name !== "dist-hardened"
    ) {
      files.push(
        ...listFiles(fullPath),
      );
      continue;
    }

    if (
      entry.isFile()
      && (
        entry.name.endsWith(".ts")
        || entry.name.endsWith(".tsx")
      )
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function isLoggingCall(
  node,
  sourceFile,
) {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  if (
    !ts.isPropertyAccessExpression(
      node.expression,
    )
  ) {
    return false;
  }

  const method = node.expression.name.text;

  if (!loggingMethods.has(method)) {
    return false;
  }

  const owner = node.expression.expression
    .getText(sourceFile)
    .toLowerCase();

  return (
    owner === "console"
    || owner === "logger"
    || owner.endsWith(".logger")
    || owner.includes("logger")
  );
}

function getPropertyName(
  property,
  sourceFile,
) {
  if (property.name === undefined) {
    return null;
  }

  if (
    ts.isIdentifier(property.name)
    || ts.isStringLiteral(property.name)
    || ts.isNumericLiteral(property.name)
  ) {
    return property.name.text;
  }

  return property.name.getText(sourceFile);
}

function collectSensitiveIdentifiers(node) {
  const found = new Set();

  function visit(current) {
    if (ts.isIdentifier(current)) {
      const normalized = normalize(
        current.text,
      );

      if (
        sensitiveIdentifiers.has(
          normalized,
        )
      ) {
        found.add(normalized);
      }
    }

    ts.forEachChild(
      current,
      visit,
    );
  }

  visit(node);

  return [...found];
}

function safeDerivedMetric(
  initializer,
  sourceFile,
  identifiers,
) {
  const text = initializer
    .getText(sourceFile)
    .replace(/\s+/g, "");

  const dangerousIdentity = identifiers.some(
    (identifier) =>
      identifier === "phone"
      || identifier === "phonenumber"
      || identifier === "customerphone"
      || identifier === "customerphonenumber"
      || identifier === "email"
      || identifier === "address"
      || identifier === "originalmessage"
      || identifier === "normalizedmessage"
      || identifier === "resolvedreference",
  );

  if (dangerousIdentity) {
    return false;
  }

  return (
    /\.(?:length|size)\b/.test(text)
    || /(?:count|length)\(/i.test(text)
  );
}

const findings = [];
let logCalls = 0;
let safeDerivedMetrics = 0;

for (const filename of listFiles(sourceRoot)) {
  const sourceText = readFileSync(
    filename,
    "utf8",
  );

  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );

  function finding(
    node,
    rule,
    detail,
  ) {
    const position =
      sourceFile
        .getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );

    findings.push({
      file: path.relative(
        projectRoot,
        filename,
      ),
      line: position.line + 1,
      rule,
      detail,
    });
  }

  function visit(node) {
    if (isLoggingCall(node, sourceFile)) {
      logCalls += 1;

      for (const argument of node.arguments) {
        if (
          ts.isStringLiteral(argument)
          || ts.isNoSubstitutionTemplateLiteral(
            argument,
          )
        ) {
          continue;
        }

        if (
          ts.isObjectLiteralExpression(
            argument,
          )
        ) {
          for (
            const property
            of argument.properties
          ) {
            const rawName = getPropertyName(
              property,
              sourceFile,
            );

            const normalizedName = normalize(
              rawName ?? "",
            );

            if (
              forbiddenProperties.has(
                normalizedName,
              )
            ) {
              finding(
                property,
                "forbidden_log_property",
                normalizedName,
              );

              continue;
            }

            let initializer = null;

            if (
              ts.isPropertyAssignment(
                property,
              )
            ) {
              initializer =
                property.initializer;
            } else if (
              ts.isShorthandPropertyAssignment(
                property,
              )
            ) {
              initializer =
                property.name;
            }

            if (initializer === null) {
              continue;
            }

            const identifiers =
              collectSensitiveIdentifiers(
                initializer,
              );

            if (identifiers.length === 0) {
              continue;
            }

            if (
              safeDerivedMetric(
                initializer,
                sourceFile,
                identifiers,
              )
            ) {
              safeDerivedMetrics += 1;
              continue;
            }

            finding(
              property,
              "sensitive_log_initializer",
              identifiers.join(","),
            );
          }

          continue;
        }

        const argumentText = argument
          .getText(sourceFile)
          .replace(/\s+/g, "");

        if (
          /\b(?:req|request)\.body\b/i.test(
            argumentText,
          )
        ) {
          finding(
            argument,
            "request_body_direct_argument",
            "body",
          );

          continue;
        }

        const identifiers =
          collectSensitiveIdentifiers(
            argument,
          );

        if (identifiers.length === 0) {
          continue;
        }

        if (
          safeDerivedMetric(
            argument,
            sourceFile,
            identifiers,
          )
        ) {
          safeDerivedMetrics += 1;
          continue;
        }

        finding(
          argument,
          "sensitive_direct_argument",
          identifiers.join(","),
        );
      }
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);
}

const checks = [
  {
    name:
      "no_forbidden_log_properties",

    passed:
      !findings.some(
        ({ rule }) =>
          rule
          === "forbidden_log_property",
      ),
  },

  {
    name:
      "no_sensitive_log_initializers",

    passed:
      !findings.some(
        ({ rule }) =>
          rule
          === "sensitive_log_initializer",
      ),
  },

  {
    name:
      "no_sensitive_direct_log_arguments",

    passed:
      !findings.some(
        ({ rule }) =>
          rule
          === "sensitive_direct_argument"
          || rule
          === "request_body_direct_argument",
      ),
  },
];

for (const item of findings) {
  console.log(
    "FINDING"
    + ` rule=${item.rule}`
    + ` file=${item.file}`
    + ` line=${item.line}`
    + ` detail=${item.detail}`,
  );
}

for (const check of checks) {
  console.log(
    `${
      check.passed
        ? "PASS"
        : "FAIL"
    } ${check.name}`,
  );
}

const failedChecks = checks.filter(
  ({ passed }) => !passed,
).length;

console.log(
  `LOG_CALLS_ANALYZED=${logCalls}`,
);

console.log(
  `SAFE_DERIVED_METRICS=${safeDerivedMetrics}`,
);

console.log(
  `LOG_PRIVACY_FINDINGS=${findings.length}`,
);

console.log(
  `LOG_PRIVACY_CHECKS_TOTAL=${checks.length}`,
);

console.log(
  `LOG_PRIVACY_CHECKS_FAILED=${failedChecks}`,
);

process.exitCode = failedChecks === 0
  ? 0
  : 1;
