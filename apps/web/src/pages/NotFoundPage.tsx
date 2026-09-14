import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ROUTES } from '@/routes/paths';

const NotFoundPage = () => {
  useDocumentTitle('Not found');

  return (
    <Card>
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="That URL does not match any screen in this application."
        action={
          <Button asChild>
            <Link to={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
};

export default NotFoundPage;
