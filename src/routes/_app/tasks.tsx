import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTasks,
  createTask,
  updateTask,
  deleteTask,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskPriority,
  type TaskWithContact,
} from "@/lib/tasks.functions";
import { listContacts } from "@/lib/contacts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/tasks")({
  ssr: false,
  head: () => ({ meta: [{ title: "My Tasks — InsureFlow" }] }),
  component: TasksPage,
});

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-800",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted/60 text-muted-foreground",
};

function TasksPage() {
  const [filter, setFilter] = useState<TaskStatus | "all">("open");
  const [addOpen, setAddOpen] = useState(false);
  const listFn = useServerFn(listMyTasks);
  const q = useQuery({
    queryKey: ["tasks", "mine", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">My Tasks</h1>
          <p className="text-xs text-muted-foreground">
            {q.data?.length ?? 0} {q.data?.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add task
        </Button>
      </header>

      <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus | "all")}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>
        ) : !q.data?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="font-semibold">No tasks</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first task to keep track of follow-ups.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function TaskRow({ task }: { task: TaskWithContact }) {
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
    <TableRow>
      <TableCell>
        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={() => toggle.mutate()}
        />
      </TableCell>
      <TableCell
        className={cn(
          "font-medium",
          task.status === "done" && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </TableCell>
      <TableCell>
        {task.contact ? (
          <Link
            to="/contacts"
            className="text-primary hover:underline"
          >
            {task.contact.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn("tabular-nums", overdue && "text-red-600 font-medium")}>
        {task.due_date ?? "—"}
      </TableCell>
      <TableCell>
        <span className={cn("text-[11px] rounded px-1.5 py-0.5", PRIORITY_STYLE[task.priority])}>
          {task.priority}
        </span>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => del.mutate()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createTask);
  const contactsFn = useServerFn(listContacts);
  const contactsQ = useQuery({
    queryKey: ["contacts", "picker"],
    queryFn: () => contactsFn({ data: {} }),
    enabled: open,
  });
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [contactId, setContactId] = useState<string>("");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title,
          due_date: dueDate || null,
          related_contact_id: contactId || null,
          priority,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task added");
      onOpenChange(false);
      setTitle("");
      setDueDate("");
      setPriority("normal");
      setContactId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    mut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title*</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Related contact</Label>
            <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">None</SelectItem>
                {(contactsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Adding…" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
