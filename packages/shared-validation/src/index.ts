export function required(value: unknown, name: string) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
