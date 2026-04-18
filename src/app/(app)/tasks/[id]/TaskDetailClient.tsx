"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { 
  Calendar, 
  User, 
  Tag, 
  MessageSquare, 
  History, 
  Paperclip, 
  CheckCircle2, 
  Circle,
  Send,
  Trash2
} from "lucide-react";
import { updateTask, addTaskComment } from "../actions";
import Link from "next/link";

export default function TaskDetailClient({ 
  task, 
  initialComments, 
  activities,
  attachments 
}: any) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleStatusToggle() {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    startTransition(async () => {
      await updateTask(task.id, { status: newStatus });
    });
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const result = await addTaskComment(task.id, newComment.trim());
    if (result.data) {
      setComments([...comments, result.data]);
      setNewComment("");
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    task.priority === "urgent" ? "bg-red-100 text-red-700" :
                    task.priority === "high" ? "bg-red-50 text-red-600" :
                    task.priority === "medium" || task.priority === "normal" ? "bg-amber-50 text-amber-600" :
                    "bg-emerald-50 text-emerald-600"
                  }`}>
                    {task.priority} Priority
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-xs text-stone-500 font-medium">#{task.id.slice(0,8)}</span>
                </div>
                <h1 className="text-2xl font-bold text-stone-900">{task.title}</h1>
              </div>
              <button 
                onClick={handleStatusToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  task.status === "completed" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-amber-700 text-white shadow-sm"
                }`}
              >
                {task.status === "completed" ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                {task.status === "completed" ? "Completed" : "Mark Complete"}
              </button>
            </div>

            <div className="text-stone-600 leading-relaxed whitespace-pre-wrap">
              {task.description || "No description provided."}
            </div>

            <div className="flex flex-wrap gap-6 pt-4 border-t border-stone-100">
               <div className="flex items-center gap-2">
                 <User size={18} className="text-stone-400" />
                 <div>
                   <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Assignee</p>
                   <p className="text-sm font-medium text-stone-900">{task.assignee?.full_name || "Unassigned"}</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <Calendar size={18} className="text-stone-400" />
                 <div>
                   <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Due Date</p>
                   <p className="text-sm font-medium text-stone-900">{task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : "No deadline"}</p>
                 </div>
               </div>
               {task.linked_type && (
                 <div className="flex items-center gap-2">
                   <Tag size={18} className="text-stone-400" />
                   <div>
                     <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Linked {task.linked_type}</p>
                     <Link href={`/${task.linked_type}s/${task.linked_id}`} className="text-sm font-medium text-amber-700 hover:underline uppercase tracking-tight">View Record</Link>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-stone-900 px-2">
            <MessageSquare size={20} className="text-amber-700" />
            <h2 className="font-bold">Discussion</h2>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-6 shadow-sm">
            <div className="space-y-6">
              {comments.length === 0 ? (
                <p className="text-sm text-stone-400 italic text-center py-4">No comments yet. Start the conversation.</p>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-stone-900">{comment.user_id?.slice(0,8)}</span>
                        <span className="text-[10px] text-stone-400">{format(new Date(comment.created_at), "dd MMM, HH:mm")}</span>
                      </div>
                      <div className="text-sm text-stone-700 bg-stone-50 p-3 rounded-xl">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 pt-4 border-t border-stone-100">
              <input 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Type a comment..."
                className="flex-1 bg-stone-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-amber-600"
              />
              <button className="p-2 bg-amber-700 text-white rounded-xl hover:bg-amber-800 transition-colors">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Sidebar: Activity & Attachments */}
      <div className="space-y-8">
        {/* Activity Timeline */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center gap-2">
            <History size={18} className="text-amber-700" />
            <h3 className="font-bold text-sm text-stone-900">Activity Timeline</h3>
          </div>
          <div className="p-5">
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-2.5 before:h-full before:w-0.5 before:bg-stone-100">
              {activities.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No activity recorded yet.</p>
              ) : (
                activities.map((act: any) => (
                  <div key={act.id} className="relative flex items-start gap-4 ml-1">
                    <div className="mt-1.5 w-3 h-3 rounded-full bg-white border-2 border-amber-600 z-10" />
                    <div className="flex-1">
                      <p className="text-xs text-stone-700 leading-snug">
                        <span className="font-bold text-stone-900">{act.activity_type.replace(/_/g, " ")}</span>: {act.description}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5 font-medium">{format(new Date(act.created_at), "dd MMM, HH:mm")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip size={18} className="text-amber-700" />
              <h3 className="font-bold text-sm text-stone-900">Attachments</h3>
            </div>
            <button className="text-[10px] font-bold text-amber-700 uppercase tracking-widest hover:underline">+ Upload</button>
          </div>
          <div className="p-5 space-y-3">
            {attachments.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No files attached.</p>
            ) : (
              attachments.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-white rounded border border-stone-200 text-stone-400"><Paperclip size={12} /></div>
                    <span className="text-xs font-medium text-stone-700 truncate">{file.file_name}</span>
                  </div>
                  <button className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
