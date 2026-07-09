import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTasksForContact,
  createTask,
  updateTask,
  deleteTask,
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
} from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-800",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted/60 text-muted-foreground",
};

export function TasksWidget({ contactId }: { contactId: string }) {
  const listFn = useServerFn(listTasksForContact);
  const q = useQuery({
    queryKey: ["tasks", "contact", contactId],
    queryFn: () => listFn({ data: { contact_id: contactId } }),
  });

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const queryClient = useQueryClient();
  const createFn = useServerFn(createTask);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title,
          due_date: dueDate || null,
          related_contact_id: contactId,
          priority,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTitle("");
      setDueDate("");
      setPriority("normal");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    mut.mutate();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title…"
          className="h-8 flex-1 min-w-[180px]"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-[140px]"
        />
        <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={mut.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </form>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">No tasks yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {q.data.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateTask);
  const delFn = useServerFn(deleteTask);
  const toggle = useMutation({
    mutationFn: () =>
      updateFn({
        data: { id: task.id, patch: { status: task.status === "done" ? "open" : "done" } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: task.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const overdue =
    task.due_date && task.status === "open" && new Date(task.due_date) < new Date();
  return (
    <div className="p-2.5 flex items-center gap-2 text-sm">
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={() => toggle.mutate()}
      />
      <span
        className={cn(
          "flex-1 min-w-0 truncate",
          task.status === "done" && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </span>
      {task.due_date && (
        <span
          className={cn(
            "text-[11px] tabular-nums",
            overdue ? "text-red-600 font-medium" : "text-muted-foreground",
          )}
        >
          {task.due_date}
        </span>
      )}
      <span className={cn("text-[10px] rounded px-1.5 py-0.5", PRIORITY_STYLE[task.priority])}>
        {task.priority}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={() => del.mutate()}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
