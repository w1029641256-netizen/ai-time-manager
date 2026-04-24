import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Priority, DayOfWeek, TaskInput } from '@/types/plan';
import { mergeTasksIntoPlan } from '@/utils/planStorage';
import { generateSubtasksForTasks } from '@/utils/aiPlanGenerator';
import BottomNav from '@/components/feature/BottomNav';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

const PRIORITY_COLORS: Record<Priority, string> = {
  Low: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Medium: 'bg-amber-100 text-amber-700 border-amber-300',
  High: 'bg-rose-100 text-rose-700 border-rose-300',
};
const PRIORITY_ACTIVE: Record<Priority, string> = {
  Low: 'bg-emerald-500 text-white border-emerald-500',
  Medium: 'bg-amber-500 text-white border-amber-500',
  High: 'bg-rose-500 text-white border-rose-500',
};
const PRIORITY_BADGE: Record<Priority, string> = {
  Low: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-rose-100 text-rose-700',
};

const makeTaskInput = (): TaskInput => ({
  id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  task: '',
  deadline: '',
  priority: 'Medium',
  hoursPerDay: 2,
  activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
});

// ─── Task Form Card ───────────────────────────────────────────────────────────
interface TaskFormCardProps {
  task: TaskInput;
  index: number;
  today: string;
  isFirst: boolean;
  onChange: (id: string, field: keyof TaskInput, value: string | number | DayOfWeek[]) => void;
  onRemove?: (id: string) => void;
}

const TaskFormCard = ({ task, index, today, isFirst, onChange, onRemove }: TaskFormCardProps) => {
  const toggleDay = (day: DayOfWeek) => {
    const current = task.activeDays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onChange(task.id, 'activeDays', next);
  };

  return (
    <div className={`bg-white rounded-2xl p-5 border ${isFirst ? 'border-violet-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 flex items-center justify-center rounded-lg ${isFirst ? 'bg-violet-100' : 'bg-indigo-100'}`}>
            <span className={`text-xs font-bold ${isFirst ? 'text-violet-600' : 'text-indigo-600'}`}>{index + 1}</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">{isFirst ? 'Primary Task' : `Task ${index + 1}`}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        {!isFirst && onRemove && (
          <button
            onClick={() => onRemove(task.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <i className="ri-close-line text-base" />
          </button>
        )}
      </div>

      {/* Task Name */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
          <i className="ri-task-line text-violet-400 mr-1" />Task Name
        </label>
        <input
          type="text"
          value={task.task}
          onChange={(e) => onChange(task.id, 'task', e.target.value)}
          placeholder="e.g. Prepare for final exam"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
        />
      </div>

      {/* Deadline */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
          <i className="ri-calendar-line text-violet-400 mr-1" />Deadline
        </label>
        <input
          type="date"
          value={task.deadline}
          min={today}
          onChange={(e) => onChange(task.id, 'deadline', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
        />
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
          <i className="ri-flag-line text-violet-400 mr-1" />Priority
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => onChange(task.id, 'priority', p)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                task.priority === p ? PRIORITY_ACTIVE[p] : PRIORITY_COLORS[p]
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-4" />
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Schedule Settings</p>

      {/* Daily Hours */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 mb-2">
          <i className="ri-timer-line text-violet-400 mr-1" />Daily Available Hours
        </label>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2">
          <button
            onClick={() => onChange(task.id, 'hoursPerDay', Math.max(0.5, task.hoursPerDay - 0.5))}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-violet-50 hover:border-violet-300 transition-all cursor-pointer"
          >
            <i className="ri-subtract-line" />
          </button>
          <div className="text-center">
            <span className="text-2xl font-bold text-violet-600">{task.hoursPerDay}</span>
            <span className="text-sm text-gray-400 ml-1">hrs/day</span>
          </div>
          <button
            onClick={() => onChange(task.id, 'hoursPerDay', Math.min(12, task.hoursPerDay + 0.5))}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-violet-50 hover:border-violet-300 transition-all cursor-pointer"
          >
            <i className="ri-add-line" />
          </button>
        </div>
      </div>

      {/* Active Days */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">
          <i className="ri-calendar-2-line text-violet-400 mr-1" />Active Days
        </label>
        <div className="flex gap-1 flex-wrap">
          {DAYS.map((day) => {
            const isActive = task.activeDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`flex-1 min-w-[36px] py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">{task.activeDays.length} days selected</p>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CreatePage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskInput[]>([makeTaskInput()]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTaskChange = (id: string, field: keyof TaskInput, value: string | number | DayOfWeek[]) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddTask = () => {
    setTasks((prev) => [...prev, makeTaskInput()]);
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    tasks.forEach((t, idx) => {
      if (!t.task.trim()) newErrors[`task-${t.id}`] = `Task ${idx + 1} name is required`;
      if (!t.deadline) newErrors[`deadline-${t.id}`] = `Task ${idx + 1} deadline is required`;
      if (t.activeDays.length === 0) newErrors[`days-${t.id}`] = `Task ${idx + 1} needs at least one active day`;
    });
    return newErrors;
  };

  const handleGenerate = () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsGenerating(true);
    setTimeout(() => {
      // Generate subtasks only for the new tasks, then merge into existing plan
      const newSubtasks = generateSubtasksForTasks(tasks);
      mergeTasksIntoPlan(tasks, newSubtasks);
      setIsGenerating(false);
      navigate('/plan');
    }, 1200);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600">
              <i className="ri-time-line text-white text-base" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">AI Time Manager</h1>
              <p className="text-xs text-gray-400">Plan smarter, achieve more</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-200 mb-1">New Task</p>
          <h2 className="text-xl font-bold mb-1">Add Tasks to Your Plan</h2>
          <p className="text-sm text-violet-200">New tasks will be added alongside your existing ones — nothing gets overwritten.</p>
        </div>

        {/* Task Form Cards */}
        {tasks.map((task, idx) => (
          <div key={task.id}>
            <TaskFormCard
              task={task}
              index={idx}
              today={today}
              isFirst={idx === 0}
              onChange={handleTaskChange}
              onRemove={idx > 0 ? handleRemoveTask : undefined}
            />
            {/* Inline errors */}
            {(errors[`task-${task.id}`] || errors[`deadline-${task.id}`] || errors[`days-${task.id}`]) && (
              <div className="mt-2 space-y-1">
                {errors[`task-${task.id}`] && (
                  <p className="text-xs text-rose-500 flex items-center gap-1">
                    <i className="ri-error-warning-line" /> {errors[`task-${task.id}`]}
                  </p>
                )}
                {errors[`deadline-${task.id}`] && (
                  <p className="text-xs text-rose-500 flex items-center gap-1">
                    <i className="ri-error-warning-line" /> {errors[`deadline-${task.id}`]}
                  </p>
                )}
                {errors[`days-${task.id}`] && (
                  <p className="text-xs text-rose-500 flex items-center gap-1">
                    <i className="ri-error-warning-line" /> {errors[`days-${task.id}`]}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add Task Button */}
        <button
          onClick={handleAddTask}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-violet-300 text-violet-500 font-semibold text-sm hover:bg-violet-50 hover:border-violet-400 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          <i className="ri-add-circle-line text-base" />
          Add Another Task
        </button>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base hover:opacity-90 transition-all duration-300 cursor-pointer whitespace-nowrap disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <i className="ri-loader-4-line animate-spin text-lg" />
              Generating AI Plan...
            </>
          ) : (
            <>
              <i className="ri-sparkling-2-line text-lg" />
              Generate &amp; Add to Plan
              {tasks.length > 1 && (
                <span className="ml-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {tasks.length} tasks
                </span>
              )}
            </>
          )}
        </button>

        {/* Hint */}
        <p className="text-xs text-center text-gray-400 pb-2">
          <i className="ri-information-line mr-1" />
          Go to <strong>Plan</strong> to view &amp; manage all your tasks
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default CreatePage;
