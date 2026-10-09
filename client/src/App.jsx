import { RouterProvider } from 'react-router-dom';

import AppThemeProvider from '@/providers/AppThemeProvider';
import QueryProvider from '@/providers/QueryProvider';
import useAuthStore from '@/store/useAuthStore';
import router from '@/router';

export default function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <AppThemeProvider>
      <QueryProvider key={user?._id || user?.id || 'anonymous'}>
        <RouterProvider router={router} />
      </QueryProvider>
    </AppThemeProvider>
  );
}
