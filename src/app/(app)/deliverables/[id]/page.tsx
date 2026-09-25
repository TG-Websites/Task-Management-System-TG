"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { UserPlus } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AssetsPanel } from "@/components/AssetsPanel";
import type { AssignableUser, Comment, Deliverable } from "@/lib/types";

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-navy-50 text-navy-500",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

export default function DeliverableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [people, setPeople] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"internal" | "client_visible">(
    user?.role === "client" ? "client_visible" : "internal",
  );
  const [addAssigneeId, setAddAssigneeId] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [dRes, cRes, pRes] = await Promise.all([
        apiGet<{ deliverable: Deliverable }>(`/deliverables/${id}`),
        apiGet<{ comments: Comment[] }>(`/deliverables/${id}/comments`),
        apiGet<{ users: AssignableUser[] }>("/users/assignable").catch(() => ({ users: [] })),
      ]);
      setDeliverable(dRes.deliverable);
      setComments(cRes.comments);
      setPeople(pRes.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this deliverable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!newChecklistLabel.trim()) return;
    await apiPost(`/deliverables/${id}/checklist-items`, { label: newChecklistLabel });
    setNewChecklistLabel("");
    load();
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    await apiPatch(`/deliverables/checklist-items/${itemId}`, { done });
    load();
  }

  async function postComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await apiPost(`/deliverables/${id}/comments`, { body: newComment, visibility: commentVisibility });
      setNewComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post that comment.");
    }
  }

  async function addAssignee(e: FormEvent) {
    e.preventDefault();
    if (!addAssigneeId) return;
    setAssigning(true);
    setError(null);
    try {
      await apiPost(`/deliverables/${id}/assignees`, { userId: addAssigneeId });
      setAddAssigneeId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign this person.");
    } finally {
      setAssigning(false);
    }
  }

  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "team_member" || user?.role === "freelancer";
  const canAssign = user?.role === "admin" || user?.role === "manager" || user?.role === "team_member";

  if (loading) return <p className="text-sm text-navy-300">Loading...</p>;
  if (error && !deliverable) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!deliverable) return null;

  const assignedIds = new Set(deliverable.assignees.map((a) => a.user.id));
  const availablePeople = people.filter((p) => !assignedIds.has(p.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card p-5">
        <h1 className="text-lg font-semibold text-navy-900">{deliverable.title}</h1>
        {deliverable.contentItem && <p className="text-sm text-navy-400">Part of: {deliverable.contentItem.title}</p>}
        {deliverable.description && <p className="mt-2 text-sm text-navy-600">{deliverable.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="badge bg-navy-50 text-navy-600">{deliverable.stage?.label}</span>
          <span className={`badge ${PRIORITY_STYLE[deliverable.priority]}`}>{deliverable.priority}</span>
          {deliverable.dueDate && <span className="badge bg-navy-50 text-navy-600">Due {new Date(deliverable.dueDate).toLocaleDateString()}</span>}
        </div>

        {/* Assignees */}
        <div className="mt-4 border-t border-navy-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Assigned to</p>
          {deliverable.assignees.length === 0 ? (
            <p className="mt-1 text-sm text-navy-400">Nobody yet</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {deliverable.assignees.map((a) => (
                <span
                  key={a.user.id}
                  className="flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-200 text-[9px] font-semibold text-navy-700">
                    {a.user.name[0]?.toUpperCase()}
                  </span>
                  {a.user.name}
                </span>
              ))}
            </div>
          )}

          {canAssign && (
            <form onSubmit={addAssignee} className="mt-3 flex items-center gap-2">
              <select
                value={addAssigneeId}
                onChange={(e) => setAddAssigneeId(e.target.value)}
                className="input flex-1"
              >
                <option value="">
                  {availablePeople.length === 0 ? "No one else available" : "Add someone..."}
                </option>
                {availablePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!addAssigneeId || assigning}
                className="btn-secondary flex shrink-0 items-center gap-1.5"
              >
                <UserPlus size={14} />
                {assigning ? "Adding..." : "Add"}
              </button>
            </form>
          )}
        </div>
      </div>

      <AssetsPanel deliverableId={id} />

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-navy-900">Checklist</h2>
        <ul className="mt-2 space-y-1.5">
          {(deliverable.checklistItems ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!canEdit}
                onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                className="h-4 w-4 rounded border-navy-200 text-orange focus:ring-orange"
              />
              <span className={item.done ? "text-navy-300 line-through" : "text-navy-700"}>{item.label}</span>
            </li>
          ))}
          {(deliverable.checklistItems ?? []).length === 0 && <p className="text-sm text-navy-300">No checklist items yet.</p>}
        </ul>
        {canEdit && (
          <form onSubmit={addChecklistItem} className="mt-3 flex gap-2">
            <input
              value={newChecklistLabel}
              onChange={(e) => setNewChecklistLabel(e.target.value)}
              placeholder="Add a checklist item"
              className="input flex-1"
            />
            <button type="submit" className="btn-secondary">
              Add
            </button>
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-navy-900">Comments</h2>
        <p className="text-xs text-navy-300">
          {user?.role === "client" ? "Only comments meant for clients appear here." : "Internal notes are never shown to clients."}
        </p>
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-navy-800">{c.author.name}</span>
                {c.visibility === "internal" && <span className="badge bg-navy-50 text-navy-500">Internal</span>}
                <span className="text-xs text-navy-300">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-0.5 text-navy-600">{c.body}</p>
            </li>
          ))}
          {comments.length === 0 && <p className="text-sm text-navy-300">No comments yet.</p>}
        </ul>

        <form onSubmit={postComment} className="mt-4 space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="input"
          />
          <div className="flex items-center justify-between">
            {user?.role !== "client" ? (
              <select
                value={commentVisibility}
                onChange={(e) => setCommentVisibility(e.target.value as "internal" | "client_visible")}
                className="rounded-lg border border-navy-100 px-2 py-1 text-xs text-navy-600"
              >
                <option value="internal">Internal only</option>
                <option value="client_visible">Visible to client</option>
              </select>
            ) : (
              <span className="text-xs text-navy-300">Visible to your account team</span>
            )}
            <button type="submit" className="btn-accent">
              Post
            </button>
          </div>
        </form>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>
    </div>
  );
}