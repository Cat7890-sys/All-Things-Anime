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
  const payload: Record<string, unknown> = {
    id: reportRef.id,
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    postId: input.postId || input.targetId,
    targetAuthorId: input.targetAuthorId,
    reason: input.reason,
    details: input.details.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
  };
  if (input.communityId) {
    payload.communityId = input.communityId;
  }
  if (input.conversationId) {
    payload.conversationId = input.conversationId;
  }

  try {
    await setDoc(reportRef, payload);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `reports/${reportRef.id}`
    );
  }
}
