export function formatCycleNumber(sequenceValue: number): string {
  return `TON-${String(sequenceValue).padStart(6, '0')}`;
}