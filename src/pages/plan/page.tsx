import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plan, Subtask, TaskInput, Priority, DayOfWeek } from '@/types/plan';
import {
  getDemoPlan,
  saveDemoPlan,
  acceptPendingPlan,
  getActivePlan,
  saveActivePlan,
  syncActivePlanToCloud,
  restoreActivePlanFromCloud,
} from '@/utils/planStorage';
import BottomNav from '@/components/feature/BottomNav';
import { signOut } from '@/utils/auth';


interface Toast {
  id: number;
  message: string;
}

const DAY_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-pink-500',
];
const TASK_COLORS = [
  { bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-sky-500', light: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500' },
];
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
const PRIORITY_ACTIVE: Record<Priority, string> = {
  Low: 'bg-emerald-500 text-white border-emerald-500',
  Medium: 'bg-amber-500 text-white border-amber-500',
  High: 'bg-rose-500 text-white border-rose-500',
};
const PRIORITY_INACTIVE: Record<Priority, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-rose-50 text-rose-700 border-rose-200',
};
const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};
const getDaysLeft = (deadline: string) =>
  Math.max(0, Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
const makeSubtaskId = (taskId: string) =>
  `${taskId}-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ─── Calendar View ────────────────────────────────────────────────────────────
interface CalendarDayDetail {
  date: string;
  subtasks: Array<{ subtask: Subtask; task: TaskInput; colorIdx: number }>;
  totalHours: number;
  taskCount: number;
}

interface DayDetailModalProps {
  detail: CalendarDayDetail;
  taskColorMap: Record<string, number>;
  onClose: () => void;
}

const DayDetailModal = ({ detail, taskColorMap, onClose }: DayDetailModalProps) => {
  const dateObj = new Date(detail.date + 'T00:00:00');
  const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">{dayLabel}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {detail.taskCount} task{detail.taskCount !== 1 ? 's' : ''} · {detail.totalHours}h total
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Task summary */}
        <div className="space-y-3">
          {detail.subtasks.map(({ subtask, task, colorIdx }) => {
            const color = TASK_COLORS[colorIdx % TASK_COLORS.length];
            return (
              <div key={subtask.id} className={`rounded-2xl p-4 ${color.light}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${color.text}`}>{task.task}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{subtask.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs font-semibold ${color.text} flex items-center gap-1`}>
                        <i className="ri-timer-line" />{subtask.hours}h
                      </span>
                      {subtask.done && (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <i className="ri-check-line" />Done
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hours bar */}
        <div className="mt-5 p-4 bg-gray-50 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Total workload today</span>
            <span className="text-sm font-bold text-violet-600">{detail.totalHours}h</span>
          </div>
          <div className="flex gap-1">
            {detail.subtasks.map(({ subtask, colorIdx }) => {
              const color = TASK_COLORS[colorIdx % TASK_COLORS.length];
              const pct = (subtask.hours / detail.totalHours) * 100;
              return (
                <div key={subtask.id} className={`h-2 rounded-full ${color.bg}`} style={{ width: `${pct}%` }} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface CalendarViewProps {
  plan: Plan;
}

const CalendarView = ({ plan }: CalendarViewProps) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<CalendarDayDetail | null>(null);

  // Build task color map
  const taskColorMap: Record<string, number> = {};
  plan.tasks.forEach((t, idx) => { taskColorMap[t.id] = idx; });

  // Build date → subtasks map
  const dateMap: Record<string, Array<{ subtask: Subtask; task: TaskInput; colorIdx: number }>> = {};
  plan.subtasks.forEach((s) => {
    const task = plan.tasks.find((t) => t.id === s.taskId);
    if (!task) return;
    if (!dateMap[s.day]) dateMap[s.day] = [];
    dateMap[s.day].push({ subtask: s, task, colorIdx: taskColorMap[s.taskId] ?? 0 });
  });

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const cells: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const getDateStr = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${currentYear}-${mm}-${dd}`;
  };

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const handleDayClick = (day: number) => {
    const dateStr = getDateStr(day);
    const items = dateMap[dateStr];
    if (!items || items.length === 0) return;
    const totalHours = items.reduce((s, { subtask }) => s + subtask.hours, 0);
    const taskIds = new Set(items.map(({ subtask }) => subtask.taskId));
    setSelectedDay({ date: dateStr, subtasks: items, totalHours, taskCount: taskIds.size });
  };

  // Legend
  const activeTasks = plan.tasks.filter((t) => {
    const subs = plan.subtasks.filter((s) => s.taskId === t.id);
    return subs.length > 0;
  });

  return (
    <div className="space-y-5">
      {selectedDay && (
        <DayDetailModal detail={selectedDay} taskColorMap={taskColorMap} onClose={() => setSelectedDay(null)} />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-200 mb-1">Schedule Overview</p>
        <h2 className="text-lg font-bold mb-1">Your Task Calendar</h2>
        <p className="text-sm text-violet-200">
          {plan.tasks.length} active task{plan.tasks.length !== 1 ? 's' : ''} · {plan.subtasks.length} subtasks scheduled
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Tasks</p>
        <div className="space-y-2">
          {activeTasks.map((t) => {
            const colorIdx = taskColorMap[t.id] ?? 0;
            const color = TASK_COLORS[colorIdx % TASK_COLORS.length];
            const subs = plan.subtasks.filter((s) => s.taskId === t.id);
            const doneSubs = subs.filter((s) => s.done).length;
            const pct = subs.length > 0 ? Math.round((doneSubs / subs.length) * 100) : 0;
            return (
              <div key={t.id} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.task}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color.bg}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${color.text}`}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 cursor-pointer transition-all">
            <i className="ri-arrow-left-s-line text-lg" />
          </button>
          <h3 className="text-base font-bold text-gray-900">{monthLabel}</h3>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 cursor-pointer transition-all">
            <i className="ri-arrow-right-s-line text-lg" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} />;
            }
            const dateStr = getDateStr(day);
            const items = dateMap[dateStr] || [];
            const hasItems = items.length > 0;
            const todayFlag = isToday(day);
            const uniqueTaskIds = [...new Set(items.map((i) => i.subtask.taskId))];
            const totalHours = items.reduce((s, { subtask }) => s + subtask.hours, 0);

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={`relative flex flex-col items-center rounded-xl py-1.5 transition-all ${
                  hasItems ? 'cursor-pointer hover:bg-violet-50' : 'cursor-default'
                } ${todayFlag ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}
              >
                {/* Day number */}
                <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  todayFlag ? 'bg-violet-600 text-white' : 'text-gray-700'
                }`}>
                  {day}
                </span>

                {/* Task color dots */}
                {hasItems && (
                  <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                    {uniqueTaskIds.slice(0, 3).map((tid) => {
                      const colorIdx = taskColorMap[tid] ?? 0;
                      const color = TASK_COLORS[colorIdx % TASK_COLORS.length];
                      return <div key={tid} className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />;
                    })}
                    {uniqueTaskIds.length > 3 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>
                )}

                {/* Hours badge */}
                {hasItems && (
                  <span className="text-xs text-violet-500 font-bold mt-0.5 leading-none">{totalHours}h</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming subtasks list */}
      <UpcomingList plan={plan} taskColorMap={taskColorMap} />
    </div>
  );
};

// ─── Upcoming Subtasks List ───────────────────────────────────────────────────
interface UpcomingListProps {
  plan: Plan;
  taskColorMap: Record<string, number>;
}

const UpcomingList = ({ plan, taskColorMap }: UpcomingListProps) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Group subtasks by date, only upcoming (today + future)
  const grouped: Record<string, Array<{ subtask: Subtask; task: TaskInput; colorIdx: number }>> = {};
  plan.subtasks.forEach((s) => {
    if (s.day < todayStr) return;
    const task = plan.tasks.find((t) => t.id === s.taskId);
    if (!task) return;
    if (!grouped[s.day]) grouped[s.day] = [];
    grouped[s.day].push({ subtask: s, task, colorIdx: taskColorMap[s.taskId] ?? 0 });
  });

  const sortedDates = Object.keys(grouped).sort().slice(0, 14); // show next 14 days with tasks

  if (sortedDates.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
        <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2 text-gray-300">
          <i className="ri-calendar-check-line text-3xl" />
        </div>
        <p className="text-sm text-gray-400">No upcoming subtasks</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-calendar-todo-line text-violet-500" />
        </div>
        Upcoming Schedule
      </h3>
      <div className="space-y-4">
        {sortedDates.map((dateStr) => {
          const items = grouped[dateStr];
          const dateObj = new Date(dateStr + 'T00:00:00');
          const isToday = dateStr === todayStr;
          const dayLabel = isToday
            ? 'Today'
            : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const totalHours = items.reduce((s, { subtask }) => s + subtask.hours, 0);
          const uniqueTaskCount = new Set(items.map((i) => i.subtask.taskId)).size;

          return (
            <div key={dateStr}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isToday ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {dayLabel}
                </span>
                <span className="text-xs text-gray-400">{uniqueTaskCount} task{uniqueTaskCount !== 1 ? 's' : ''} · {totalHours}h</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Subtasks */}
              <div className="space-y-2 pl-1">
                {items.map(({ subtask, task, colorIdx }) => {
                  const color = TASK_COLORS[colorIdx % TASK_COLORS.length];
                  return (
                    <div key={subtask.id} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{subtask.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-semibold ${color.text}`}>{task.task}</span>
                          <span className="text-xs text-gray-400">{subtask.hours}h</span>
                          {subtask.done && (
                            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-0.5">
                              <i className="ri-check-line" />Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Task Info Edit Modal ─────────────────────────────────────────────────────
interface TaskEditModalProps {
  taskInfo: TaskInput;
  onSave: (updated: TaskInput) => void;
  onClose: () => void;
}

const TaskEditModal = ({ taskInfo, onSave, onClose }: TaskEditModalProps) => {
  const [deadline, setDeadline] = useState(taskInfo.deadline);
  const [priority, setPriority] = useState<Priority>(taskInfo.priority);
  const [hoursPerDay, setHoursPerDay] = useState(taskInfo.hoursPerDay);
  const [activeDays, setActiveDays] = useState<DayOfWeek[]>(taskInfo.activeDays);
  const today = new Date().toISOString().split('T')[0];

  const toggleDay = (day: DayOfWeek) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!deadline || activeDays.length === 0) return;
    onSave({ ...taskInfo, deadline, priority, hoursPerDay, activeDays });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 80px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 px-6 pt-6 pb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-gray-900">Edit Task Info</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{taskInfo.task}</p>
            </div>
            <button
              onClick={() => { if (deadline && activeDays.length > 0) { handleSave(); } else { onClose(); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold cursor-pointer transition-all whitespace-nowrap"
            >
              <i className="ri-save-line text-sm" /> Save &amp; Close
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              <i className="ri-calendar-line text-violet-400 mr-1" />Deadline
            </label>
            <input
              type="date" value={deadline} min={today}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              <i className="ri-flag-line text-violet-400 mr-1" />Priority
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    priority === p ? PRIORITY_ACTIVE[p] : PRIORITY_INACTIVE[p]
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              <i className="ri-timer-line text-violet-400 mr-1" />Daily Available Hours
            </label>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2">
              <button onClick={() => setHoursPerDay((h) => Math.max(0.5, Math.round((h - 0.5) * 10) / 10))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 cursor-pointer">
                <i className="ri-subtract-line" />
              </button>
              <div className="text-center">
                <span className="text-2xl font-bold text-violet-600">{hoursPerDay}</span>
                <span className="text-sm text-gray-400 ml-1">hrs/day</span>
              </div>
              <button onClick={() => setHoursPerDay((h) => Math.min(12, Math.round((h + 0.5) * 10) / 10))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 cursor-pointer">
                <i className="ri-add-line" />
              </button>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              <i className="ri-calendar-2-line text-violet-400 mr-1" />Active Days
            </label>
            <div className="flex gap-1 flex-wrap">
              {DAYS.map((day) => {
                const isActive = activeDays.includes(day);
                return (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`flex-1 min-w-[36px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      isActive ? 'bg-violet-600 text-white border-violet-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300'
                    }`}>
                    {day}
                  </button>
                );
              })}
            </div>
            {activeDays.length === 0 && (
              <p className="text-xs text-rose-500 mt-1">Select at least one day</p>
            )}
          </div>
        </div>

        {/* Fixed bottom buttons — always visible */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm cursor-pointer whitespace-nowrap">Cancel</button>
            <button onClick={handleSave} disabled={!deadline || activeDays.length === 0}
              className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm cursor-pointer whitespace-nowrap disabled:opacity-50">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sortable Subtask Row ─────────────────────────────────────────────────────
interface SortableSubtaskRowProps {
  subtask: Subtask;
  index: number;
  modifyMode: boolean;
  onEdit: (s: Subtask) => void;
  onRemove: (id: string) => void;
}

const SortableSubtaskRow = ({ subtask, index, modifyMode, onEdit, onRemove }: SortableSubtaskRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
      <button {...attributes} {...listeners}
        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-violet-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
        <i className="ri-draggable text-base" />
      </button>
      <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold flex-shrink-0 ${DAY_COLORS[index % DAY_COLORS.length]}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight truncate">{subtask.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <i className="ri-calendar-line" />{formatDate(subtask.day)}
          </span>
          <span className="text-xs text-violet-500 font-medium">{subtask.hours}h</span>
        </div>
      </div>
      {modifyMode && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(subtask)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer">
            <i className="ri-edit-line text-sm" />
          </button>
          <button onClick={() => onRemove(subtask.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer">
            <i className="ri-delete-bin-line text-sm" />
          </button>
        </div>
      )}
    </div>
  );
};

const SubtaskOverlayCard = ({ subtask, index }: { subtask: Subtask; index: number }) => (
  <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-violet-300 opacity-95">
    <div className="w-6 h-6 flex items-center justify-center text-violet-400 flex-shrink-0">
      <i className="ri-draggable text-base" />
    </div>
    <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold flex-shrink-0 ${DAY_COLORS[index % DAY_COLORS.length]}`}>
      {index + 1}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-800 leading-tight truncate">{subtask.title}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-gray-400">{formatDate(subtask.day)}</span>
        <span className="text-xs text-violet-500 font-medium">{subtask.hours}h</span>
      </div>
    </div>
  </div>
);

// ─── Subtask Edit/Add Modal ───────────────────────────────────────────────────
interface SubtaskModalProps {
  subtask: Subtask | null;
  taskId: string;
  defaultDay: string;
  onSave: (s: Subtask) => void;
  onClose: () => void;
}

const SubtaskModal = ({ subtask, taskId, defaultDay, onSave, onClose }: SubtaskModalProps) => {
  const isAdd = subtask === null;
  const [title, setTitle] = useState(subtask?.title ?? '');
  const [day, setDay] = useState(subtask?.day ?? defaultDay);
  const [hours, setHours] = useState(subtask?.hours ?? 1);

  const handleSave = () => {
    if (!title.trim() || !day) return;
    onSave({
      id: subtask?.id ?? makeSubtaskId(taskId),
      taskId, title: title.trim(), day, hours, done: subtask?.done ?? false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 80px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 px-6 pt-6 pb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">{isAdd ? 'Add Subtask' : 'Edit Subtask'}</h3>
            <button
              onClick={() => { if (title.trim() && day) { handleSave(); } else { onClose(); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold cursor-pointer transition-all whitespace-nowrap"
            >
              <i className="ri-save-line text-sm" /> Save &amp; Close
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Subtask Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Draft outline"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Scheduled Date</label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
            />
          </div>
          <div className="mb-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Estimated Hours <span className="font-normal text-gray-400 ml-1">— total hours update automatically</span>
            </label>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2">
              <button onClick={() => setHours((h) => Math.max(0.5, Math.round((h - 0.5) * 10) / 10))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 cursor-pointer">
                <i className="ri-subtract-line" />
              </button>
              <div className="text-center">
                <span className="text-2xl font-bold text-violet-600">{hours}</span>
                <span className="text-sm text-gray-400 ml-1">hrs</span>
              </div>
              <button onClick={() => setHours((h) => Math.min(12, Math.round((h + 0.5) * 10) / 10))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 cursor-pointer">
                <i className="ri-add-line" />
              </button>
            </div>
          </div>
        </div>

        {/* Fixed bottom buttons — always visible */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm cursor-pointer whitespace-nowrap">Cancel</button>
            <button onClick={handleSave} disabled={!title.trim() || !day}
              className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm cursor-pointer whitespace-nowrap disabled:opacity-50">
              {isAdd ? 'Add Subtask' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Per-Task Panel ───────────────────────────────────────────────────────────
interface TaskSubtaskPanelProps {
  taskInfo: TaskInput;
  plan: Plan;
  isActivePlan?: boolean;
  onPlanUpdate: (updated: Plan) => void;
}

const TaskSubtaskPanel = ({ taskInfo, plan, isActivePlan = false, onPlanUpdate }: TaskSubtaskPanelProps) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [modalSubtask, setModalSubtask] = useState<Subtask | null | undefined>(undefined);
  const [modifyMode, setModifyMode] = useState(isActivePlan);
  const [editingTaskInfo, setEditingTaskInfo] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const taskSubtasks = plan.subtasks.filter((s) => s.taskId === taskInfo.id);
  const totalHours = taskSubtasks.reduce((s, t) => s + t.hours, 0);
  const daysLeft = getDaysLeft(taskInfo.deadline);

  const dayGroups: Record<string, Subtask[]> = {};
  taskSubtasks.forEach((s) => {
    if (!dayGroups[s.day]) dayGroups[s.day] = [];
    dayGroups[s.day].push(s);
  });
  const sortedDays = Object.keys(dayGroups).sort();

  const activeDragSubtask = activeDragId ? taskSubtasks.find((s) => s.id === activeDragId) : null;
  const activeDragIndex = activeDragId ? taskSubtasks.findIndex((s) => s.id === activeDragId) : 0;

  const savePlan = (updated: Plan) => {
    if (isActivePlan) {
      saveActivePlan(updated);
    } else {
      saveDemoPlan(updated);
    }
    onPlanUpdate(updated);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = taskSubtasks.findIndex((s) => s.id === active.id);
    const newIdx = taskSubtasks.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(taskSubtasks, oldIdx, newIdx);
    const others = plan.subtasks.filter((s) => s.taskId !== taskInfo.id);
    savePlan({ ...plan, subtasks: [...others, ...reordered] });
  };

  const handleSaveSubtask = (saved: Subtask) => {
    const exists = plan.subtasks.find((s) => s.id === saved.id);
    const updatedSubtasks = exists
      ? plan.subtasks.map((s) => s.id === saved.id ? saved : s)
      : [...plan.subtasks, saved];
    savePlan({ ...plan, subtasks: updatedSubtasks });
    setModalSubtask(undefined);
  };

  const handleRemoveSubtask = (id: string) => {
    savePlan({ ...plan, subtasks: plan.subtasks.filter((s) => s.id !== id) });
  };

  const handleSaveTaskInfo = (updated: TaskInput) => {
    const updatedTasks = plan.tasks.map((t) => t.id === updated.id ? updated : t);
    savePlan({ ...plan, tasks: updatedTasks });
    setEditingTaskInfo(false);
  };

  const defaultDay = taskInfo.deadline || new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {modalSubtask !== undefined && (
        <SubtaskModal subtask={modalSubtask} taskId={taskInfo.id} defaultDay={defaultDay}
          onSave={handleSaveSubtask} onClose={() => setModalSubtask(undefined)} />
      )}
      {editingTaskInfo && (
        <TaskEditModal taskInfo={taskInfo} onSave={handleSaveTaskInfo} onClose={() => setEditingTaskInfo(false)} />
      )}

      {/* Task Info Card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-information-line text-violet-500" />
            </div>
            Task Info
          </h3>
          <button onClick={() => setEditingTaskInfo(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1">
            <i className="ri-edit-line" /> Edit Info
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Deadline</p>
            <p className="text-sm font-semibold text-gray-800">{formatDate(taskInfo.deadline)}</p>
            <p className="text-xs text-rose-500 font-medium mt-0.5">{daysLeft}d left</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Priority</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_BADGE[taskInfo.priority]}`}>
              {taskInfo.priority}
            </span>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Daily Hours</p>
            <p className="text-sm font-semibold text-violet-600">{taskInfo.hoursPerDay}h/day</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Active Days</p>
            <div className="flex flex-wrap gap-0.5">
              {taskInfo.activeDays.map((d) => (
                <span key={d} className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-medium">{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-violet-600">{taskSubtasks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Subtasks</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-indigo-600">{Math.round(totalHours * 10) / 10}h</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Hours</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
          <p className="text-2xl font-bold text-rose-500">{daysLeft}</p>
          <p className="text-xs text-gray-500 mt-0.5">Days Left</p>
        </div>
      </div>

      {/* Subtask List */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-list-check-2 text-violet-500" />
            </div>
            Subtasks
          </h3>
          <button onClick={() => setModifyMode((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              modifyMode ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
            }`}>
            <i className={modifyMode ? 'ri-check-line' : 'ri-edit-line'} />
            {modifyMode ? 'Done' : 'Modify'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <i className="ri-drag-move-line" /> Drag to reorder
          {modifyMode && <span className="ml-2 text-violet-500">· Edit, add or remove subtasks</span>}
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={taskSubtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {taskSubtasks.map((subtask, idx) => (
                <SortableSubtaskRow key={subtask.id} subtask={subtask} index={idx}
                  modifyMode={modifyMode} onEdit={(s) => setModalSubtask(s)} onRemove={handleRemoveSubtask} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragSubtask ? <SubtaskOverlayCard subtask={activeDragSubtask} index={activeDragIndex} /> : null}
          </DragOverlay>
        </DndContext>

        {modifyMode && (
          <>
            <button onClick={() => setModalSubtask(null)}
              className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-violet-300 text-violet-500 text-sm font-semibold hover:bg-violet-50 hover:border-violet-400 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
              <i className="ri-add-circle-line" /> Add Subtask
            </button>
            <div className="mt-3 px-3 py-2 bg-violet-50 rounded-xl flex items-center justify-between">
              <span className="text-xs text-violet-600 font-medium">Total planned hours</span>
              <span className="text-sm font-bold text-violet-700">{Math.round(totalHours * 10) / 10}h</span>
            </div>
          </>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-timeline-view text-violet-500" />
          </div>
          Timeline
        </h3>
        {sortedDays.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No subtasks scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedDays.map((day, idx) => {
              const daySubs = dayGroups[day];
              const dayHours = daySubs.reduce((s, t) => s + t.hours, 0);
              const barWidth = Math.min(100, Math.max(12, (dayHours / Math.max(taskInfo.hoursPerDay, 1)) * 100));
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0">{formatDate(day)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className={`h-full rounded-full flex items-center px-2 transition-all duration-500 ${DAY_COLORS[idx % DAY_COLORS.length]}`}
                      style={{ width: `${barWidth}%` }}>
                      <span className="text-white text-xs font-bold whitespace-nowrap">{dayHours}h</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{daySubs.length}t</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Empty State (no tasks at all) ───────────────────────────────────────────
const EmptyState = ({
                      onNavigate,
                      onRestore,
                      onClearCloud,
                      onLogout,
                    }: {
  onNavigate: () => void;
  onRestore: () => void;
  onClearCloud: () => void;
  onLogout: () => void;
}) => (
  <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex flex-col items-center justify-center pb-24 px-8">
    <div className="text-center max-w-xs">
      <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-100">
        <i className="ri-sparkling-2-line text-4xl text-violet-500" />
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">Start Your First Task</h2>
      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
        Set your goal, let AI build your schedule
      </p>
      <button onClick={onNavigate}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
        <i className="ri-add-circle-line text-lg" />
        Create Your First Task
      </button>
      <button
          onClick={onRestore}
          className="mt-3 w-full py-4 rounded-2xl border border-indigo-300 text-indigo-600 font-bold"
      >
        Restore from Cloud
      </button>
      <button
          onClick={onClearCloud}
          className="mt-3 w-full py-4 rounded-2xl border border-rose-200 text-rose-500 font-bold text-base hover:bg-rose-50 transition-all cursor-pointer whitespace-nowrap"
      >
        Clear Cloud Data
      </button>

      <button
          onClick={onLogout}
          className="mt-3 w-full py-4 rounded-2xl border border-gray-200 text-gray-500 font-bold text-base hover:bg-gray-50 transition-all cursor-pointer whitespace-nowrap"
      >
        Logout
      </button>
    </div>
    <BottomNav />
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const PlanPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [pageMode, setPageMode] = useState<'pending' | 'calendar' | 'modify'>('pending');

  const modifyTaskId = searchParams.get('taskId');
  const isModifyMode = searchParams.get('mode') === 'modify' && !!modifyTaskId;

  const handleLogout = async () => {
    await signOut();
    localStorage.clear();
    navigate('/auth');
  };

  const [syncStatus, setSyncStatus] = useState<
      'idle' | 'saving' | 'success' | 'error'
  >('idle');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  useEffect(() => {
    const loadPlan = async () => {
      const active = getActivePlan();
      setActivePlan(active);

      if (isModifyMode && modifyTaskId) {
        if (active) {
          setPlan(active);
          setSelectedTaskId(modifyTaskId);
          setPageMode('modify');
          return;
        }
      }

      const pending = getDemoPlan();
      if (pending) {
        setPlan(pending);
        setSelectedTaskId(pending.selectedTaskId || pending.tasks?.[0]?.id || '');
        setPageMode('pending');
        return;
      }

      if (active && active.tasks.length > 0) {
        setPlan(active);
        setPageMode('calendar');
        return;
      }

      const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';

      if (justLoggedIn) {
        sessionStorage.removeItem('just_logged_in');

        const restored = await restoreActivePlanFromCloud();

        if (restored && restored.tasks?.length > 0) {
          setPlan(restored);
          setActivePlan(restored);
          setSelectedTaskId(restored.selectedTaskId || restored.tasks?.[0]?.id || '');
          setPageMode('calendar');
          return;
        }
      }

      // Nothing at all
      setPlan(null);
      setPageMode('pending');
    };

    loadPlan();
  }, [isModifyMode, modifyTaskId]);

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (plan) {
      const updated = { ...plan, selectedTaskId: taskId };
      if (pageMode === 'modify') {
        saveActivePlan(updated);
      } else {
        saveDemoPlan(updated);
      }
      setPlan(updated);
    }
  };

  const handleAccept = () => {
    if (!plan) return;
    acceptPendingPlan(plan);
    navigate('/dashboard');
  };

  const handlePlanUpdate = (updated: Plan) => {
    setPlan(updated);
    if (pageMode === 'calendar') setActivePlan(updated);
  };

  const handleSyncToCloud = async () => {
    try {
      setSyncStatus('saving');

      await syncActivePlanToCloud();

      setSyncStatus('success');
      addToast('Your cloud data has been cleared');

      // Disappear after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
    }
  };

  const handleRestoreFromCloud = async () => {
    const restored = await restoreActivePlanFromCloud();

    if (restored) {
      setPlan(restored);
      setActivePlan(restored);
      setSelectedTaskId(restored.selectedTaskId || restored.tasks?.[0]?.id || '');
      setPageMode('calendar');
      alert('Plan restored from cloud');
    } else {
      alert('No cloud plan found');
    }
  };

  // No tasks at all — show empty state with guide
  if (!plan) {
    return (
        <>
          {/* Toast */}
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full"
                    style={{ animation: 'slideDown 0.3s ease-out' }}
                >
                  {t.message}
                </div>
            ))}
          </div>

          <EmptyState
              onNavigate={() => navigate('/create')}
              onRestore={handleRestoreFromCloud}
              onClearCloud={handleSyncToCloud}
              onLogout={handleLogout}
          />

          <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
  }

  // Calendar mode — no pending plan, show schedule overview
  if (pageMode === 'calendar' && plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-24">
        {/* Toast */}
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map((t) => (
              <div
                  key={t.id}
                  className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full"
                  style={{ animation: 'slideDown 0.3s ease-out' }}
              >
                {t.message}
              </div>
          ))}
        </div>
        <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
          <div className="max-w-md mx-auto px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600">
                  <i className="ri-calendar-2-line text-white text-base" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900">Schedule Calendar</h1>
                  <p className="text-xs text-gray-400">View your daily subtask schedule</p>
                </div>
              </div>

              <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-md mx-auto px-5 pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
                onClick={handleSyncToCloud}
                disabled={syncStatus === 'saving'}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {syncStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
            </button>
            {syncStatus === 'saving' && (
                <p className="text-sm text-gray-500 mt-2">Syncing...</p>
            )}

            {syncStatus === 'success' && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <i className="ri-check-line" />
                Saved
                </span>
            )}

            {syncStatus === 'error' && (
                <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                <i className="ri-close-circle-line" />
                Failed
                </span>
            )}

            <button
                onClick={handleRestoreFromCloud}
                className="py-3 rounded-2xl bg-white border border-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2"
            >
              <i className="ri-download-cloud-line" /> Restore
            </button>
          </div>

          <CalendarView plan={plan} />
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
  }

  // Pending plan or modify mode — plan is guaranteed non-null here

  const selectedTask: TaskInput | undefined =
    plan.tasks?.find((t) => t.id === selectedTaskId) || plan.tasks?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-24">
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600">
              <i className={pageMode === 'modify' ? 'ri-edit-line text-white text-base' : 'ri-sparkling-2-line text-white text-base'} />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {pageMode === 'modify' ? 'Modify Task' : 'New Plan Preview'}
              </h1>
              <p className="text-xs text-gray-400">
                {pageMode === 'modify' ? 'Edit subtasks, info & schedule' : 'Review & edit before accepting'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-6 space-y-5">
        {pageMode === 'pending' && (
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200 mb-2">Pending Review</p>
            <h2 className="text-lg font-bold mb-1 leading-tight">
              {plan.tasks.length > 1 ? `${plan.tasks.length} New Tasks` : plan.task}
            </h2>
            <p className="text-sm text-violet-200">
              {plan.tasks.length > 1
                ? 'Each task has its own independent schedule. Accept to add them to your active plan.'
                : `Due ${formatDate(plan.deadline)} · ${plan.priority} Priority`}
            </p>
          </div>
        )}

        {pageMode === 'modify' && selectedTask && (
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200 mb-2">Editing Task</p>
            <h2 className="text-lg font-bold mb-1 leading-tight">{selectedTask.task}</h2>
            <p className="text-sm text-violet-200">Changes are saved immediately to your active plan.</p>
          </div>
        )}

        {pageMode === 'pending' && plan.tasks && plan.tasks.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">New Tasks to Add</p>
            <div className="space-y-2">
              {plan.tasks.map((t, idx) => {
                const isSelected = t.id === selectedTaskId;
                const taskSubs = plan.subtasks.filter((s) => s.taskId === t.id);
                const daysLeft = getDaysLeft(t.deadline);
                const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                return (
                  <button key={t.id} onClick={() => handleSelectTask(t.id)}
                    className={`w-full text-left rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                      isSelected ? `bg-gradient-to-r ${gradient} text-white border-transparent` : 'bg-white text-gray-800 border-gray-100 hover:border-violet-200'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-violet-100'}`}>
                          <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-violet-600'}`}>{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{t.task}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{daysLeft}d left · {t.hoursPerDay}h/day</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isSelected ? 'bg-white/20 text-white' : PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-right flex-shrink-0 ml-3 ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                        <p className="text-sm font-bold">{taskSubs.length} subtasks</p>
                        {isSelected && <i className="ri-arrow-down-s-line text-white/70" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedTask && (
          <TaskSubtaskPanel
            key={selectedTask.id}
            taskInfo={selectedTask}
            plan={plan}
            isActivePlan={pageMode === 'modify'}
            onPlanUpdate={handlePlanUpdate}
          />
        )}

        <div className="flex gap-3 pb-2">
          {pageMode === 'pending' && (
            <>
              <button onClick={() => navigate('/create')}
                className="flex-1 py-3.5 rounded-2xl border-2 border-violet-200 text-violet-600 font-bold text-sm hover:bg-violet-50 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                <i className="ri-arrow-left-line" /> Back
              </button>
              <button onClick={handleAccept}
                className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                <i className="ri-check-double-line text-base" /> Accept &amp; Add to Plan
              </button>
            </>
          )}
          {pageMode === 'modify' && (
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
              <i className="ri-check-line text-base" /> Save &amp; Back to Dashboard
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default PlanPage;
