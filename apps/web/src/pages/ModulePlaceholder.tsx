import { getModuleByPath } from '@liveconsole-ops/shared';
import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/layouts/PageLayout';

/**
 * Rendered for a module that has a registry entry but no page yet.
 *
 * It says so plainly rather than showing an empty screen, which would read as
 * broken. The registry entry, the nav item, the route and the guard are all
 * already live — only the page component is missing.
 */
const ModulePlaceholder = () => {
  const { pathname } = useLocation();
  const module = getModuleByPath(pathname);

  return (
    <PageLayout
      title={module?.label ?? 'Module'}
      description={module?.description ?? 'This screen has not been built yet.'}
    >
      <Card>
        <EmptyState
          icon={Construction}
          title="Not built yet"
          description={`The "${module?.label ?? pathname}" module is registered and guarded, but its page component has not been written. Add it to MODULE_PAGES in apps/web/src/routes/module-routes.tsx.`}
        />
      </Card>
    </PageLayout>
  );
};

export default ModulePlaceholder;
