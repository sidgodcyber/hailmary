"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaskStatus } from "@/app/app/tasks/actions";
import { Badge } from "@/components/ui";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/config";
import { formatDate } from "@/lib/format";

export type Task = {
  id: string;
  title: string;
  details: string;
  assigned_to: "admin" | "client";
  due_date: string | null;
  status: TaskStatus;
};

const NEXT: Record<TaskStatus, TaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

export function TaskItem({ task }: { task: Task }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const done = task.status === "done";

  function cycle() {
    start(async () => {
      await setTaskStatus(task.id, NEXT[task.status]);
      router.refresh();
    });
  }

  return (
    <div className={`card p-4 flex items-start gap-3 ${pending ? "opacity-60" : ""}`}>
      <button
        onClick={cycle}
        disabled={pending}
        aria-label={done ? "Mark as open" : "Advance status"}
        className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-brand-400 text-transparent hover:bg-brand-50"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium leading-snug ${done ? "line-through text-ink-muted" : ""}`}>{task.title}</p>
        {task.details && <p className="mt-0.5 text-sm text-ink-muted whitespace-pre-wrap">{task.details}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={task.status}>{TASK_STATUS_LABELS[task.status]}</Badge>
          <Badge tone="neutral">{task.assigned_to === "admin" ? "Studio" : "Client"}</Badge>
          {task.due_date && (
            <span className="text-xs text-ink-muted">Due {formatDate(task.due_date)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
