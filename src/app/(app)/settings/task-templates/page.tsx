"use client";

import { useState } from "react";
import Link from "next/link";

const PRESET_TEMPLATES = [
  {
    name: "Ring Resize",
    tasks: ["Measure ring size", "Resize band", "Polish & clean", "Quality check", "Notify customer"],
  },
  {
    name: "Chain Repair",
    tasks: ["Assess damage", "Solder link", "Polish & clean", "Clasp check", "Quality check", "Notify customer"],
  },
  {
    name: "Stone Reset",
    tasks: ["Remove old setting", "Source/check stone", "Set stone", "Polish mount", "Quality check", "Notify customer"],
  },
  {
    name: "Custom Bespoke",
    tasks: ["Initial consultation", "Design sketch", "CAD/wax model", "Client approval", "Cast metal", "Set stones", "Polish & finish", "Quality check", "Photo & document", "Notify customer"],
  },
];

type Template = { id: string; name: string; tasks: string[] };

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(
    PRESET_TEMPLATES.map((t, i) => ({ id: String(i + 1), ...t }))
  );
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTasks, setNewTasks] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function createTemplate() {
    if (!newName.trim()) return;
    const tasks = newTasks.split("\n").map((t) => t.trim()).filter(Boolean);
    const tmpl: Template = { id: Date.now().toString(), name: newName.trim(), tasks };
    setTemplates((prev) => [...prev, tmpl]);
    setNewName("");
    setNewTasks("");
    setShowNew(false);
    setMsg("Template created.");
    setTimeout(() => setMsg(null), 2000);
  }

  function startEdit(t: Template) {
    setEditId(t.id);
    setEditName(t.name);
    setEditTasks(t.tasks.join("\n"));
  }

  function saveEdit() {
    const tasks = editTasks.split("\n").map((t) => t.trim()).filter(Boolean);
    setTemplates((prev) => prev.map((t) => t.id === editId ? { ...t, name: editName, tasks } : t));
    setEditId(null);
    setMsg("Template saved.");
    setTimeout(() => setMsg(null), 2000);
  }

  function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Task Templates</h1>
          <p className="text-sm text-stone-500 mt-0.5">Preset task lists for common workshop jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/workshop/calendar" className="text-sm text-stone-500 hover:text-stone-900 border border-stone-200 px-3 py-1.5 rounded-lg">
            Workshop Calendar
          </Link>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347]"
          >
            + New Template
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{msg}</div>}

      {/* New template form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-[#8B7355]/30 p-5 space-y-4">
          <h3 className="font-semibold text-stone-900">New Template</h3>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Template Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ring Resize"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#8B7355]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Tasks (one per line)</label>
            <textarea
              value={newTasks}
              onChange={(e) => setNewTasks(e.target.value)}
              rows={5}
              placeholder={"Measure\nResize\nPolish\nQuality check\nNotify customer"}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#8B7355] resize-none font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={createTemplate} className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347]">
              Create
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-5">
            {editId === t.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-lg focus:outline-none focus:border-[#8B7355]"
                />
                <textarea
                  value={editTasks}
                  onChange={(e) => setEditTasks(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#8B7355] resize-none font-mono"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-3 py-1.5 bg-[#8B7355] text-white text-sm rounded-lg hover:bg-[#7A6347]">Save</button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-stone-900 mb-2">{t.name}</h3>
                  <ol className="space-y-1">
                    {t.tasks.map((task, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-stone-600">
                        <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-xs flex items-center justify-center font-medium flex-shrink-0">{i + 1}</span>
                        {task}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(t)} className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50">Edit</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-100 hover:bg-red-50">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
