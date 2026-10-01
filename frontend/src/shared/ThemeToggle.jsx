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
    <div className="flex overflow-hidden rounded-[var(--r-pill)] border border-[var(--c-border-strong)]">
      {OPTIONS.map(([id, Icon, label]) => {
        const active = preference === id;
        return (
          <button
            key={id}
            onClick={() => choose(id)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className="grid h-9 w-9 place-items-center transition-colors duration-150"
            style={{
              background: active ? 'var(--c-accent)' : 'transparent',
              color: active ? 'var(--c-accent-ink)' : 'var(--c-ink-muted)',
            }}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}
