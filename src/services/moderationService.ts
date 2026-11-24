import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type {
  AccountDeletionRequest,
  CopyrightComplaint,
  CreateReportInput,
  UserFeedbackRecord,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  validateAccountDeletionInput,
  validateCopyrightComplaintInput,
  validateReportDetails,
  validateUserFeedbackInput,
} from './validation';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  return null;
}

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

export async function submitCopyrightComplaint(input: {
  claimantName: string;
  claimantEmail: string;
  rightsHolderOrganization: string;
  workTitle: string;
  targetType: CopyrightComplaint['targetType'];
  targetReference: string;
  description: string;
  goodFaithConfirmed: boolean;
  accuracyConfirmed: boolean;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to submit a copyright or takedown complaint.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before submitting a formal copyright complaint.'
    );
  }

  const err = validateCopyrightComplaintInput(input);
  if (err) throw new Error(err);

  await currentUser.getIdToken(true);

  const docRef = doc(collection(db, 'copyrightComplaints'));
  const now = serverTimestamp();

  try {
    await setDoc(docRef, {
      id: docRef.id,
      reporterUid: currentUser.uid,
      claimantName: input.claimantName.trim(),
      claimantEmail: input.claimantEmail.trim().toLowerCase(),
      rightsHolderOrganization: input.rightsHolderOrganization.trim(),
      workTitle: input.workTitle.trim(),
      targetType: input.targetType,
      targetReference: input.targetReference.trim(),
      description: input.description.trim(),
      goodFaithConfirmed: true,
      accuracyConfirmed: true,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `copyrightComplaints/${docRef.id}`
    );
  }
}

export async function submitAccountDeletionRequest(input: {
  username: string;
  email: string;
  reason: string;
  acknowledgedIrreversible: boolean;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to request account deletion.');
  }

  const err = validateAccountDeletionInput(input);
  if (err) throw new Error(err);

  await currentUser.getIdToken(true);

  const docRef = doc(collection(db, 'accountDeletionRequests'));
  const now = serverTimestamp();

  const resolvedEmail = (input.email || currentUser.email || '').trim().slice(0, 254);
  if (resolvedEmail.length < 5) {
    throw new Error('A valid account email is required to submit a deletion request.');
  }

  try {
    await setDoc(docRef, {
      id: docRef.id,
      userId: currentUser.uid,
      username: (input.username || '').trim().slice(0, 40),
      email: resolvedEmail,
      reason: input.reason.trim(),
      acknowledgedIrreversible: true,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `accountDeletionRequests/${docRef.id}`
    );
  }
}

export async function fetchOwnDeletionRequests(
  userId: string
): Promise<AccountDeletionRequest[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'accountDeletionRequests'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: String(data.userId || userId),
        username: String(data.username || ''),
        email: String(data.email || ''),
        reason: String(data.reason || ''),
        acknowledgedIrreversible: Boolean(data.acknowledgedIrreversible),
        status: (data.status as AccountDeletionRequest['status']) || 'pending',
        reviewNotes:
          typeof data.reviewNotes === 'string' ? data.reviewNotes : undefined,
        reviewedByUid:
          typeof data.reviewedByUid === 'string' ? data.reviewedByUid : undefined,
        createdAt: toDateOrNull(data.createdAt),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    });
  } catch {
    return [];
  }
}

export async function submitUserFeedback(input: {
  category: UserFeedbackRecord['category'];
  subject: string;
  message: string;
  pageContext: string;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to submit feedback or an accessibility report.');
  }

  const err = validateUserFeedbackInput(input);
  if (err) throw new Error(err);

  await currentUser.getIdToken(true);

  const docRef = doc(collection(db, 'userFeedback'));
  const now = serverTimestamp();

  try {
    await setDoc(docRef, {
      id: docRef.id,
      userId: currentUser.uid,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      pageContext: (input.pageContext || '/').trim().slice(0, 120),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `userFeedback/${docRef.id}`
    );
  }
}

