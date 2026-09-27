"use client";

import { useState } from "react";
import { useApp } from "./AppContext";
import { Button, TextField } from "./ui";

export default function ScenarioPanel() {
  const { state, update, saved, saveAs, saveActive, loadScenario, renameScenario, duplicateScenario, deleteScenario, resetAll } =
    useApp();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const active = saved.find((s) => s.id === state.activeScenarioId);

  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">Scenario:</span>
          <span className="font-semibold">{state.activeScenarioName}</span>
          {active && <span className="text-xs text-stone-400">saved {new Date(active.savedAt).toLocaleString()}</span>}
          {!active && <span className="text-xs text-stone-400">(unsaved - changes are kept in this browser)</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {active && (
            <Button variant="primary" onClick={saveActive}>
              Save Scenario
            </Button>
          )}
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : `Scenarios & Notes (${saved.length})`}</Button>
        </div>
      </div>
      {!open && state.notes && (
        <div className="border-t border-stone-100 px-4 py-2 text-sm whitespace-pre-wrap text-stone-600">
          <span className="font-medium text-stone-500">Notes: </span>
          {state.notes}
        </div>
      )}
      {open && (
        <div className="grid gap-5 border-t border-stone-100 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Save current setup as a new scenario</div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                saveAs(newName.trim());
                setNewName("");
              }}
            >
              <TextField value={newName} onChange={setNewName} placeholder='e.g. "Monday Compromise"' className="flex-1" ariaLabel="New scenario name" />
              <Button type="submit" variant="primary" disabled={!newName.trim()}>
                Save Scenario
              </Button>
            </form>
            <div className="text-sm font-semibold">Saved scenarios</div>
            {saved.length === 0 && <p className="text-sm text-stone-500">No saved scenarios yet.</p>}
            <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
              {saved.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {renaming?.id === s.id ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renaming.name.trim()) renameScenario(s.id, renaming.name.trim());
                        setRenaming(null);
                      }}
                    >
                      <TextField value={renaming.name} onChange={(v) => setRenaming({ id: s.id, name: v })} className="flex-1" ariaLabel="Scenario name" />
                      <Button type="submit">OK</Button>
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {s.name} {s.id === state.activeScenarioId && <span className="text-xs text-stone-400">(open)</span>}
                      </div>
                      {s.notes && <div className="truncate text-xs text-stone-500">{s.notes}</div>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => loadScenario(s.id)}>
                      Open
                    </Button>
                    <Button variant="ghost" onClick={() => setRenaming({ id: s.id, name: s.name })}>
                      Rename
                    </Button>
                    <Button variant="ghost" onClick={() => duplicateScenario(s.id)}>
                      Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete scenario "${s.name}"?`)) deleteScenario(s.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm("Reset the working scenario and all plan edits to the original defaults? Saved scenarios are kept.")) resetAll();
              }}
            >
              Reset working scenario to defaults
            </Button>
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="scenario-notes">
              Notes for this scenario
            </label>
            <textarea
              id="scenario-notes"
              value={state.notes}
              onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
              rows={9}
              placeholder={'"Adam likes team aspect."\n"Mike wants stronger incentive above $70k."\n"Concern: $45k employee earns less than current plan."'}
              className="mt-2 w-full rounded-md border border-stone-300 p-3 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
            />
            <p className="mt-1 text-xs text-stone-500">Notes are stored with the scenario when you save it.</p>
          </div>
        </div>
      )}
    </section>
  );
}
