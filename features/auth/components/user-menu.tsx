'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '../hooks/auth-provider';
import Link from 'next/link';

/** Right side of the header: log in link for visitors, name and log out for members. */
export function UserMenu() {
  const t = useTranslations('UserMenu');
  const { auth, logout } = useAuth();
  const router = useRouter();

  if (auth.status === 'loading') return <span className="bg-surface-sunken h-7 w-20 rounded-md" aria-hidden />;
  if (auth.status !== 'authenticated') {
    return (
      <Link href="/login" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
        {t('logIn')}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings/profile"
        className="hover:bg-surface-hover flex items-center gap-2 rounded-md py-1 pr-2 pl-1"
        aria-label={t('profileSettings', { name: auth.user.display_name })}
      >
        <Avatar name={auth.user.display_name} src={auth.user.avatar_url} size="md" />
        <span className="text-body-strong hidden sm:inline">{auth.user.display_name}</span>
      </Link>
      <Tooltip label={t('logOut')} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('logOut')}
          onClick={async () => {
            await logout();
            router.push('/');
          }}
        >
          <LogOut aria-hidden />
        </Button>
      </Tooltip>
    </div>
  );
}
