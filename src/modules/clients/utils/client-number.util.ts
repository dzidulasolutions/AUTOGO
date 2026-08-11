export function formatClientNumber(
  branchCode: string,
  sequenceValue: number,
): string {
  const paddedNumber = String(sequenceValue).padStart(6, '0');
  return `${branchCode}-${paddedNumber}`;
}
