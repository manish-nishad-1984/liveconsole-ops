import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ROUTES } from '@/routes/paths';

/**
 * Rendered rather than redirected to, so the URL stays shareable and the user can
 * see what they were denied — a silent bounce to the dashboard leaves them
 * guessing whether the link was wrong or their access is.
 */
const ForbiddenPage = () => {
  useDocumentTitle('Not permitted');

  return (
    <Card>
      <EmptyState
        icon={Lock}
        title="You do not have access to this"
        description="Your role does not include permission for this screen. Ask an administrator if you think that is wrong."
        action={
          <Button asChild>
            <Link to={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
};

export default ForbiddenPage;
