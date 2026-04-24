import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plan, Subtask, TaskInput } from '@/types/plan';
import { getActivePlan, saveActivePlan } from '@/utils/planStorage';
import BottomNav from '@/components/feature/BottomNav';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

const getDaysLeft = (deadline: string) => {
  const today = new Date();
  const dl = new Date(deadline);
  const diff = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const getTodayKey = () => new Date().toISOString().split('T')[0];

const DAY_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-pink-500',
];

const CONFETTI_COLORS = ['#8b5cf6', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#f43f5e'];
const COMPLETE_MSGS = ['Nice work!', 'Keep it up!', "Crushin' it!", 'One down!', "You're on fire!"];

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-rose-100 text-rose-700',
};

// ─── Feedback helpers ─────────────────────────────────────────────────────────
const getFeedbackConfig = (progress: number) => {
  if (progress >= 70) return {
    badge: 'High Achiever', title: "You're crushing it!",
    subtitle: "Outstanding progress! Keep the momentum going!",
    bgGradient: 'from-emerald-500 to-teal-500', icon: 'ri-trophy-line',
    tips: ['Maintain your current pace', 'Review completed tasks for quality', 'Prepare for the final stretch', 'Celebrate small wins'],
  };
  if (progress >= 30) return {
    badge: 'Steady Progress', title: "You're on the right track!",
    subtitle: "Good work! Stay consistent and you'll reach your goal.",
    bgGradient: 'from-amber-500 to-orange-500', icon: 'ri-rocket-line',
    tips: ['Stay consistent with daily tasks', 'Break down larger tasks if needed', 'Avoid distractions', 'Review your plan regularly'],
  };
  return {
    badge: 'Just Getting Started', title: "Every journey starts here!",
    subtitle: "Don't worry — take it one task at a time and build momentum!",
    bgGradient: 'from-violet-500 to-indigo-500', icon: 'ri-seedling-line',
    tips: ['Start with the easiest task first', 'Set a specific time to work each day', 'Remove distractions', 'Tell someone about your goal'],
  };
};

// ─── Tab: Plan ────────────────────────────────────────────────────────────────
const PlanTab = ({ taskInfo, subtasks }: { taskInfo: TaskInput; subtasks: Subtask[] }) => {
  const daysLeft = getDaysLeft(taskInfo.deadline);
  const totalHours = subtasks.reduce((s, t) => s + t.hours, 0);

  const dayGroups: Record<string, Subtask[]> = {};
  subtasks.forEach((s) => {
    if (!dayGroups[s.day]) dayGroups[s.day] = [];
    dayGroups[s.day].push(s);
  });
  const sortedDays = Object.keys(dayGroups).sort();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-violet-600">{subtasks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Subtasks</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-indigo-600">{Math.round(totalHours)}h</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Hours</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-rose-500">{daysLeft}</p>
          <p className="text-xs text-gray-500 mt-0.5">Days Left</p>
        </div>
      </div>

      {/* Subtask list */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-list-check-2 text-violet-500" />
          </div>
          Subtask Breakdown
        </h3>
        <div className="space-y-2">
          {subtasks.map((s, idx) => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold flex-shrink-0 ${DAY_COLORS[idx % DAY_COLORS.length]}`}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 leading-tight">{s.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <i className="ri-calendar-line" />{formatDate(s.day)}
                  </span>
                  <span className="text-xs text-violet-500 font-medium">{s.hours}h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-timeline-view text-violet-500" />
          </div>
          Timeline
        </h3>
        <div className="space-y-2">
          {sortedDays.map((day, idx) => {
            const tasks = dayGroups[day];
            const dayHours = tasks.reduce((s, t) => s + t.hours, 0);
            return (
              <div key={day} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">{formatDate(day)}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full flex items-center px-2 ${DAY_COLORS[idx % DAY_COLORS.length]}`}
                    style={{ width: `${Math.max(15, Math.min(100, (dayHours / 4) * 100))}%` }}
                  >
                    <span className="text-white text-xs font-bold whitespace-nowrap">{dayHours}h</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{tasks.length}t</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────
interface DashboardTabProps {
  taskInfo: TaskInput;
  subtasks: Subtask[];
  completedTasks: string[];
  onToggle: (subtask: Subtask, e: React.MouseEvent) => void;
  completingId: string | null;
}

const DashboardTab = ({ taskInfo, subtasks, completedTasks, onToggle, completingId }: DashboardTabProps) => {
  const today = getTodayKey();
  const daysLeft = getDaysLeft(taskInfo.deadline);
  const completedCount = subtasks.filter((s) => completedTasks.includes(s.id)).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const todayTasks = subtasks.filter((s) => s.day === today);

  const dayGroups: Record<string, { total: number; done: number }> = {};
  subtasks.forEach((s) => {
    if (!dayGroups[s.day]) dayGroups[s.day] = { total: 0, done: 0 };
    dayGroups[s.day].total += 1;
    if (completedTasks.includes(s.id)) dayGroups[s.day].done += 1;
  });
  const chartDays = Object.keys(dayGroups).sort().slice(0, 7);

  const progressColor = progress >= 70
    ? 'from-emerald-500 to-teal-500'
    : progress >= 30
    ? 'from-amber-500 to-orange-500'
    : 'from-violet-500 to-indigo-500';

  return (
    <div className="space-y-4">
      {/* Progress Hero */}
      <div className={`bg-gradient-to-r ${progressColor} rounded-2xl p-5 text-white`}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-base font-bold leading-tight">{taskInfo.task}</h2>
            <p className="text-sm text-white/80 mt-0.5">Task Progress</p>
          </div>
          <p className="text-4xl font-black">{progress}%</p>
        </div>
        <div className="bg-white/20 rounded-full h-2.5 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/70">
          <span>{completedCount} completed</span>
          <span>{totalCount - completedCount} remaining</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-violet-600">{completedCount}</p>
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
        <div className="flex items-end gap-2 h-20">
          {chartDays.map((day, idx) => {
            const data = dayGroups[day];
            const pct = data.total > 0 ? (data.done / data.total) * 100 : 0;
            const isToday = day === today;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gray-100 rounded-lg overflow-hidden h-14 flex flex-col justify-end">
                  <div
                    className={`w-full rounded-lg transition-all duration-700 ${isToday ? 'bg-violet-500' : DAY_COLORS[idx % DAY_COLORS.length]}`}
                    style={{ height: `${Math.max(8, pct)}%` }}
                  />
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
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-sun-line text-amber-500" />
            </div>
            Today&apos;s Tasks
            <span className="ml-auto text-xs text-gray-400">{formatDate(today)}</span>
          </h3>
          <div className="space-y-2">
            {todayTasks.map((subtask) => {
              const isDone = completedTasks.includes(subtask.id);
              const isCompleting = completingId === subtask.id;
              return (
                <button
                  key={subtask.id}
                  onClick={(e) => onToggle(subtask, e)}
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
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-list-check-2 text-violet-500" />
          </div>
          All Subtasks
        </h3>
        <div className="space-y-2">
          {subtasks.map((subtask, idx) => {
            const isDone = completedTasks.includes(subtask.id);
            const isPast = subtask.day < today;
            const isCompleting = completingId === subtask.id;
            return (
              <button
                key={subtask.id}
                onClick={(e) => onToggle(subtask, e)}
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
    </div>
  );
};

// ─── Tab: Feedback ────────────────────────────────────────────────────────────
const FeedbackTab = ({ taskInfo, subtasks, completedTasks }: {
  taskInfo: TaskInput;
  subtasks: Subtask[];
  completedTasks: string[];
}) => {
  const completedCount = subtasks.filter((s) => completedTasks.includes(s.id)).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const daysLeft = getDaysLeft(taskInfo.deadline);
  const config = getFeedbackConfig(progress);
  const remainingTasks = subtasks.filter((s) => !completedTasks.includes(s.id));

  return (
    <div className="space-y-4">
      {/* Achievement Card */}
      <div className={`bg-gradient-to-r ${config.bgGradient} rounded-2xl p-6 text-white`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold mb-3">{config.badge}</span>
            <h2 className="text-xl font-black leading-tight">{config.title}</h2>
            <p className="text-sm text-white/80 mt-2 leading-relaxed">{config.subtitle}</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/20 flex-shrink-0 ml-3">
            <i className={`${config.icon} text-2xl text-white`} />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/70 mb-1.5">
            <span>Progress</span><span>{progress}%</span>
          </div>
          <div className="bg-white/20 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-white/70 mt-1.5">
            <span>{completedCount} done</span><span>{totalCount} total</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-100">
              <i className="ri-check-double-line text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Completed</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">of {totalCount} tasks</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-100">
              <i className="ri-calendar-line text-rose-500" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Days Left</span>
          </div>
          <p className="text-3xl font-black text-rose-500">{daysLeft}</p>
          <p className="text-xs text-gray-400 mt-0.5">until {formatDate(taskInfo.deadline)}</p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-lightbulb-line text-amber-500" />
          </div>
          Tips for You
        </h3>
        <div className="space-y-2.5">
          {config.tips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center rounded-full bg-violet-100 flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-violet-600">{idx + 1}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reminders */}
      {remainingTasks.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-alarm-line text-rose-500" />
            </div>
            Reminders
            <span className="ml-auto text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-semibold">{remainingTasks.length} left</span>
          </h3>
          <div className="space-y-2">
            {remainingTasks.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight truncate">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.day)} · {s.hours}h</p>
                </div>
              </div>
            ))}
            {remainingTasks.length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{remainingTasks.length - 5} more tasks</p>
            )}
          </div>
        </div>
      )}

      {remainingTasks.length === 0 && completedCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200 text-center">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 rounded-2xl bg-emerald-100">
            <i className="ri-trophy-line text-2xl text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-emerald-800 mb-1">All Tasks Complete!</h3>
          <p className="text-sm text-emerald-600">Amazing work! You&apos;ve finished everything!</p>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
type TabType = 'plan' | 'dashboard' | 'feedback';

const TaskDetailPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [particles, setParticles] = useState<{
    id: number; x: number; y: number; vx: number; vy: number;
    color: string; size: number; life: number;
  }[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const toastCounter = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const p = getActivePlan();
    if (p) setPlan(p);
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
    const newP = Array.from({ length: 20 }, (_, i) => ({
      id: Date.now() + i,
      x: ox, y: oy,
      vx: (Math.random() - 0.5) * 10,
      vy: -(Math.random() * 7 + 3),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 7 + 4,
      life: 1,
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

  const handleToggleTask = useCallback((subtask: Subtask, e: React.MouseEvent) => {
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
  }, [plan, spawnConfetti, addToast]);

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex flex-col items-center justify-center pb-24">
        <div className="text-center px-8">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-violet-100">
            <i className="ri-task-line text-3xl text-violet-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">No Active Plan</h2>
          <p className="text-sm text-gray-500 mb-6">Accept a plan first to view task details.</p>
          <button onClick={() => navigate('/create')} className="px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm cursor-pointer whitespace-nowrap">
            Create a Plan
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Find the task info
  const taskInfo: TaskInput | undefined = plan.tasks?.find((t) => t.id === taskId);
  if (!taskInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex flex-col items-center justify-center pb-24">
        <div className="text-center px-8">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Task Not Found</h2>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm cursor-pointer whitespace-nowrap mt-4">
            Back to Dashboard
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Filter subtasks for this task
  const taskSubtasks = plan.subtasks.filter((s) => s.taskId === taskId);
  const taskCompletedCount = taskSubtasks.filter((s) => plan.completedTasks.includes(s.id)).length;
  const taskProgress = taskSubtasks.length > 0 ? Math.round((taskCompletedCount / taskSubtasks.length) * 100) : 0;

  const TABS: { key: TabType; label: string; icon: string }[] = [
    { key: 'plan', label: 'Plan', icon: 'ri-calendar-check-line' },
    { key: 'dashboard', label: 'Dashboard', icon: 'ri-bar-chart-2-line' },
    { key: 'feedback', label: 'Feedback', icon: 'ri-star-smile-line' },
  ];

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
          <div key={t.id} className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full" style={{ animation: 'slideDown 0.3s ease-out' }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-all cursor-pointer flex-shrink-0"
            >
              <i className="ri-arrow-left-line text-base" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{taskInfo.task}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[taskInfo.priority]}`}>
                  {taskInfo.priority}
                </span>
                <span className="text-xs text-gray-400">Due {formatDate(taskInfo.deadline)}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-violet-600">{taskProgress}%</p>
              <p className="text-xs text-gray-400">{taskCompletedCount}/{taskSubtasks.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-md mx-auto px-5 pb-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-white text-violet-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`${tab.icon} text-sm`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-5">
        {activeTab === 'plan' && (
          <PlanTab taskInfo={taskInfo} subtasks={taskSubtasks} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            taskInfo={taskInfo}
            subtasks={taskSubtasks}
            completedTasks={plan.completedTasks}
            onToggle={handleToggleTask}
            completingId={completingId}
          />
        )}
        {activeTab === 'feedback' && (
          <FeedbackTab
            taskInfo={taskInfo}
            subtasks={taskSubtasks}
            completedTasks={plan.completedTasks}
          />
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

export default TaskDetailPage;
