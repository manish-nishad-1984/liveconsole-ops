import { APP_NAME } from '@liveconsole-ops/shared';
import { useEffect } from 'react';

/**
 * Sets the browser tab title.
 *
 * Worth doing properly: operators keep several tabs of the same app open, and one
 * identical title on all of them makes them indistinguishable.
 */
export const useDocumentTitle = (title: string | null | undefined): void => {
  useEffect(() => {
    if (!title) return;

    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
