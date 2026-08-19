import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemePreference } from './theme';

const OPTIONS = [
  ['light', Sun, 'Light'],
  ['dark', Moon, 'Dark'],
  ['system', Monitor, 'Match system'],
];

export default function ThemeToggle() {
  const [preference, choose] = useThemePreference();

  return (
    <div className="flex overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700">
      {OPTIONS.map(([id, Icon, label]) => (
        <button
          key={id}
          onClick={() => choose(id)}
          title={label}
          aria-label={label}
          aria-pressed={preference === id}
          className={`grid h-9 w-9 place-items-center transition ${
            preference === id
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
