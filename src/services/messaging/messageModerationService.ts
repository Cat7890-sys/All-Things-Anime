import type { CreateReportInput } from '../../types';
import { submitModerationReport } from '../moderationService';

export async function submitMessagingReport(
  reporterId: string,
  input: Omit<CreateReportInput, 'postId'> & { conversationId: string }
): Promise<void> {
  await submitModerationReport(reporterId, {
    ...input,
    postId: input.conversationId,
    conversationId: input.conversationId,
  });
}
