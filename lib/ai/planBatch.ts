import type { Budget, Goal } from '@/lib/db/schema';

export interface PlanBatch {
  id: string;
  goal?: Goal;
  budgets: Budget[];
}

// Picks the most recently created AI plan batch (by the newest createdAt across
// its goal/budget records) so TrackedPlanWidget always shows the latest
// AI-confirmed plan, even if the user has older AI batches or manual goals too.
export function findLatestPlanBatch(goals: Goal[], budgets: Budget[]): PlanBatch | null {
  const batchIds = new Set<string>();
  for (const g of goals) if (g.aiPlanBatchId) batchIds.add(g.aiPlanBatchId);
  for (const b of budgets) if (b.aiPlanBatchId) batchIds.add(b.aiPlanBatchId);
  if (batchIds.size === 0) return null;

  let latestId: string | null = null;
  let latestCreatedAt = -Infinity;

  for (const id of batchIds) {
    const createdAts = [
      ...goals.filter((g) => g.aiPlanBatchId === id).map((g) => g.createdAt),
      ...budgets.filter((b) => b.aiPlanBatchId === id).map((b) => b.createdAt),
    ];
    const createdAt = Math.max(...createdAts);
    if (createdAt > latestCreatedAt) {
      latestCreatedAt = createdAt;
      latestId = id;
    }
  }

  return {
    id: latestId!,
    goal: goals.find((g) => g.aiPlanBatchId === latestId),
    budgets: budgets.filter((b) => b.aiPlanBatchId === latestId),
  };
}
