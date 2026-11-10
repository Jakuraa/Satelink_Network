import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorNote, PageHeader } from "@/components/ui";
import { TaskLive } from "@/components/preview/TaskLive";
import { requirePreview, taskApi, type Task } from "@/lib/preview";

export const metadata: Metadata = { title: "Task · Satelink" };
export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  requirePreview();
  const { id } = await params;
  if (!/^run_[0-9a-f]{8,64}$/.test(id)) notFound();
  const r = await taskApi<{ task: Task }>(`/tasks/${id}`);
  if (!r.ok && r.status === 404) notFound();
  return (
    <>
      <PageHeader title="Task" lede={r.ok ? r.data.task.intent : undefined} />
      {r.ok ? <TaskLive initial={r.data.task} /> : <ErrorNote what="this task" />}
    </>
  );
}
