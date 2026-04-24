export type Priority = 'Low' | 'Medium' | 'High';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  day: string;
  hours: number;
  done: boolean;
}

export interface TaskInput {
  id: string;
  task: string;
  deadline: string;
  priority: Priority;
  hoursPerDay: number;
  activeDays: DayOfWeek[];
}

export interface Plan {
  task: string;
  tasks: TaskInput[];
  deadline: string;
  priority: Priority;
  hoursPerDay: number;
  activeDays: DayOfWeek[];
  subtasks: Subtask[];
  completedTasks: string[];
  progress: number;
  selectedTaskId?: string;
}
