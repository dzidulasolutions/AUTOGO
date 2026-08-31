export function formatLoanNumber(sequenceValue: number): string {
  return `LOAN-${String(sequenceValue).padStart(6, '0')}`;
}
