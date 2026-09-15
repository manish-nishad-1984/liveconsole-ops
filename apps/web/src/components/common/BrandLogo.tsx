import logoOnDark from '@/assets/brand/logo-on-dark.png';
import logoOnLight from '@/assets/brand/logo-on-light.png';
import markSrc from '@/assets/brand/mark.png';
import { cn } from '@/lib/utils';

/**
 * The LiveConsole logo. The wordmark is black on light surfaces and white on dark
 * ones, so both files render and the theme class decides which one shows —
 * nothing here reads the theme store, and a theme switch never flashes the wrong
 * one while an image loads.
 *
 * `surface` pins one variant for a panel whose background does not follow the
 * theme (the always-dark sign-in panel). Size it with a height class; the width
 * follows the image.
 */

export interface BrandLogoProps {
  className?: string;
  surface?: 'theme' | 'light' | 'dark';
}

export const BrandLogo = ({ className, surface = 'theme' }: BrandLogoProps) => {
  const base = cn('block w-auto select-none', className);

  if (surface !== 'theme') {
    return (
      <img
        src={surface === 'dark' ? logoOnDark : logoOnLight}
        alt="LiveConsole"
        className={base}
        draggable={false}
      />
    );
  }

  return (
    <>
      <img src={logoOnLight} alt="LiveConsole" className={cn(base, 'dark:hidden')} draggable={false} />
      <img
        src={logoOnDark}
        alt="LiveConsole"
        className={cn(base, 'hidden dark:block')}
        draggable={false}
      />
    </>
  );
};

/** The mark alone — for the collapsed sidebar and other square spots. */
export const BrandMark = ({ className }: { className?: string }) => (
  <img
    src={markSrc}
    alt="LiveConsole"
    className={cn('block select-none', className)}
    draggable={false}
  />
);
