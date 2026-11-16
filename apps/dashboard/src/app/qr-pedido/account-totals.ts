/** Values shown to the customer; never modify the checkout items with old lines. */
export function calculateTableBill(
  confirmedPreviousTotal: number | null | undefined,
  newCartSubtotal: number
) {
  const previousCOP = Number.isSafeInteger(confirmedPreviousTotal) &&
    (confirmedPreviousTotal ?? -1) >= 0 ? confirmedPreviousTotal! : 0;
  const additionalCOP = Number.isSafeInteger(newCartSubtotal) && newCartSubtotal >= 0
    ? newCartSubtotal : 0;
  return {
    previousCOP,
    additionalCOP,
    projectedCOP: previousCOP + additionalCOP
  };
}
