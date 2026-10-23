import { levelFor } from './levels';

export interface BarItem {
  label: string;
  value: number; // 0-100
  detail?: string;
}

// Accuracy-style bar rows. Colour is a hint only: every row also states the percentage and a word for its level.
export default function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((item) => {
        const value = Math.max(0, Math.min(100, Math.round(item.value)));
        const level = levelFor(value);
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
              <span className="flex-shrink-0 text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{value}%</span> · {level.word}{item.detail ? ` · ${item.detail}` : ''}
              </span>
            </div>
            <div role="img" aria-label={`${item.label}: ${value}%, ${level.word}`} className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${value}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
