import type { ReactNode } from 'react';

/** Android: menus fill the (portrait) screen exactly as before. */
export function MenuFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
