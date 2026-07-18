"use client";

import { Home, LoaderCircle, MapPin, MessageCircle, Power, RefreshCw, Send, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";

import { useCompanyNow } from "@/hooks/use-companynow";
import type { Connection } from "@/lib/companynow/types";
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
            <button aria-label="Refresh" onClick={() => void (app.visible ? app.loadNearby() : app.loadConnections())}><RefreshCw className="size-4" /></button>
          </div>
          {app.error && <Alert text={app.error} onClose={() => app.setError(null)} />}

          {app.tab === "nearby" && <Nearby app={app} />}
          {app.tab === "requests" && <Requests app={app} />}
          {app.tab === "chat" && <Chat app={app} />}
          {app.tab === "profile" && <Profile app={app} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-4 border-x border-t border-white/10 bg-[#07110f]/95 px-2 pb-3 pt-2 backdrop-blur-xl">
          {([["nearby", "Nearby", Home], ["requests", `Requests${app.incoming.length ? ` ${app.incoming.length}` : ""}`, UsersRound], ["chat", "Chat", MessageCircle], ["profile", "Profile", UserRound]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => app.setTab(id)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs ${app.tab === id ? "text-emerald-200" : "text-white/35"}`}><Icon className="size-5" />{label}</button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Nearby({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <>
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4"><div><h1 className="font-semibold">Open to Connect</h1><p className="mt-1 text-sm text-white/45">Both people must switch this on.</p></div><button disabled={app.busy} onClick={() => void app.toggleVisibility()} className={`grid size-14 place-items-center rounded-full disabled:opacity-50 ${app.visible ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}>{app.busy ? <LoaderCircle className="size-6 animate-spin" /> : <Power className="size-6" />}</button></div>
      <label className="mt-5 block text-sm" htmlFor="radius">Radius: {radiusLabel(app.radius)}</label><input id="radius" className="mt-2 w-full accent-emerald-300" type="range" min="100" max="2000" step="100" value={app.radius} onChange={(e) => app.setRadius(Number(e.target.value))} />
      <label className="mt-4 block text-sm" htmlFor="status">Optional status</label><textarea id="status" rows={2} maxLength={100} value={app.status} onChange={(e) => app.setStatus(e.target.value)} className="field mt-2 resize-none" />
    </section>
    <section className="space-y-3"><div className="flex justify-between"><h2 className="font-semibold">Nearby now</h2><span className="text-xs text-white/40">{app.nearby.length} active</span></div>
      {!app.visible && <Empty text="Turn on Open to Connect to find other active people." />}
      {app.visible && !app.nearby.length && <Empty text="No active person is inside both selected radii yet." />}
      {app.nearby.map((person) => <article key={person.user_id} className="card p-4"><div className="flex items-center gap-3"><Avatar name={person.display_name} /><div><p className="font-semibold">{person.display_name}</p><p className="text-xs text-white/40">{person.distance_label} · {person.languages.join(" · ")}</p></div></div><p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-white/70">“{person.status_text || "Open to conversation"}”</p><button disabled={app.busy} onClick={() => void app.sendRequest(person)} className="primary mt-3">Say Hi</button></article>)}
    </section>
  </>;
}

function Requests({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="space-y-5">
    <Group title="Incoming" empty="No incoming requests." items={app.incoming} render={(c) => <article className="card p-4"><Person connection={c} subtitle="Would like to say hi" /><div className="mt-4 grid grid-cols-2 gap-3"><button className="secondary" onClick={() => void app.respond(c, false)}>Ignore</button><button className="primary" onClick={() => void app.respond(c, true)}>Accept</button></div></article>} />
    <Group title="Waiting" empty="No outgoing requests." items={app.outgoing} render={(c) => <article className="card p-4"><Person connection={c} subtitle="Waiting for response" /></article>} />
    <Group title="Connected" empty="No accepted connections." items={app.accepted} render={(c) => <article className="card flex items-center justify-between p-4"><Person connection={c} subtitle="Connected" /><button className="secondary w-auto" onClick={() => void app.openChat(c)}>Chat</button></article>} />
  </section>;
}

function Chat({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  if (!app.activeConnection) return <Empty text="Open an accepted connection from Requests." />;
  return <section className="card p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{app.activeConnection.other?.display_name ?? "Connection"}</h2><p className="text-xs text-white/40">Realtime chat · exact location hidden</p></div><button className="secondary w-auto" onClick={() => void app.disconnect()}>Disconnect</button></div>
    <div className="mt-4 min-h-56 space-y-2">{!app.messages.length && <p className="py-10 text-center text-sm text-white/35">Say hello.</p>}{app.messages.map((m) => <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === app.userId ? "ml-auto bg-emerald-300 text-emerald-950" : "bg-white/10"}`}>{m.body}</div>)}</div>
    <div className="mt-4 flex gap-2"><input className="field" value={app.draft} onChange={(e) => app.setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void app.sendMessage(); }} placeholder="Write a message" /><button aria-label="Send" onClick={() => void app.sendMessage()} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-300 text-emerald-950"><Send className="size-5" /></button></div>
    <button className="secondary mt-3" onClick={() => void app.sendMessage("Meet near the main public entrance?")}><MapPin className="mr-2 inline size-4" />Suggest public meeting point</button>
  </section>;
}

function Profile({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="card p-5"><Avatar name={app.profile?.display_name ?? "?"} large /><h2 className="mt-3 text-xl font-semibold">{app.profile?.display_name}</h2><p className="text-sm text-white/45">{app.profile?.languages.join(" · ")} · 18+ confirmed</p><p className="mt-5 flex gap-2 text-sm text-white/65"><ShieldCheck className="size-5 text-emerald-300" />Exact coordinates are never shown to another user.</p><button className="secondary mt-6" onClick={() => void app.resetDeviceIdentity()}>Sign out</button></section>;
}

function Auth({ busy, error, onSignUp, onSignIn }: { busy: boolean; error: string | null; onSignUp: (e: string, p: string) => Promise<void>; onSignIn: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const valid = email.includes("@") && password.length >= 8;
  return <Frame><Panel title="Connect nearby, safely"><p className="text-sm text-white/50">Create a private account. Your exact location is never shared.</p>{error && <div className="mt-4"><Alert text={error} /></div>}<label className="mt-5 block text-sm">Email</label><input className="field mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><label className="mt-4 block text-sm">Password</label><input className="field mt-2" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /><button disabled={!valid || busy} className="primary mt-5" onClick={() => void onSignIn(email.trim(), password)}>Sign in</button><button disabled={!valid || busy} className="secondary mt-3" onClick={() => void onSignUp(email.trim(), password)}>Create account</button></Panel></Frame>;
}

function Onboarding({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: (n: string, l: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [languages, setLanguages] = useState("Telugu, English"); const [adult, setAdult] = useState(false);
  return <Frame><Panel title="Create your nearby profile">{error && <Alert text={error} />}<label className="mt-5 block text-sm">First name</label><input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} /><label className="mt-4 block text-sm">Languages</label><input className="field mt-2" value={languages} onChange={(e) => setLanguages(e.target.value)} /><label className="mt-5 flex gap-3 text-sm text-white/70"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I confirm I am at least 18.</label><button disabled={busy || !adult || name.trim().length < 2} className="primary mt-5" onClick={() => void onSave(name, languages)}>Enter CompanyNow</button></Panel></Frame>;
}

function Frame({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#06100e] px-4 py-8 text-white"><div className="mx-auto max-w-md"><header className="mb-6"><p className="text-2xl font-bold">CompanyNow</p><p className="text-sm text-white/40">Someone nearby. A moment together.</p></header>{children}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="card p-5"><h1 className="text-2xl font-bold">{title}</h1>{children}</section>; }
function Busy({ text }: { text: string }) { return <div className="flex justify-center gap-3 py-20 text-white/60"><LoaderCircle className="size-5 animate-spin" />{text}</div>; }
function Alert({ text, onClose }: { text: string; onClose?: () => void }) { return <div className="flex justify-between rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><p>{text}</p>{onClose && <button onClick={onClose}>×</button>}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed border-white/10 p-7 text-center text-sm text-white/40">{text}</div>; }
function Avatar({ name, large = false }: { name: string; large?: boolean }) { return <div className={`grid shrink-0 place-items-center bg-emerald-300/15 font-bold text-emerald-200 ${large ? "size-16 rounded-3xl text-xl" : "size-12 rounded-2xl"}`}>{name.charAt(0).toUpperCase()}</div>; }
function Person({ connection, subtitle }: { connection: Connection; subtitle: string }) { return <div className="flex items-center gap-3"><Avatar name={connection.other?.display_name ?? "?"} /><div><p className="font-semibold">{connection.other?.display_name ?? "Nearby person"}</p><p className="text-xs text-white/40">{subtitle}</p></div></div>; }
function Group({ title, empty, items, render }: { title: string; empty: string; items: Connection[]; render: (c: Connection) => React.ReactNode }) { return <div className="space-y-3"><h2 className="font-semibold">{title}</h2>{items.length ? items.map((c) => <div key={c.id}>{render(c)}</div>) : <Empty text={empty} />}</div>; }
