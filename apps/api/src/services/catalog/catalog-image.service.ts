import { env } from "../../config/env.js";

const BUCKET = "catalog-images";

function cleanSegment(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function extensionForMime(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new Error("Formato de imagen no permitido");
  }
}

export async function uploadCatalogImage(input: {
  companyId: string;
  baseSku: string;
  colorCode: string;
  role: "cover" | "front" | "back" | "detail" | "model";
  file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
}) {
  if (
    !env.SUPABASE_URL
    || !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Supabase no está configurado");
  }

  if (input.file.size <= 0) {
    throw new Error("La imagen está vacía");
  }

  if (input.file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen supera el máximo de 5 MB");
  }

  const extension =
    extensionForMime(input.file.mimetype);

  const objectPath = [
    cleanSegment(input.companyId),
    cleanSegment(input.baseSku),
    cleanSegment(input.colorCode),
    `${input.role}-${Date.now()}.${extension}`,
  ].join("/");

  const baseUrl =
    env.SUPABASE_URL.replace(/\/+$/, "");

  const uploadUrl =
    `${baseUrl}/storage/v1/object/${BUCKET}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey:
        env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:
        `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type":
        input.file.mimetype,
      "x-upsert": "true",
    },
    body: new Uint8Array(
      input.file.buffer,
    ),
  });

  const responseText =
    await response.text();

  if (!response.ok) {
    console.error(
      "[CATALOG IMAGE UPLOAD ERROR]",
      {
        status: response.status,
        body: responseText,
      },
    );

    throw new Error(
      "No se pudo subir la imagen a Supabase",
    );
  }

  return {
    bucket: BUCKET,
    path: objectPath,
    role: input.role,
    url:
      `${baseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`,
  };
}
