"use client";

import {
  Ban,
  Home,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { useCompanyNow } from "@/hooks/use-companynow";
import type { Connection, ReportReason } from "@/lib/companynow/types";
import { radiusLabel } from "@/lib/companynow/types";

export function CompanyNowLive() {
  const app = useCompanyNow();

  if (app.bootState === "loading") return <Frame><Busy text="Opening CompanyNow…" /></Frame>;
  if (app.bootState === "auth") return <Auth busy={app.busy} error={app.error} onSignIn={app.signIn} onSignUp={app.signUp} />;
  if (app.bootState === "confirm") return <Frame><Panel title="Confirm your email"><p className="text-sm text-white/60">Open the CompanyNow confirmation email, confirm the account, then return here and sign in.</p><button className="primary mt-5" onClick={() => window.location.reload()}>Return to sign in</button></Panel></Frame>;
  if (app.bootState === "onboarding") return <Onboarding busy={app.busy} error={app.error} onSave={app.saveProfile} />;
  if (app.bootState === "setup" || app.bootState === "error") return <Frame><Alert text={app.error ?? "Backend configuration is unavailable."} /></Frame>;
  if (!app.profile || !app.userId) return <Frame><Busy text="Loading profile…" /></Frame>;

  return (
    <div className="min-h-screen bg-[#06100e] text-white">
      <div className="mx-auto min-h-screen max-w-md border-x border-white/10 bg-[#081613]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><p className="font-bold">CompanyNow</p><p className="text-xs text-white/40">Someone nearby. A moment together.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs ${app.visible ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-white/40"}`}>{app.visible ? "Visible" : "Private"}</span>
        </header>

        <main className="space-y-4 px-4 pb-28 pt-4">
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50">
            <p>{app.notice}</p>
            <button aria-label="Refresh" onClick={() => void Promise.all([app.loadNearby(), app.loadConnections()])}><RefreshCw className="size-4" /></button>
          </div>
          {app.error && <Alert text={app.error} onClose={() => app.setError(null)} />}

          {app.tab === "nearby" && <Nearby app={app} />}
          {app.tab === "requests" && <Requests app={app} />}
          {app.tab === "chat" && <Chat app={app} />}
          {app.tab === "profile" && <Profile app={app} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-4 border-x border-t border-white/10 bg-[#07110f]/95 px-2 pb-3 pt-2 backdrop-blur-xl">
          <NavButton active={app.tab === "nearby"} label="Nearby" onClick={() => app.setTab("nearby")} icon={<Home className="size-5" />} />
          <NavButton active={app.tab === "requests"} label="Requests" count={app.incoming.length} onClick={() => app.setTab("requests")} icon={<UsersRound className="size-5" />} />
          <NavButton active={app.tab === "chat"} label="Chat" count={app.unreadTotal} onClick={() => app.setTab("chat")} icon={<MessageCircle className="size-5" />} />
          <NavButton active={app.tab === "profile"} label="Profile" onClick={() => app.setTab("profile")} icon={<UserRound className="size-5" />} />
        </nav>
      </div>
    </div>
  );
}

function Nearby({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <>
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="font-semibold">Open to Connect</h1><p className="mt-1 text-sm text-white/45">People appear only when both sides are active and inside the mutual radius.</p></div>
        <button disabled={app.busy} onClick={() => void app.toggleVisibility()} className={`grid size-14 place-items-center rounded-full disabled:opacity-50 ${app.visible ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}>{app.busy ? <LoaderCircle className="size-6 animate-spin" /> : <Power className="size-6" />}</button>
      </div>
      <label className="mt-5 block text-sm" htmlFor="radius">Radius: {radiusLabel(app.radius)}</label>
      <input id="radius" className="mt-2 w-full accent-emerald-300" type="range" min="100" max="2000" step="100" value={app.radius} onChange={(event) => app.setRadius(Number(event.target.value))} />
      <label className="mt-4 block text-sm" htmlFor="status">Optional status</label>
      <textarea id="status" rows={2} maxLength={100} value={app.status} onChange={(event) => app.setStatus(event.target.value)} className="field mt-2 resize-none" placeholder="Walking, coffee, metro, gym…" />
    </section>

    <section className="space-y-3">
      <div className="flex justify-between"><h2 className="font-semibold">Nearby now</h2><span className="text-xs text-white/40">{app.nearby.length} active</span></div>
      {!app.visible && <Empty text="Turn on Open to Connect to find other active people." />}
      {app.visible && !app.nearby.length && <Empty text="No active person is inside both selected radii yet." />}
      {app.nearby.map((person) => (
        <article key={person.user_id} className="card p-4">
          <div className="flex items-center gap-3"><Avatar name={person.display_name} /><div className="min-w-0"><p className="truncate font-semibold">{person.display_name}</p><p className="text-xs text-white/40">{person.distance_label} · {person.languages.join(" · ") || "Language not added"}</p></div></div>
          <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-white/70">“{person.status_text || "Open to conversation"}”</p>
          <button disabled={app.busy} onClick={() => void app.sendRequest(person)} className="primary mt-3">Say Hi</button>
        </article>
      ))}
    </section>
  </>;
}

function Requests({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="space-y-5">
    <Group title="Incoming" empty="No incoming requests." items={app.incoming} render={(connection) => (
      <article className="card p-4">
        <Person connection={connection} subtitle="Would like to say hi" />
        <div className="mt-4 grid grid-cols-2 gap-3"><button disabled={app.busy} className="secondary" onClick={() => void app.respond(connection, false)}>Ignore</button><button disabled={app.busy} className="primary" onClick={() => void app.respond(connection, true)}>Accept</button></div>
      </article>
    )} />

    <Group title="Waiting" empty="No outgoing requests." items={app.outgoing} render={(connection) => (
      <article className="card p-4"><Person connection={connection} subtitle="Waiting for response" /><button disabled={app.busy} className="secondary mt-4" onClick={() => void app.cancelRequest(connection)}>Cancel request</button></article>
    )} />

    <Group title="Connected" empty="No accepted connections." items={app.accepted} render={(connection) => (
      <article className="card p-4">
        <div className="flex items-center justify-between gap-3"><Person connection={connection} subtitle={connection.last_message_body ?? "Connected"} />{connection.unread_count > 0 && <Count value={connection.unread_count} />}</div>
        <button className="secondary mt-4" onClick={() => void app.openChat(connection)}>Open chat</button>
      </article>
    )} />
  </section>;
}

function Chat({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  const [showSafety, setShowSafety] = useState(false);
  const [reason, setReason] = useState<ReportReason>("unsafe");
  const [details, setDetails] = useState("");

  if (!app.activeConnection) {
    return <section className="space-y-3"><h2 className="font-semibold">Your conversations</h2>{app.accepted.length ? app.accepted.map((connection) => <article key={connection.id} className="card p-4"><div className="flex items-center justify-between gap-3"><Person connection={connection} subtitle={connection.last_message_body ?? "No messages yet"} />{connection.unread_count > 0 && <Count value={connection.unread_count} />}</div><button className="secondary mt-4" onClick={() => void app.openChat(connection)}>Open chat</button></article>) : <Empty text="Accepted conversations will appear here." />}</section>;
  }

  const connection = app.activeConnection;
  return <section className="card p-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{connection.other.display_name}</h2><p className="text-xs text-white/40">Realtime chat · exact location hidden</p></div><button className="secondary w-auto px-3 py-2 text-sm" onClick={() => void app.disconnect()}>Disconnect</button></div>

    <div className="mt-4 max-h-[48vh] min-h-64 space-y-2 overflow-y-auto pr-1">
      {!app.messages.length && <p className="py-10 text-center text-sm text-white/35">Say hello.</p>}
      {app.messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === app.userId ? "ml-auto bg-emerald-300 text-emerald-950" : "bg-white/10"}`}>{message.body}</div>)}
    </div>

    <div className="mt-4 flex gap-2"><input className="field" value={app.draft} maxLength={1000} onChange={(event) => app.setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) void app.sendMessage(); }} placeholder="Write a message" /><button disabled={!app.draft.trim()} aria-label="Send" onClick={() => void app.sendMessage()} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-300 text-emerald-950 disabled:opacity-40"><Send className="size-5" /></button></div>
    <button className="secondary mt-3" onClick={() => void app.sendMessage("Meet near the main public entrance?")}><MapPin className="mr-2 inline size-4" />Suggest public meeting point</button>
    <button className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-red-200" onClick={() => setShowSafety((current) => !current)}><ShieldAlert className="mr-2 inline size-4" />Safety options</button>

    {showSafety && <div className="mt-3 rounded-2xl border border-red-300/15 bg-red-300/5 p-3">
      <label className="block text-sm" htmlFor="reason">Report reason</label>
      <select id="reason" className="field mt-2" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}><option value="unsafe">Unsafe behaviour</option><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="fake_profile">Fake profile</option><option value="other">Other</option></select>
      <textarea className="field mt-3 resize-none" rows={2} maxLength={1000} placeholder="Optional details" value={details} onChange={(event) => setDetails(event.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-3"><button disabled={app.busy} className="secondary" onClick={() => void app.reportConnection(connection, reason, details).then((ok) => { if (ok) setShowSafety(false); })}>Report</button><button disabled={app.busy} className="rounded-2xl bg-red-300 px-4 py-3 font-bold text-red-950" onClick={() => { if (window.confirm(`Block ${connection.other.display_name}?`)) void app.blockConnection(connection); }}><Ban className="mr-2 inline size-4" />Block</button></div>
    </div>}
  </section>;
}

function Profile({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="space-y-4">
    <div className="card p-5"><Avatar name={app.profile?.display_name ?? "?"} large /><h2 className="mt-3 text-xl font-semibold">{app.profile?.display_name}</h2><p className="text-sm text-white/45">{app.profile?.languages.join(" · ")} · 18+ confirmed</p><p className="mt-5 flex gap-2 text-sm text-white/65"><ShieldCheck className="size-5 text-emerald-300" />Exact coordinates are never shown to another user.</p></div>
    <div className="grid grid-cols-3 gap-3"><Metric label="Nearby" value={app.nearby.length} /><Metric label="Connected" value={app.accepted.length} /><Metric label="Unread" value={app.unreadTotal} /></div>
    <button className="secondary" onClick={() => void app.resetDeviceIdentity()}>Sign out</button>
  </section>;
}

function Auth({ busy, error, onSignUp, onSignIn }: { busy: boolean; error: string | null; onSignUp: (email: string, password: string) => Promise<void>; onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 8;
  return <Frame><Panel title="Connect nearby, safely"><p className="text-sm text-white/50">Create a private account. Your exact location is never shared.</p>{error && <div className="mt-4"><Alert text={error} /></div>}<label className="mt-5 block text-sm" htmlFor="email">Email</label><input id="email" className="field mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /><label className="mt-4 block text-sm" htmlFor="password">Password</label><input id="password" className="field mt-2" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /><button disabled={!valid || busy} className="primary mt-5" onClick={() => void onSignIn(email.trim(), password)}>Sign in</button><button disabled={!valid || busy} className="secondary mt-3" onClick={() => void onSignUp(email.trim(), password)}>Create account</button></Panel></Frame>;
}

function Onboarding({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: (name: string, languages: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState("Telugu, English");
  const [adult, setAdult] = useState(false);
  return <Frame><Panel title="Create your nearby profile">{error && <Alert text={error} />}<label className="mt-5 block text-sm" htmlFor="name">First name</label><input id="name" className="field mt-2" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /><label className="mt-4 block text-sm" htmlFor="languages">Languages</label><input id="languages" className="field mt-2" value={languages} onChange={(event) => setLanguages(event.target.value)} /><label className="mt-5 flex gap-3 text-sm text-white/70"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />I confirm I am at least 18.</label><button disabled={busy || !adult || name.trim().length < 2} className="primary mt-5" onClick={() => void onSave(name, languages)}>Enter CompanyNow</button></Panel></Frame>;
}

function NavButton({ active, label, count = 0, onClick, icon }: { active: boolean; label: string; count?: number; onClick: () => void; icon: React.ReactNode }) { return <button onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-xl py-2 text-xs ${active ? "text-emerald-200" : "text-white/35"}`}>{icon}{label}{count > 0 && <span className="absolute right-4 top-0 rounded-full bg-emerald-300 px-1.5 text-[10px] font-bold text-emerald-950">{count > 99 ? "99+" : count}</span>}</button>; }
function Frame({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#06100e] px-4 py-8 text-white"><div className="mx-auto max-w-md"><header className="mb-6"><p className="text-2xl font-bold">CompanyNow</p><p className="text-sm text-white/40">Someone nearby. A moment together.</p></header>{children}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="card p-5"><h1 className="text-2xl font-bold">{title}</h1>{children}</section>; }
function Busy({ text }: { text: string }) { return <div className="flex justify-center gap-3 py-20 text-white/60"><LoaderCircle className="size-5 animate-spin" />{text}</div>; }
function Alert({ text, onClose }: { text: string; onClose?: () => void }) { return <div className="flex justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><p>{text}</p>{onClose && <button aria-label="Close" onClick={onClose}><X className="size-4" /></button>}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed border-white/10 p-7 text-center text-sm text-white/40">{text}</div>; }
function Avatar({ name, large = false }: { name: string; large?: boolean }) { return <div className={`grid shrink-0 place-items-center bg-emerald-300/15 font-bold text-emerald-200 ${large ? "size-16 rounded-3xl text-xl" : "size-12 rounded-2xl"}`}>{name.charAt(0).toUpperCase()}</div>; }
function Person({ connection, subtitle }: { connection: Connection; subtitle: string }) { return <div className="flex min-w-0 items-center gap-3"><Avatar name={connection.other.display_name} /><div className="min-w-0"><p className="truncate font-semibold">{connection.other.display_name}</p><p className="truncate text-xs text-white/40">{subtitle}</p></div></div>; }
function Group({ title, empty, items, render }: { title: string; empty: string; items: Connection[]; render: (connection: Connection) => React.ReactNode }) { return <div className="space-y-3"><h2 className="font-semibold">{title}</h2>{items.length ? items.map((connection) => <div key={connection.id}>{render(connection)}</div>) : <Empty text={empty} />}</div>; }
function Count({ value }: { value: number }) { return <span className="rounded-full bg-emerald-300 px-2 py-1 text-xs font-bold text-emerald-950">{value > 99 ? "99+" : value}</span>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="card p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="text-xs text-white/40">{label}</p></div>; }
