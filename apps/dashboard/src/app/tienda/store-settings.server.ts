function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:4000"
  ).replace(
    /\/+$/,
    "",
  );
}

export async function getStoreHeroImage():
  Promise<string | null> {
  try {
    const response =
      await fetch(
        `${apiBaseUrl()}/public/store-settings`,
        {
          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return typeof data?.heroImageUrl
      === "string"
      ? data.heroImageUrl
      : null;
  } catch {
    return null;
  }
}
