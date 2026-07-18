"use client";

import { LoaderCircle, MapPin, Power, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, Empty } from "@/components/map-app/shared-ui";
import { NearbyMap } from "@/components/nearby-map";
import type { useCompanyNow } from "@/hooks/use-companynow";
import { radiusLabel } from "@/lib/companynow/types";

export function NearbyScreen({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedPerson = useMemo(
    () => app.nearby.find((person) => person.user_id === selectedUserId) ?? app.nearby[0] ?? null,
    [app.nearby, selectedUserId],
  );

  return <>
    <section className="overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.16),transparent_45%)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Nearby mode</p><h1 className="mt-2 text-2xl font-bold">Open to Connect</h1><p className="mt-2 max-w-xs text-sm text-white/50">Switch on to appear on nearby maps and discover people who are also active.</p></div>
        <button aria-label={app.visible ? "Turn visibility off" : "Turn visibility on"} disabled={app.busy} onClick={() => void app.toggleVisibility()} className={`relative h-14 w-24 rounded-full p-1 transition disabled:opacity-50 ${app.visible ? "bg-emerald-300" : "bg-white/10"}`}><span className={`grid size-12 place-items-center rounded-full transition ${app.visible ? "translate-x-10 bg-emerald-950 text-emerald-200" : "translate-x-0 bg-white/10 text-white/50"}`}>{app.busy ? <LoaderCircle className="size-5 animate-spin" /> : <Power className="size-5" />}</span></button>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4"><div><label className="block text-sm font-medium" htmlFor="radius">Discovery radius</label><input id="radius" className="mt-2 w-full accent-emerald-300" type="range" min="100" max="2000" step="100" value={app.radius} onChange={(event) => app.setRadius(Number(event.target.value))} /></div><span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-emerald-100">{radiusLabel(app.radius)}</span></div>
      <label className="mt-4 block text-sm font-medium" htmlFor="status">What are you open to?</label>
      <textarea id="status" rows={2} maxLength={100} value={app.status} onChange={(event) => app.setStatus(event.target.value)} className="field mt-2 resize-none" placeholder="Walking, coffee, metro, gym…" />
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/60">Live map</p><h2 className="mt-1 text-lg font-semibold">People open nearby</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">{app.nearby.length} active</span></div>
      <NearbyMap active={app.visible} people={app.nearby} radius={app.radius} selectedUserId={selectedPerson?.user_id ?? null} onSelect={(person) => setSelectedUserId(person.user_id)} />
      <p className="flex items-start gap-2 px-1 text-xs text-white/40"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />Icons show privacy-safe approximate positions, never another person’s exact GPS coordinates.</p>
    </section>

    {selectedPerson && <section className="rounded-[2rem] border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
      <div className="flex items-center gap-3"><Avatar name={selectedPerson.display_name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{selectedPerson.display_name}</p><p className="text-xs text-white/45">{selectedPerson.distance_label} · {selectedPerson.languages.join(" · ") || "Language not added"}</p></div><span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[11px] font-semibold text-emerald-200">Open now</span></div>
      <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-white/70">“{selectedPerson.status_text || "Open to conversation"}”</p>
      <button disabled={app.busy} onClick={() => void app.sendRequest(selectedPerson)} className="primary mt-3">Say Hi to {selectedPerson.display_name}</button>
    </section>}

    <section className="space-y-3">
      <div className="flex justify-between"><h2 className="font-semibold">All nearby people</h2><span className="text-xs text-white/40">Tap to highlight on map</span></div>
      {!app.visible && <Empty text="Turn on Open to Connect to activate the map." />}
      {app.visible && !app.nearby.length && <Empty text="No active person is inside both selected radii yet." />}
      {app.nearby.map((person) => <button key={person.user_id} onClick={() => setSelectedUserId(person.user_id)} className={`w-full rounded-3xl border p-4 text-left transition ${selectedPerson?.user_id === person.user_id ? "border-emerald-300/40 bg-emerald-300/[0.08]" : "border-white/10 bg-white/[0.03]"}`}><div className="flex items-center gap-3"><Avatar name={person.display_name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{person.display_name}</p><p className="truncate text-xs text-white/40">{person.distance_label} · {person.status_text || "Open to conversation"}</p></div><MapPin className="size-5 text-emerald-200" /></div></button>)}
    </section>
  </>;
}
