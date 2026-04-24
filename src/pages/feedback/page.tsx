import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plan, TaskInput } from '@/types/plan';
import { getActivePlan, saveActivePlan } from '@/utils/planStorage';
import BottomNav from '@/components/feature/BottomNav';

interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number; shape: 'circle' | 'rect' | 'star';
}

const CONFETTI_COLORS = ['#8b5cf6', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#84cc16'];

const CARD_GRADIENTS = [
  'from-violet-500 to-indigo-500', 'from-sky-500 to-teal-500',
  'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
];
const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-rose-100 text-rose-700',
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getDaysLeft = (deadline: string) =>
  Math.max(0, Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

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

// ─── Task Selector Strip ──────────────────────────────────────────────────────
interface TaskSelectorProps {
  tasks: TaskInput[];
  selectedId: string;
  plan: Plan;
  onSelect: (id: string) => void;
}

const TaskSelector = ({ tasks, selectedId, plan, onSelect }: TaskSelectorProps) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {tasks.map((t, idx) => {
      const subs = plan.subtasks.filter((s) => s.taskId === t.id);
      const done = subs.filter((s) => plan.completedTasks.includes(s.id)).length;
      const progress = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
      const isSelected = t.id === selectedId;
      const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];

      return (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            isSelected
              ? `bg-gradient-to-r ${gradient} text-white`
              : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
          }`}
        >
          <span>{t.task.length > 16 ? t.task.slice(0, 16) + '…' : t.task}</span>
          <span className={`ml-2 text-xs font-bold ${isSelected ? 'text-white/80' : 'text-violet-500'}`}>{progress}%</span>
        </button>
      );
    })}
  </div>
);

// ─── Celebration Overlay ──────────────────────────────────────────────────────
interface CelebrationProps {
  taskName: string;
  onClose: () => void;
}

const CelebrationOverlay = ({ taskName, onClose }: CelebrationProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Spawn a big burst of confetti
    const burst = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 12 + 4),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 10 + 5,
      life: 1,
      shape: (['circle', 'rect', 'star'] as const)[Math.floor(Math.random() * 3)],
    }));
    setParticles(burst);

    let frame = 0;
    const animate = () => {
      frame++;
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, vx: p.vx * 0.98, life: p.life - 0.012 }))
          .filter((p) => p.life > 0)
      );
      if (frame < 120) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);

    // Auto-close after 5s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400);
    }, 5000);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-400 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Confetti canvas */}
      <div className="fixed inset-0 pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute ${p.shape === 'circle' ? 'rounded-full' : p.shape === 'rect' ? 'rounded-sm' : 'rounded-sm rotate-45'}`}
            style={{
              left: p.x, top: p.y,
              width: p.size, height: p.shape === 'rect' ? p.size * 0.5 : p.size,
              backgroundColor: p.color,
              opacity: p.life,
              transform: `rotate(${p.vx * 15}deg)`,
            }}
          />
        ))}
      </div>

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-3xl p-8 mx-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
        {/* Trophy icon with pulse ring */}
        <div className="relative w-24 h-24 flex items-center justify-center mx-auto mb-5">
          <div className="absolute inset-0 rounded-full bg-amber-200 animate-ping opacity-40" />
          <div className="absolute inset-2 rounded-full bg-amber-100 animate-pulse" />
          <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
            <i className="ri-trophy-fill text-4xl text-white" />
          </div>
        </div>

        <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold mb-4 uppercase tracking-widest">
          Task Complete!
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2">Congratulations!</h2>
        <p className="text-sm text-gray-500 mb-1 leading-relaxed">You&apos;ve completed</p>
        <p className="text-base font-bold text-violet-700 mb-4 px-2 leading-snug">&ldquo;{taskName}&rdquo;</p>
        <p className="text-sm text-gray-400 mb-6">100% done — outstanding work! Keep the momentum going!</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            Keep Going!
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const FeedbackPage = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [celebratingTask, setCelebratingTask] = useState<TaskInput | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const p = getActivePlan();
    if (p) {
      setPlan(p);
      setSelectedTaskId(p.selectedTaskId || p.tasks?.[0]?.id || 'task0');
    }
  }, []);

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    if (plan) {
      const updated = { ...plan, selectedTaskId: taskId };
      saveActivePlan(updated);
      setPlan(updated);

      // Check if this task is 100% complete and hasn't been celebrated yet
      const subs = plan.subtasks.filter((s) => s.taskId === taskId);
      const done = subs.filter((s) => plan.completedTasks.includes(s.id)).length;
      const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
      const task = plan.tasks.find((t) => t.id === taskId);
      if (pct === 100 && task && !celebratedRef.current.has(taskId)) {
        celebratedRef.current.add(taskId);
        setCelebratingTask(task);
      }
    }
  }, [plan]);

  // Auto-trigger celebration when page loads if selected task is 100%
  useEffect(() => {
    if (!plan || !selectedTaskId) return;
    const subs = plan.subtasks.filter((s) => s.taskId === selectedTaskId);
    const done = subs.filter((s) => plan.completedTasks.includes(s.id)).length;
    const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
    const task = plan.tasks.find((t) => t.id === selectedTaskId);
    if (pct === 100 && task && !celebratedRef.current.has(selectedTaskId)) {
      celebratedRef.current.add(selectedTaskId);
      const timer = setTimeout(() => setCelebratingTask(task), 600);
      return () => clearTimeout(timer);
    }
  }, [plan, selectedTaskId]);

  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex flex-col items-center justify-center pb-24 px-8">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-100">
            <i className="ri-star-smile-line text-4xl text-violet-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Your Feedback Awaits</h2>
          <p className="text-sm text-gray-500 mb-2 leading-relaxed">
            Get personalized tips, achievement badges, and progress insights based on your tasks.
          </p>
          <p className="text-xs text-gray-400 mb-8">No active tasks yet. Create your first one to get started.</p>
          <button
            onClick={() => navigate('/create')}
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
  }

  const selectedTask = plan.tasks?.find((t) => t.id === selectedTaskId) || plan.tasks?.[0];
  const taskSubtasks = selectedTask ? plan.subtasks.filter((s) => s.taskId === selectedTask.id) : [];
  const completedCount = taskSubtasks.filter((s) => plan.completedTasks.includes(s.id)).length;
  const totalCount = taskSubtasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const daysLeft = selectedTask ? getDaysLeft(selectedTask.deadline) : 0;
  const config = getFeedbackConfig(progress);
  const remainingTasks = taskSubtasks.filter((s) => !plan.completedTasks.includes(s.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-24">
      {/* Celebration Overlay */}
      {celebratingTask && (
        <CelebrationOverlay
          taskName={celebratingTask.task}
          onClose={() => setCelebratingTask(null)}
        />
      )}
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600">
              <i className="ri-star-smile-line text-white text-base" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Your Feedback</h1>
              <p className="text-xs text-gray-400">Step 4 of 4 — Keep going!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-5">
        {/* Task Selector */}
        {plan.tasks && plan.tasks.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Task</p>
            <TaskSelector tasks={plan.tasks} selectedId={selectedTaskId} plan={plan} onSelect={handleSelectTask} />
          </div>
        )}

        {selectedTask && (
          <>
            {/* Task Info */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{selectedTask.task}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[selectedTask.priority]}`}>
                    {selectedTask.priority}
                  </span>
                  <span className="text-xs text-gray-400">Due {formatDate(selectedTask.deadline)} · {daysLeft}d left</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black text-violet-600">{progress}%</p>
                <p className="text-xs text-gray-400">{completedCount}/{totalCount}</p>
              </div>
            </div>

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
                <p className="text-xs text-gray-400 mt-0.5">until {formatDate(selectedTask.deadline)}</p>
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
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(s.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {s.hours}h
                        </p>
                      </div>
                    </div>
                  ))}
                  {remainingTasks.length > 5 && (
                    <p className="text-xs text-gray-400 text-center pt-1">+{remainingTasks.length - 5} more tasks</p>
                  )}
                </div>
              </div>
            )}

            {/* All Done */}
            {remainingTasks.length === 0 && completedCount > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200 text-center">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 rounded-2xl bg-emerald-100">
                  <i className="ri-trophy-line text-2xl text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-emerald-800 mb-1">All Tasks Complete!</h3>
                <p className="text-sm text-emerald-600">Amazing work! You&apos;ve finished everything!</p>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <button onClick={() => navigate('/dashboard')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
          <i className="ri-bar-chart-2-line text-base" />
          Back to Dashboard
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default FeedbackPage;
