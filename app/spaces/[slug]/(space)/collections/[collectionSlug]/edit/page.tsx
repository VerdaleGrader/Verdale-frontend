import { Suspense } from 'react';
import { CollectionEditor } from '@/features/catalog/components/collection-editor';

export default function EditCollectionPage() {
  return (
    <Suspense>
      <CollectionEditor />
    </Suspense>
  );
}
