# AI Time Management Web App

## 1. Project Description
一個 Mobile-first 的 AI 時間管理工具，用於 prototype 展示。使用者可以輸入任務、讓 AI 自動拆解計畫、追蹤進度、並獲得回饋。所有資料存於 localStorage，無需後端。

## 2. Page Structure
- `/` → redirect to `/create`
- `/create` - 任務輸入頁（Task Name, Deadline, Priority, Hours, Active Days）
- `/plan` - AI 計畫頁（Subtask Breakdown, Weekly Timeline, Accept/Modify）
- `/dashboard` - 進度管理頁（Today Progress, Task List, Weekly Chart, Reschedule）
- `/feedback` - 回饋頁（Achievement Card, Progress Bar, Reminders）

## 3. Core Features
- [x] Create Page：controlled inputs 全部可操作
- [x] Generate AI Plan：mock subtask 生成 + localStorage 存儲
- [x] Plan Page：顯示 subtasks + Weekly Timeline
- [x] Accept/Modify 按鈕功能
- [x] Dashboard：任務點擊完成 + progress 即時更新
- [x] "I didn't finish today" 重新分配邏輯
- [x] Feedback：根據 progress 顯示不同訊息

## 4. Data Model Design
localStorage keys:
- `demo_plan`: 草稿計畫（Generate 後存入）
- `active_plan`: 正式計畫（Accept 後存入）

active_plan 結構:
```json
{
  "task": "string",
  "deadline": "string",
  "priority": "Low|Medium|High",
  "hoursPerDay": number,
  "activeDays": ["Mon","Tue",...],
  "subtasks": [{ "id": string, "title": string, "day": string, "hours": number, "done": boolean }],
  "completedTasks": ["id",...],
  "progress": number
}
```

## 5. Backend / Third-party Integration Plan
- Supabase: 不需要
- Shopify: 不需要
- Stripe: 不需要
- 全部使用 localStorage

## 6. Development Phase Plan

### Phase 1: 完整 App 一次建立
- Goal: 建立 4 個頁面 + 路由 + 共用元件
- Deliverable: 完整可操作的 prototype
