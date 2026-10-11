import type { Metadata } from 'next';
import { MySpacesView } from '@/features/spaces/components/my-spaces-view';

export const metadata: Metadata = { title: 'My Spaces · Verdale' };

export default function MySpacesPage() {
  return <MySpacesView />;
}
