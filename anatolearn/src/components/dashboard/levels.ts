export function levelFor(value: number, thresholds = { low: 50, high: 75 }) {
  if (value < thresholds.low) return { word: 'Needs work', bar: 'bg-red-600 dark:bg-red-500' };
  if (value < thresholds.high) return { word: 'Getting there', bar: 'bg-amber-500 dark:bg-amber-400' };
  return { word: 'Strong', bar: 'bg-emerald-600 dark:bg-emerald-500' };
}
