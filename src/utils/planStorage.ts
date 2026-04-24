import { Plan, TaskInput, Subtask } from '@/types/plan';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './auth';

const DEMO_KEY = 'demo_plan';
const ACTIVE_KEY = 'active_plan';

export const saveDemoPlan = (plan: Plan): void => {
  localStorage.setItem(DEMO_KEY, JSON.stringify(plan));
};

export const getDemoPlan = (): Plan | null => {
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Plan;
  } catch {
    return null;
  }
};

export const saveActivePlan = (plan: Plan): void => {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(plan));
};

export const getActivePlan = (): Plan | null => {
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Plan;
  } catch {
    return null;
  }
};

/**
 * Save new tasks as a pending demo plan (separate from active plan).
 * demo_plan always holds ONLY the newly created, not-yet-accepted tasks.
 */
export const mergeTasksIntoPlan = (
  newTasks: TaskInput[],
  newSubtasks: Subtask[]
): Plan => {
  const primary = newTasks[0];
  const pending: Plan = {
    task: primary.task,
    tasks: newTasks,
    deadline: primary.deadline,
    priority: primary.priority,
    hoursPerDay: primary.hoursPerDay,
    activeDays: primary.activeDays,
    subtasks: newSubtasks,
    completedTasks: [],
    progress: 0,
    selectedTaskId: primary.id,
  };
  saveDemoPlan(pending);
  return pending;
};

/**
 * Accept the pending demo plan: merge its tasks into the active plan without
 * touching existing tasks' subtasks or completion state.
 * Returns the merged active plan.
 */
export const acceptPendingPlan = (pendingPlan: Plan): Plan => {
  const existing = getActivePlan();

  if (!existing) {
    // First time — just activate the pending plan as-is
    const activated: Plan = { ...pendingPlan, completedTasks: [], progress: 0 };
    saveActivePlan(activated);
    localStorage.removeItem('demo_plan');
    return activated;
  }

  // Only add tasks that don't already exist in active plan
  const existingTaskIds = new Set(existing.tasks.map((t) => t.id));
  const trulyNewTasks = pendingPlan.tasks.filter((t) => !existingTaskIds.has(t.id));
  const trulyNewSubtasks = pendingPlan.subtasks.filter((s) => !existingTaskIds.has(s.taskId));

  const merged: Plan = {
    ...existing,
    tasks: [...existing.tasks, ...trulyNewTasks],
    subtasks: [...existing.subtasks, ...trulyNewSubtasks],
    selectedTaskId: existing.selectedTaskId || existing.tasks[0]?.id,
  };

  saveActivePlan(merged);
  localStorage.removeItem('demo_plan');
  return merged;
};


// Sync to Cloud
export const syncActivePlanToCloud = async () => {
  const plan = getActivePlan();
  const user = await getCurrentUser();

  if (!plan || !user) return;

  const { data: existing } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_type', 'active')
      .maybeSingle();

  const payload = {
    user_id: user.id,
    plan_type: 'active',
    data: plan,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
      ? await supabase.from('plans').update(payload).eq('id', existing.id)
      : await supabase.from('plans').insert(payload);

  if (error) {
    console.error('Sync failed:', error);
  } else {
    console.log('Synced to cloud');
  }
};

// Recovery from Cloud
export const restoreActivePlanFromCloud = async (): Promise<Plan | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
      .from('plans')
      .select('data')
      .eq('user_id', user.id)
      .eq('plan_type', 'active')
      .single();

  if (error || !data) {
    console.error('Restore failed:', error);
    return null;
  }

  const plan = data.data as Plan;
  saveActivePlan(plan);
  return plan;
};