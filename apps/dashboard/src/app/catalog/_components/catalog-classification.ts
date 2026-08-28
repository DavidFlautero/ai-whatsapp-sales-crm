export type CatalogCategoryInput = {
  baseSku?: string | null;
  name?: string | null;
  explicitCategory?: string | null;
};

function normalize(
  value: string | null | undefined,
) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function prettyCategory(
  value: string | null | undefined,
) {
  const text = normalize(value);

  const aliases: Record<string, string> = {
    JEAN: "Jeans",
    JEANS: "Jeans",
    PANTALON: "Pantalones",
    PANTALONES: "Pantalones",
    VESTIDO: "Vestidos",
    VESTIDOS: "Vestidos",
    BIKINI: "Bikinis",
    BIKINIS: "Bikinis",
    BUZO: "Buzos",
    BUZOS: "Buzos",
    CALZA: "Calzas",
    CALZAS: "Calzas",
    REMERA: "Remeras",
    REMERAS: "Remeras",
    CAMPERA: "Camperas",
    CAMPERAS: "Camperas",
    CAMISA: "Camisas",
    CAMISAS: "Camisas",
    CONJUNTO: "Conjuntos",
    CONJUNTOS: "Conjuntos",
    SHORT: "Shorts",
    SHORTS: "Shorts",
    FALDA: "Faldas",
    FALDAS: "Faldas",
    POLLERA: "Faldas",
    POLLERAS: "Faldas",
    ACCESORIO: "Accesorios",
    ACCESORIOS: "Accesorios",
  };

  if (aliases[text]) {
    return aliases[text];
  }

  if (!text) {
    return "Sin categoría";
  }

  return text
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letter) => letter.toUpperCase(),
    );
}

export function inferCatalogCategory(
  input: CatalogCategoryInput,
): string {
  const code =
    normalize(input.baseSku);

  const name =
    normalize(input.name);

  const codeRules: Array<[RegExp, string]> = [
    [/^VES/, "Vestidos"],
    [/^PAN/, "Pantalones"],
    [/^BIK/, "Bikinis"],
    [/^BUZ/, "Buzos"],
    [/^CAL/, "Calzas"],
    [/^REM/, "Remeras"],
    [/^CAMP/, "Camperas"],
    [/^CONJ/, "Conjuntos"],
    [/^SHO/, "Shorts"],
    [/^(FAL|POL)/, "Faldas"],
    [/^ACC/, "Accesorios"],
    [/^(JEA|JIN)/, "Jeans"],
  ];

  for (const [pattern, category] of codeRules) {
    if (pattern.test(code)) {
      return category;
    }
  }

  const nameRules: Array<[RegExp, string]> = [
    [/\bVESTID/, "Vestidos"],
    [/\bPANTALON|\bPALAZZO/, "Pantalones"],
    [/\bBIKINI/, "Bikinis"],
    [/\bBUZO/, "Buzos"],
    [/\bCALZA/, "Calzas"],
    [/\bREMERA/, "Remeras"],
    [/\bCAMPERA/, "Camperas"],
    [/\bCAMISA/, "Camisas"],
    [/\bCONJUNTO/, "Conjuntos"],
    [/\bSHORT/, "Shorts"],
    [/\bFALDA|\bPOLLERA/, "Faldas"],
    [/\bJEAN/, "Jeans"],
  ];

  for (const [pattern, category] of nameRules) {
    if (pattern.test(name)) {
      return category;
    }
  }

  return prettyCategory(
    input.explicitCategory,
  );
}
