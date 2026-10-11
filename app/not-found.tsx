import Link from 'next/link';
import { PageContainer } from '@/components/layout/page';
import { EmptyState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PageContainer narrow>
      <EmptyState
        title="Page not found"
        description="The address may be mistyped, or the page may be private or removed."
        action={
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            Go to the home page
          </Link>
        }
      />
    </PageContainer>
  );
}
