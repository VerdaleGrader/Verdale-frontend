import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/layout/page';
import { EmptyState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('Errors');
  return (
    <PageContainer narrow>
      <EmptyState
        title={t('notFoundTitle')}
        description={t('notFoundText')}
        action={
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            {t('notFoundAction')}
          </Link>
        }
      />
    </PageContainer>
  );
}
