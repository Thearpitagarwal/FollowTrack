import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
// import { FullPageLoader } from '../components/ui/FullPageLoader'; // Depending on if we have it

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  
  // if (loading) return <FullPageLoader />;
  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'4rem',fontFamily:'var(--font-body)',color:'var(--color-ink)'}}>Loading...</div>;
  if (!user)   return <Navigate to="/login" replace />;
  
  return children;
}
