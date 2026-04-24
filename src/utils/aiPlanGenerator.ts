import { Plan, Priority, DayOfWeek, Subtask, TaskInput } from '@/types/plan';

const SUBTASK_TEMPLATES = [
  'Research & gather resources',
  'Create initial outline',
  'Draft first version',
  'Review and refine',
  'Add details and examples',
  'Proofread and edit',
  'Final review',
  'Submit / Deliver',
];

const PRIORITY_MULTIPLIER: Record<Priority, number> = {
  Low: 1.2,
  Medium: 1.0,
  High: 0.8,
};

const buildActiveDaysList = (
  activeDays: DayOfWeek[],
  daysLeft: number,
  count: number
): string[] => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: string[] = [];
  const tempDate = new Date();
  for (let i = 0; i < daysLeft + 21 && result.length < count; i++) {
    const dayName = dayNames[tempDate.getDay()] as DayOfWeek;
    if (activeDays.includes(dayName)) {
      result.push(tempDate.toISOString().split('T')[0]);
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }
  return result;
};

const buildSubtasksForTask = (taskInput: TaskInput): Subtask[] => {
  const today = new Date();
  const deadlineDate = new Date(taskInput.deadline);
  const daysLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const activeDays = taskInput.activeDays.length > 0 ? taskInput.activeDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as DayOfWeek[];
  const hoursPerDay = taskInput.hoursPerDay > 0 ? taskInput.hoursPerDay : 2;

  // Count actual active days before deadline
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let activeDayCount = 0;
  const tempDate = new Date();
  for (let i = 0; i < daysLeft; i++) {
    const dayName = dayNames[tempDate.getDay()] as DayOfWeek;
    if (activeDays.includes(dayName)) activeDayCount++;
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // One subtask per active day (1h/day × N days = N subtasks)
  // Cap at 30 to avoid overwhelming the user
  const subtaskCount = Math.max(1, Math.min(30, activeDayCount));
  const hoursEach = hoursPerDay; // each subtask = one day's worth of hours

  const days = buildActiveDaysList(activeDays, daysLeft + 7, subtaskCount);

  // Generate descriptive subtask titles cycling through templates
  const titles = Array.from({ length: subtaskCount }, (_, idx) => {
    const templateIdx = idx % SUBTASK_TEMPLATES.length;
    const phase = Math.floor(idx / SUBTASK_TEMPLATES.length);
    const suffix = phase > 0 ? ` (Phase ${phase + 1})` : '';
    return `${SUBTASK_TEMPLATES[templateIdx]}${suffix} — ${taskInput.task}`;
  });

  return titles.map((title, idx) => ({
    id: `${taskInput.id}-sub${idx + 1}`,
    taskId: taskInput.id,
    title,
    day: days[idx] || days[days.length - 1] || taskInput.deadline,
    hours: hoursEach,
    done: false,
  }));
};

export const generateAIPlan = (allTasks: TaskInput[]): Plan => {
  if (allTasks.length === 0) {
    throw new Error('At least one task is required');
  }

  const primary = allTasks[0];
  const allSubtasks: Subtask[] = [];

  allTasks.forEach((ti) => {
    const subs = buildSubtasksForTask(ti);
    allSubtasks.push(...subs);
  });

  return {
    task: primary.task,
    tasks: allTasks,
    deadline: primary.deadline,
    priority: primary.priority,
    hoursPerDay: primary.hoursPerDay,
    activeDays: primary.activeDays,
    subtasks: allSubtasks,
    completedTasks: [],
    progress: 0,
    selectedTaskId: primary.id,
  };
};

/**
 * Only generate subtasks for the given tasks (used when merging new tasks into existing plan).
 */
export const generateSubtasksForTasks = (tasks: TaskInput[]): Subtask[] => {
  const result: Subtask[] = [];
  tasks.forEach((ti) => {
    result.push(...buildSubtasksForTask(ti));
  });
  return result;
};
