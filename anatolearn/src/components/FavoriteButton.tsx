import { Heart } from 'lucide-react';

interface FavoriteButtonProps {
  title: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}

export default function FavoriteButton({ title, active, disabled, onToggle, className = '' }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${active ? 'Remove from favourites' : 'Save to favourites'}: ${title}`}
      title={active ? 'Remove from favourites' : 'Save to favourites'}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      onKeyDown={(event) => event.stopPropagation()}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:bg-slate-900/90 dark:hover:bg-slate-900 ${className}`}
    >
      <Heart className={`h-4 w-4 ${active ? 'fill-red-500 text-red-500' : 'text-slate-600 dark:text-slate-400'}`} aria-hidden="true" />
    </button>
  );
}
