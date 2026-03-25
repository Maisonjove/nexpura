"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  type TaskTemplate
} from "./actions";
import logger from "@/lib/logger";

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const result = await getTaskTemplates();
      if (result.error) {
        toast.error(result.error);
      } else {
        setTemplates(result.data ?? []);
      }
    } catch (err) {
      logger.error(err);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate() {
    if (!newTitle.trim()) return;
    
    try {
      const result = await createTaskTemplate({
        title: newTitle,
        description: newDescription,
        department: newDepartment || null,
        priority: newPriority,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setTemplates((prev) => [result.data!, ...prev]);
      }
      setNewTitle("");
      setNewDescription("");
      setNewDepartment("");
      setShowNew(false);
      setMsg("Template created.");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      logger.error(err);
      toast.error("Failed to create template");
    }
  }

  function startEdit(t: TaskTemplate) {
    setEditId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description || "");
    setEditDepartment(t.department || "");
    setEditPriority(t.priority);
  }

  async function saveEdit() {
    if (!editTitle.trim() || !editId) return;

    try {
      const result = await updateTaskTemplate(editId, {
        title: editTitle,
        description: editDescription,
        department: editDepartment || null,
        priority: editPriority,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setTemplates((prev) => prev.map((t) => t.id === editId ? { 
        ...t, 
        title: editTitle, 
        description: editDescription,
        department: editDepartment || null,
        priority: editPriority 
      } : t));
      setEditId(null);
      setMsg("Template saved.");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      logger.error(err);
      toast.error("Failed to save template");
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    
    try {
      const result = await deleteTaskTemplate(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      logger.error(err);
      toast.error("Failed to delete template");
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Task Templates</h1>
          <p className="text-sm text-stone-500 mt-0.5">Reusable task templates for fast assignment</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800"
          >
            + New Template
          </button>
        </div>
      </div>

      {msg && <div className="bg-amber-700/10 border border-amber-600/20 text-amber-700 text-sm rounded-lg px-4 py-3">{msg}</div>}

      {/* New template form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-amber-600/30 p-5 space-y-4 shadow-sm">
          <h3 className="font-semibold text-stone-900">New Template</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1 uppercase tracking-wider">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Ring Polishing"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1 uppercase tracking-wider">Department</label>
              <select
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
              >
                <option value="">None</option>
                <option value="Workshop">Workshop</option>
                <option value="Retail">Retail</option>
                <option value="Sales">Sales</option>
                <option value="Admin">Admin</option>
                <option value="Design">Design</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1 uppercase tracking-wider">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1 uppercase tracking-wider">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder={"Detailed instructions..."}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateTemplate} className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800">
              Create Template
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-stone-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-stone-200 text-stone-400">
            No templates yet. Create your first one to speed up task assignment.
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-5 hover:border-amber-600/30 transition-colors">
              {editId === t.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600"
                      />
                    </div>
                    <div>
                      <select
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                      >
                        <option value="">No Department</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Retail">Retail</option>
                        <option value="Sales">Sales</option>
                        <option value="Admin">Admin</option>
                        <option value="Design">Design</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 bg-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800">Save Changes</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-stone-900">{t.title}</h3>
                      {t.department && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-medium">{t.department}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                        t.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                        t.priority === 'high' ? 'bg-amber-50 text-amber-600' :
                        'bg-stone-50 text-stone-500'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    {t.description && <p className="text-sm text-stone-500 line-clamp-2">{t.description}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(t)} className="text-xs text-stone-400 hover:text-stone-900 px-2 py-1 rounded border border-stone-100 hover:bg-stone-50">Edit</button>
                    <button onClick={() => handleDeleteTemplate(t.id)} className="text-xs text-stone-300 hover:text-red-500 px-2 py-1">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
