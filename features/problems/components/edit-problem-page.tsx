'use client';

import { isUpdatable } from '../versioning';
import { useProblemWorkspace } from './problem-workspace';
import { StatementEditor } from './statement-editor';
import { UpdateProblemForm } from './update-problem-form';

/** The Statement tab: the update form for a published problem, the autosaved editor for a draft (also a Major draft). */
export function EditProblemPage() {
  const { editor } = useProblemWorkspace();
  return isUpdatable(editor) ? <UpdateProblemForm /> : <StatementEditor />;
}
