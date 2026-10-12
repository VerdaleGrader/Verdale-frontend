import { SpaceProvider } from '@/features/spaces/components/space-shell';

export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SpaceProvider slug={slug}>{children}</SpaceProvider>;
}
