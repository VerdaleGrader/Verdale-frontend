'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '../hooks/auth-provider';

export function HomeActions() {
  const { auth } = useAuth();
  return (
    <div className="flex flex-wrap gap-3">
      {auth.status === 'authenticated' ? (
        <Link href="/spaces" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
          Go to my Spaces
        </Link>
      ) : (
        <Link href="/login" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
          Log in or sign up
        </Link>
      )}
      <Link href="/explore" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
        Explore Spaces
      </Link>
    </div>
  );
}
