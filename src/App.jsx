import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { AppRouter } from './router/AppRouter';

function App() {
  const initAuth = useAuthStore((state) => state.init);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, [initAuth]);

  return <AppRouter />;
}

export default App;
