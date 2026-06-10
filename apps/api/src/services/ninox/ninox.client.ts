import { env } from "../../config/env.js";

export async function callNinox(path: string) {
  if (!env.NINOX_BASE_URL || !env.NINOX_API_KEY) {
    console.log("[ninox] not configured");
    return null;
  }

  const response = await fetch(`${env.NINOX_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${env.NINOX_API_KEY}`
    }
  });

  return response.json();
}
