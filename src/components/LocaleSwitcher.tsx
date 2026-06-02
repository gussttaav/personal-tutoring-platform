'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

interface LocaleSwitcherProps {
  onSwitch?: () => void;
}

export function LocaleSwitcher({ onSwitch }: LocaleSwitcherProps) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(nextLocale: 'es' | 'en') {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
    onSwitch?.();
  }

  return (
    <div
      role="group"
      aria-label={t('languageSwitcher')}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '3px',
        gap: '2px',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {routing.locales.map((l) => {
        const isActive = l === locale;
        return (
          <button
            key={l}
            onClick={() => onChange(l as 'es' | 'en')}
            disabled={isPending || isActive}
            style={{
              padding: '3px 10px',
              borderRadius: '5px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: isActive ? 'rgba(78,222,163,0.15)' : 'transparent',
              color: isActive ? '#4edea3' : '#86948a',
              border: isActive ? '1px solid rgba(78,222,163,0.25)' : '1px solid transparent',
              cursor: isActive ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
