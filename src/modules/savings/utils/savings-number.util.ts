export function formatSavingsAccountNumber(sequenceValue: number): string {
  return `SAV-${String(sequenceValue).padStart(8, '0')}`;
}
