import type { Metadata } from 'next';
import { CreateSpaceForm } from '@/features/spaces/components/create-space-form';

export const metadata: Metadata = { title: 'Create a Space · Verdale' };

export default function NewSpacePage() {
  return <CreateSpaceForm />;
}
