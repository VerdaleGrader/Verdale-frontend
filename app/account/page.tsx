import type { Metadata } from 'next';
import { ProfileForm } from '@/features/auth/components/profile-form';

export const metadata: Metadata = { title: 'Account · Verdale' };

export default function AccountPage() {
  return <ProfileForm />;
}
