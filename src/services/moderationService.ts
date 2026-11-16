import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { CreateReportInput } from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { validateReportDetails } from './validation';

export async function submitModerationReport(
  reporterId: string,
  input: CreateReportInput
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== reporterId) {
    throw new Error('Please sign in to submit a report.');
  }
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your email address before reporting content.');
  }

  const detailsError = validateReportDetails(input);
  if (detailsError) {
    throw new Error(detailsError);
  }

  await currentUser.getIdToken(true);

  const reportRef = doc(collection(db, 'reports'));
  try {
    await setDoc(reportRef, {
      id: reportRef.id,
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      postId: input.postId,
      targetAuthorId: input.targetAuthorId,
      reason: input.reason,
      details: input.details.trim(),
      status: 'open',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `reports/${reportRef.id}`
    );
  }
}
