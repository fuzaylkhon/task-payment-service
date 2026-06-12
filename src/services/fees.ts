// amount is in minor units e.g. 2.5 %
export function calculateFee(
  amount: number,
  feePercent: number,
): { fee: number; amountToReceive: number } {
  const fee = Math.round((amount * feePercent) / 100);
  return { fee, amountToReceive: amount - fee };
}
