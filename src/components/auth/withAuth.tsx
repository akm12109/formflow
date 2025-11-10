'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';
import { Skeleton } from '@/components/ui/skeleton';

const withAuth = <P extends object>(WrappedComponent: React.ComponentType<P>) => {
  const AuthComponent = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (loading) return;

      if (!user) {
        if (pathname !== '/login') {
            router.push('/login');
        }
        return;
      }
      
      const isAdmin = user.email === 'admin@akm.com';
      
      if (isAdmin && pathname !== '/admin') {
          router.push('/admin');
      } else if (!isAdmin && pathname === '/admin') {
          router.push('/');
      } else if (!isAdmin && pathname === '/login') {
          router.push('/');
      }


    }, [user, loading, router, pathname]);

    if (loading || !user) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
      );
    }
    
    // Prevent rendering child component if a redirect is imminent
    const isAdmin = user.email === 'admin@akm.com';
    if (isAdmin && pathname !== '/admin') return null;
    if (!isAdmin && pathname === '/admin') return null;


    return <WrappedComponent {...props} />;
  };

  AuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return AuthComponent;
};

export default withAuth;
