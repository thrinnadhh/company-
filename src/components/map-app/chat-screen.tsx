"use client";

import { Ban, MapPin, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Count, Empty, Person } from "@/components/map-app/shared-ui";
import type { useCompanyNow } from "@/hooks/use-companynow";
import type { ReportReason } from "@/lib/companynow/types";

export function ChatScreen({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  const [showSafety, setShowSafety] = useState(false);
  const [reason, setReason] = useState<ReportReason>("unsafe");
  const [details, setDetails] = useState("");

  if (!app.activeConnection) {
    return <section className="space-y-3"><h2 className="font-semibold">Your conversations</h2>{app.accepted.length ? app.accepted.map((connection) => <article key={connection.id} className="card p-4"><div className="flex items-center justify-between gap-3"><Person connection={connection} subtitle={connection.last_message_body ?? "No messages yet"} />{connection.unread_count > 0 && <Count value={connection.unread_count} />}</div><button className="secondary mt-4" onClick={() => void app.openChat(connection)}>Open chat</button></article>) : <Empty text="Accepted conversations will appear here." />}</section>;
  }

  const connection = app.activeConnection;
  return <section className="card p-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{connection.other.display_name}</h2><p className="text-xs text-white/40">Realtime chat · exact location hidden</p></div><button className="secondary w-auto px-3 py-2 text-sm" onClick={() => void app.disconnect()}>Disconnect</button></div>
    <div className="mt-4 max-h-[48vh] min-h-64 space-y-2 overflow-y-auto pr-1">{!app.messages.length && <p className="py-10 text-center text-sm text-white/35">Say hello.</p>}{app.messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === app.userId ? "ml-auto bg-emerald-300 text-emerald-950" : "bg-white/10"}`}>{message.body}</div>)}</div>
    <div className="mt-4 flex gap-2"><input className="field" value={app.draft} maxLength={1000} onChange={(event) => app.setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) void app.sendMessage(); }} placeholder="Write a message" /><button disabled={!app.draft.trim()} aria-label="Send" onClick={() => void app.sendMessage()} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-300 text-emerald-950 disabled:opacity-40"><Send className="size-5" /></button></div>
    <button className="secondary mt-3" onClick={() => void app.sendMessage("Meet near the main public entrance?")}><MapPin className="mr-2 inline size-4" />Suggest public meeting point</button>
    <button className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-red-200" onClick={() => setShowSafety((current) => !current)}><ShieldAlert className="mr-2 inline size-4" />Safety options</button>
    {showSafety && <div className="mt-3 rounded-2xl border border-red-300/15 bg-red-300/5 p-3"><label className="block text-sm" htmlFor="reason">Report reason</label><select id="reason" className="field mt-2" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}><option value="unsafe">Unsafe behaviour</option><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="fake_profile">Fake profile</option><option value="other">Other</option></select><textarea className="field mt-3 resize-none" rows={2} maxLength={1000} placeholder="Optional details" value={details} onChange={(event) => setDetails(event.target.value)} /><div className="mt-3 grid grid-cols-2 gap-3"><button disabled={app.busy} className="secondary" onClick={() => void app.reportConnection(connection, reason, details).then((ok) => { if (ok) setShowSafety(false); })}>Report</button><button disabled={app.busy} className="rounded-2xl bg-red-300 px-4 py-3 font-bold text-red-950" onClick={() => { if (window.confirm(`Block ${connection.other.display_name}?`)) void app.blockConnection(connection); }}><Ban className="mr-2 inline size-4" />Block</button></div></div>}
  </section>;
}
