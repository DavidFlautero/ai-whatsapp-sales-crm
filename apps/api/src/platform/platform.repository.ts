import fs from "node:fs/promises";
import path from "node:path";
import { platformConfigSchema } from "./platform.schema.js";
import type { PlatformConfig } from "./platform.types.js";

const configPath =
  process.env.PLATFORM_CONFIG_PATH ||
  path.resolve(
    process.cwd(),
    "data/platform-config.json",
  );

const tempPath = `${configPath}.tmp`;

export async function readPlatformConfig(): Promise<PlatformConfig> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  return platformConfigSchema.parse(parsed);
}

export async function writePlatformConfig(
  config: PlatformConfig,
): Promise<PlatformConfig> {
  const validated = platformConfigSchema.parse({
    ...config,
    updatedAt: new Date().toISOString(),
  });

  await fs.mkdir(path.dirname(configPath), {
    recursive: true,
  });

  await fs.writeFile(
    tempPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  await fs.rename(tempPath, configPath);

  return validated;
}
