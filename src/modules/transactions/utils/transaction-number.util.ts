export function formatTransactionNumber(sequenceValue: number): string {
  return `TXN-${String(sequenceValue).padStart(8, '0')}`;
}
