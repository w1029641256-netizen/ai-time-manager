import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plan, Subtask, TaskInput } from '@/types/plan';
import { getActivePlan, saveActivePlan } from '@/utils/planStorage';
import BottomNav from '@/components/feature/BottomNav';

interface Toast { id: number; message: string; }
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
}

const DAY_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-pink-500',
];
const CARD_GRADIENTS = [
  'from-violet-500 to-indigo-500', 'from-sky-500 to-teal-500',
  'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
];
const CONFETTI_COLORS = ['#8b5cf6', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#f43f5e'];
const COMPLETE_MSGS = ['Nice work!', 'Keep it up!', "Crushin\' it!", 'One down!', "You\'re on fire!"];
const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-rose-100 text-rose-700',
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
const getDaysLeft = (deadline: string) =>
  Math.max(0, Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
const getTodayKey = () => new Date().toISOString().split('T')[0];

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ onNavigate }: { onNavigate: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex flex-col items-center justify-center pb-24 px-8">
    <div className="text-center max-w-xs">
      <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-100">
        <i className="ri-bar-chart-2-line text-4xl text-violet-500" />
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">Your Dashboard Awaits</h2>
      <p className="text-sm text-gray-500 mb-2 leading-relaxed">
        Track your progress, complete tasks, and stay on top of your goals — all in one place.
      </p>
      <p className="text-xs text-gray-400 mb-8">No active tasks yet. Create your first one to get started.</p>
      <button
        onClick={onNavigate}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
      >
        <i className="ri-add-circle-line text-lg" />
        Start Your First Task
      </button>
      <p className="text-xs text-gray-400 mt-4">Set your goal, let AI build your schedule</p>
    </div>
    <BottomNav />
  </div>
);

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
interface DeleteConfirmProps {
  taskName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal = ({ taskName, onConfirm, onCancel }: DeleteConfirmProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6" onClick={onCancel}>
    <div className="w-full max-w-sm bg-white rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-rose-100">
        <i className="ri-delete-bin-line text-2xl text-rose-500" />
      </div>
      <h3 className="text-base font-bold text-gray-900 text-center mb-2">Remove Task?</h3>
      <p className="text-sm text-gray-500 text-center mb-1 leading-relaxed">
        This will permanently remove
      </p>
      <p className="text-sm font-semibold text-gray-800 text-center mb-5 truncate px-2">&ldquo;{taskName}&rdquo;</p>
      <p className="text-xs text-rose-500 text-center mb-5">All subtasks and progress will be lost.</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm cursor-pointer whitespace-nowrap">
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-[2] py-3 rounded-2xl bg-rose-500 text-white font-bold text-sm cursor-pointer whitespace-nowrap">
          Remove Task
        </button>
      </div>
    </div>
  </div>
);

// ─── Overall Progress Card ────────────────────────────────────────────────────
interface OverallProgressProps {
  tasks: TaskInput[];
  plan: Plan;
}

const OverallProgressCard = ({ tasks, plan }: OverallProgressProps) => {
  const totalSubtasks = plan.subtasks.length;
  const totalDone = plan.completedTasks.length;
  const overallProgress = totalSubtasks > 0 ? Math.round((totalDone / totalSubtasks) * 100) : 0;
  const totalHours = plan.subtasks.reduce((sum, s) => sum + s.hours, 0);
  const doneHours = plan.subtasks
    .filter((s) => plan.completedTasks.includes(s.id))
    .reduce((sum, s) => sum + s.hours, 0);

  const progressColor =
    overallProgress >= 70 ? 'from-emerald-500 to-teal-500'
    : overallProgress >= 30 ? 'from-amber-500 to-orange-500'
    : 'from-violet-500 to-indigo-500';

  return (
    <div className={`bg-gradient-to-r ${progressColor} rounded-2xl p-5 text-white`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-0.5">Overall Progress</p>
          <p className="text-sm font-medium text-white/90">{tasks.length} task{tasks.length > 1 ? 's' : ''} active</p>
        </div>
        <p className="text-4xl font-black">{overallProgress}%</p>
      </div>
      <div className="bg-white/20 rounded-full h-2.5 overflow-hidden mb-3">
        <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/15 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black">{totalDone}</p>
          <p className="text-xs text-white/70">Done</p>
        </div>
        <div className="bg-white/15 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black">{totalSubtasks - totalDone}</p>
          <p className="text-xs text-white/70">Remaining</p>
        </div>
        <div className="bg-white/15 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black">{Math.round(doneHours * 10) / 10}h</p>
          <p className="text-xs text-white/70">of {Math.round(totalHours * 10) / 10}h</p>
        </div>
      </div>
    </div>
  );
};

// ─── Task Selector ────────────────────────────────────────────────────────────
interface TaskSelectorProps {
  tasks: TaskInput[];
  selectedId: string;
  plan: Plan;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onModify: (id: string) => void;
}

const TaskSelector = ({ tasks, selectedId, plan, onSelect, onDelete, onModify }: TaskSelectorProps) => (
  <div className="space-y-2">
    {tasks.map((t, idx) => {
      const subs = plan.subtasks.filter((s) => s.taskId === t.id);
      const done = subs.filter((s) => plan.completedTasks.includes(s.id)).length;
      const progress = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
      const isSelected = t.id === selectedId;
      const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
      const daysLeft = getDaysLeft(t.deadline);

      return (
        <div key={t.id} className="relative">
          <button onClick={() => onSelect(t.id)}
            className={`w-full text-left rounded-2xl p-4 border-2 transition-all cursor-pointer pr-20 ${
              isSelected
                ? `bg-gradient-to-r ${gradient} text-white border-transparent`
                : 'bg-white text-gray-800 border-gray-100 hover:border-violet-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-violet-100'}`}>
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-violet-600'}`}>{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{t.task}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{daysLeft}d left</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isSelected ? 'bg-white/20 text-white' : PRIORITY_BADGE[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`text-right flex-shrink-0 ml-3 ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                <p className="text-xl font-black">{progress}%</p>
                <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{done}/{subs.length}</p>
              </div>
            </div>
            <div className={`rounded-full h-1.5 overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
              <div className={`h-full rounded-full transition-all duration-700 ${isSelected ? 'bg-white' : 'bg-violet-500'}`}
                style={{ width: `${progress}%` }} />
            </div>
          </button>
          {/* Action buttons — modify + delete */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onModify(t.id); }}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                isSelected ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-violet-400 hover:text-violet-600 hover:bg-violet-50'
              }`}
              title="Modify task"
            >
              <i className="ri-edit-line text-sm" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                isSelected ? 'text-white/60 hover:text-white hover:bg-white/20' : 'text-gray-300 hover:text-rose-500 hover:bg-rose-50'
              }`}
              title="Remove task"
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const toastCounter = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const p = getActivePlan();
    if (p) {
      setPlan(p);
      setSelectedTaskId(p.selectedTaskId || p.tasks?.[0]?.id || '');
    }
  }, []);

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const addToast = useCallback((message: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const spawnConfetti = useCallback((ox: number, oy: number) => {
    const newP = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i, x: ox, y: oy,
      vx: (Math.random() - 0.5) * 10, vy: -(Math.random() * 7 + 3),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 7 + 4, life: 1,
    }));
    setParticles((prev) => [...prev, ...newP]);
    let frame = 0;
    const animate = () => {
      frame++;
      setParticles((prev) =>
        prev.map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.38, life: p.life - 0.022 }))
          .filter((p) => p.life > 0)
      );
      if (frame < 65) animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (plan) {
      const updated = { ...plan, selectedTaskId: taskId };
      saveActivePlan(updated);
      setPlan(updated);
    }
  };

  const handleModifyTask = (taskId: string) => {
    navigate(`/plan?taskId=${taskId}&mode=modify`);
  };

  const handleDeleteTask = (taskId: string) => {
    setDeletingTaskId(taskId);
  };

  const confirmDeleteTask = () => {
    if (!plan || !deletingTaskId) return;
    const updatedTasks = plan.tasks.filter((t) => t.id !== deletingTaskId);
    const updatedSubtasks = plan.subtasks.filter((s) => s.taskId !== deletingTaskId);
    const updatedCompleted = plan.completedTasks.filter((id) => {
      const sub = plan.subtasks.find((s) => s.id === id);
      return sub && sub.taskId !== deletingTaskId;
    });

    // If we deleted the selected task, switch to first remaining
    const newSelectedId = deletingTaskId === selectedTaskId
      ? (updatedTasks[0]?.id || '')
      : selectedTaskId;

    const updatedPlan: Plan = {
      ...plan,
      tasks: updatedTasks,
      subtasks: updatedSubtasks,
      completedTasks: updatedCompleted,
      selectedTaskId: newSelectedId,
    };
    saveActivePlan(updatedPlan);
    setPlan(updatedPlan);
    setSelectedTaskId(newSelectedId);
    setDeletingTaskId(null);
    addToast('Task removed');
  };

  const handleToggleTask = (subtask: Subtask, e: React.MouseEvent) => {
    if (!plan) return;
    const wasDone = plan.completedTasks.includes(subtask.id);
    let newCompleted: string[];
    if (wasDone) {
      newCompleted = plan.completedTasks.filter((id) => id !== subtask.id);
    } else {
      newCompleted = [...plan.completedTasks, subtask.id];
      setCompletingId(subtask.id);
      setTimeout(() => setCompletingId(null), 600);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      addToast(COMPLETE_MSGS[Math.floor(Math.random() * COMPLETE_MSGS.length)]);
    }
    const newProgress = Math.round((newCompleted.length / plan.subtasks.length) * 100);
    const updatedPlan: Plan = {
      ...plan,
      completedTasks: newCompleted,
      progress: newProgress,
      subtasks: plan.subtasks.map((s) => s.id === subtask.id ? { ...s, done: !s.done } : s),
    };
    saveActivePlan(updatedPlan);
    setPlan(updatedPlan);
  };

  if (!plan || plan.tasks.length === 0) {
    return <EmptyState onNavigate={() => navigate('/create')} />;
  }

  const today = getTodayKey();
  const selectedTask = plan.tasks?.find((t) => t.id === selectedTaskId) || plan.tasks?.[0];
  const taskSubtasks = selectedTask ? plan.subtasks.filter((s) => s.taskId === selectedTask.id) : [];
  const taskCompleted = taskSubtasks.filter((s) => plan.completedTasks.includes(s.id));
  const taskProgress = taskSubtasks.length > 0 ? Math.round((taskCompleted.length / taskSubtasks.length) * 100) : 0;
  const daysLeft = selectedTask ? getDaysLeft(selectedTask.deadline) : 0;
  const todayTasks = taskSubtasks.filter((s) => s.day === today);
  const deletingTask = deletingTaskId ? plan.tasks.find((t) => t.id === deletingTaskId) : null;

  const dayGroups: Record<string, { total: number; done: number }> = {};
  taskSubtasks.forEach((s) => {
    if (!dayGroups[s.day]) dayGroups[s.day] = { total: 0, done: 0 };
    dayGroups[s.day].total += 1;
    if (plan.completedTasks.includes(s.id)) dayGroups[s.day].done += 1;
  });
  const chartDays = Object.keys(dayGroups).sort().slice(0, 7);

  const progressColor = taskProgress >= 70
    ? 'from-emerald-500 to-teal-500'
    : taskProgress >= 30
    ? 'from-amber-500 to-orange-500'
    : 'from-violet-500 to-indigo-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-24">
      {/* Confetti */}
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {particles.map((p) => (
            <div key={p.id} className="absolute rounded-sm" style={{
              left: p.x, top: p.y, width: p.size, height: p.size,
              backgroundColor: p.color, opacity: p.life, transform: `rotate(${p.vx * 20}deg)`,
            }} />
          ))}
        </div>
      )}

      {/* Toast */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full"
            style={{ animation: 'slideDown 0.3s ease-out' }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Delete Confirm */}
      {deletingTask && (
        <DeleteConfirmModal
          taskName={deletingTask.task}
          onConfirm={confirmDeleteTask}
          onCancel={() => setDeletingTaskId(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600">
                <i className="ri-bar-chart-2-line text-white text-base" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Dashboard</h1>
                <p className="text-xs text-gray-400">{plan.tasks?.length || 1} task{(plan.tasks?.length || 1) > 1 ? 's' : ''} active</p>
              </div>
            </div>
            <button onClick={() => navigate('/feedback')}
              className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 text-xs font-semibold cursor-pointer whitespace-nowrap">
              Feedback
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-5">
        {/* Overall Progress Card */}
        {plan.tasks && plan.tasks.length > 0 && (
          <OverallProgressCard tasks={plan.tasks} plan={plan} />
        )}

        {/* Task Selector */}
        {plan.tasks && plan.tasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Task</p>
              <p className="text-xs text-gray-400">
                <i className="ri-edit-line" /> modify &nbsp;·&nbsp; <i className="ri-delete-bin-line" /> remove
              </p>
            </div>
            <TaskSelector
              tasks={plan.tasks}
              selectedId={selectedTaskId}
              plan={plan}
              onSelect={handleSelectTask}
              onDelete={handleDeleteTask}
              onModify={handleModifyTask}
            />
          </div>
        )}

        {selectedTask && (
          <>
            {/* Progress Hero */}
            <div className={`bg-gradient-to-r ${progressColor} rounded-2xl p-5 text-white`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">Step 3 of 4</p>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold leading-tight">{selectedTask.task}</h2>
                  <p className="text-sm text-white/80 mt-0.5">Task Progress</p>
                </div>
                <p className="text-4xl font-black">{taskProgress}%</p>
              </div>
              <div className="bg-white/20 rounded-full h-2.5 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${taskProgress}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/70">
                <span>{taskCompleted.length} completed</span>
                <span>{taskSubtasks.length - taskCompleted.length} remaining</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-2xl font-bold text-violet-600">{taskCompleted.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Done</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-2xl font-bold text-amber-500">{todayTasks.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Today</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-2xl font-bold text-rose-500">{daysLeft}</p>
                <p className="text-xs text-gray-500 mt-0.5">Days Left</p>
              </div>
            </div>

            {/* Weekly Chart */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-bar-chart-grouped-line text-violet-500" />
                </div>
                Weekly Progress
              </h3>
              <div className="flex items-end gap-2 h-24">
                {chartDays.map((day, idx) => {
                  const data = dayGroups[day];
                  const pct = data.total > 0 ? (data.done / data.total) * 100 : 0;
                  const isToday = day === today;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-gray-100 rounded-lg overflow-hidden h-16 flex flex-col justify-end">
                        <div className={`w-full rounded-lg transition-all duration-700 ${isToday ? 'bg-violet-500' : DAY_COLORS[idx % DAY_COLORS.length]}`}
                          style={{ height: `${Math.max(8, pct)}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${isToday ? 'text-violet-600' : 'text-gray-400'}`}>
                        {new Date(day).toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Tasks */}
            {todayTasks.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-sun-line text-amber-500" />
                  </div>
                  Today&apos;s Tasks
                  <span className="ml-auto text-xs text-gray-400">{formatDate(today)}</span>
                </h3>
                <div className="space-y-2">
                  {todayTasks.map((subtask) => {
                    const isDone = plan.completedTasks.includes(subtask.id);
                    const isCompleting = completingId === subtask.id;
                    return (
                      <button key={subtask.id} onClick={(e) => handleToggleTask(subtask, e)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer text-left ${
                          isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100 hover:border-violet-200 hover:bg-violet-50'
                        } ${isCompleting ? 'scale-95' : 'scale-100'}`}
                      >
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full border-2 flex-shrink-0 transition-all duration-300 ${
                          isDone ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                        } ${isCompleting ? 'scale-125' : 'scale-100'}`}>
                          {isDone && <i className="ri-check-line text-white text-xs" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{subtask.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{subtask.hours}h estimated</p>
                        </div>
                        {isDone && <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">Done!</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Tasks */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-list-check-2 text-violet-500" />
                </div>
                All Subtasks
              </h3>
              <div className="space-y-2">
                {taskSubtasks.map((subtask, idx) => {
                  const isDone = plan.completedTasks.includes(subtask.id);
                  const isPast = subtask.day < today;
                  const isCompleting = completingId === subtask.id;
                  return (
                    <button key={subtask.id} onClick={(e) => handleToggleTask(subtask, e)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer text-left ${
                        isDone ? 'bg-emerald-50 border-emerald-200'
                        : isPast ? 'bg-rose-50 border-rose-100'
                        : 'bg-gray-50 border-gray-100 hover:border-violet-200 hover:bg-violet-50'
                      } ${isCompleting ? 'scale-95' : 'scale-100'}`}
                    >
                      <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                        isDone ? 'bg-emerald-500' : DAY_COLORS[idx % DAY_COLORS.length]
                      } ${isCompleting ? 'scale-125' : 'scale-100'}`}>
                        {isDone ? <i className="ri-check-line" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{subtask.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{formatDate(subtask.day)}</span>
                          <span className="text-xs text-violet-500">{subtask.hours}h</span>
                          {isPast && !isDone && <span className="text-xs text-rose-500 font-medium">Overdue</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
