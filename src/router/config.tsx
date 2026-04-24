import { RouteObject, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/utils/auth';
import CreatePage from '@/pages/create/page';
import PlanPage from '@/pages/plan/page';
import DashboardPage from '@/pages/dashboard/page';
import FeedbackPage from '@/pages/feedback/page';
import TaskDetailPage from '@/pages/task/page';
import NotFound from '@/pages/NotFound';
import AuthPage from '@/pages/auth/page';

const ProtectedRoute = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setAllowed(!!user);
    });
  }, []);

  if (allowed === null) return null;

  return allowed ? <Outlet /> : <Navigate to="/auth" replace />;
};

const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/create" replace /> },
  { path: '/auth', element: <AuthPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      { path: '/create', element: <CreatePage /> },
      { path: '/plan', element: <PlanPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/task/:taskId', element: <TaskDetailPage /> },
    ],
  },

  { path: '*', element: <NotFound /> },
];

export default routes;
