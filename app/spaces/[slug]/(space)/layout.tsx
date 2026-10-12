import { SpaceChrome } from '@/features/spaces/components/space-shell';

/** Overview, members and settings share the Space header and tabs; problem pages do not. */
export default function SpacePagesLayout({ children }: { children: React.ReactNode }) {
  return <SpaceChrome>{children}</SpaceChrome>;
}
