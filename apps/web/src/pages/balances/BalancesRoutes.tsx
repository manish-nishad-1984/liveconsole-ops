import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useCan } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';

const BalancesListPage = lazy(() => import('@/pages/balances/BalancesListPage'));
const StatementPage = lazy(() => import('@/pages/balances/StatementPage'));

/**
 * `/balances` lists everyone for an administrator. An employee has exactly one
 * balance — their own — so the list is skipped and they land on their statement.
 */
const BalancesRoutes = () => {
  const canSeeAll = useCan('balances:manage');
  const userId = useAuthStore((state) => state.user?.id);

  return (
    <Routes>
      <Route
        index
        element={canSeeAll || !userId ? <BalancesListPage /> : <Navigate to={userId} replace />}
      />
      <Route path=":userId" element={<StatementPage />} />
    </Routes>
  );
};

export default BalancesRoutes;
