"use client";

import {
  BadgeCheck,
  Home,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

import { useCompanyNow } from "@/hooks/use-companynow";
import type { Connection } from "@/lib/companynow/types";
import { radiusLabel } from "@/lib/companynow/types";

export function CompanyNowApp() {
  const app = useCompanyNow();

  if (app.bootState === "setup") return <SetupScreen />;
  if (app.bootState === "loading") return <LoadingScreen label="Creating your private device identity…" />;
  if (app.bootState === "error") return <ErrorScreen message={app.error ?? "Could not start CompanyNow."} />;
  if (app.bootState === "onboarding") {
    return <OnboardingScreen busy={app.busy} error={app.error} onSave={app.saveProfile} />;
  }
  if (!app.profile || !app.userId) return <LoadingScreen label="Opening CompanyNow…" />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#193d35_0,_#081613_42%,_#030807_100%)] text-white">
      <div className="mx-auto min-h-screen max-w-md border-x border-white/10 bg-[#07110f]/95">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-lg font-bold">CompanyNow</p>
            <p className="text-xs text-white/45">Someone nearby. A moment together.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${app.visible ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-white/45"}`}>
            {app.visible ? "Visible now" : "Private"}
          </span>
        </header>

        <main className="space-y-4 px-4 pb-28 pt-4">
          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50">
            <div className="flex items-start justify-between gap-3">
              <p>{app.notice}</p>
              <button
                type="button"
                onClick={() => void (app.visible ? app.loadNearby() : app.loadConnections())}
                aria-label="Refresh"
                className="shrink-0 rounded-xl p-1 text-emerald-100/70 hover:bg-white/10"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </section>

          {app.error && <ErrorNotice message={app.error} onClose={() => app.setError(null)} />}

          {app.tab === "nearby" && (
            <>
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="font-semibold">Open to Connect</h1>
                    <p className="mt-1 text-sm text-white/45">Both people must switch this on before either appears nearby.</p>
                  </div>
                  <button
                    disabled={app.busy}
                    type="button"
                    onClick={() => void app.toggleVisibility()}
                    className={`grid size-14 place-items-center rounded-full transition disabled:opacity-50 ${app.visible ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}
                  >
                    {app.busy ? <LoaderCircle className="size-6 animate-spin" /> : <Power className="size-6" />}
                  </button>
                </div>

                <label className="mt-5 block text-sm font-medium" htmlFor="radius">Radius: {radiusLabel(app.radius)}</label>
                <input
                  id="radius"
                  className="mt-2 w-full accent-emerald-300"
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={app.radius}
                  onChange={(event) => app.setRadius(Number(event.target.value))}
                />

                <label className="mt-4 block text-sm font-medium" htmlFor="status">Optional status</label>
                <textarea
                  id="status"
                  value={app.status}
                  onChange={(event) => app.setStatus(event.target.value)}
                  maxLength={100}
                  rows={2}
                  placeholder="Walking, coffee, metro, gym…"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-300/50"
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Nearby now</h2>
                  <span className="text-xs text-white/40">{app.nearby.length} active</span>
                </div>
                {!app.visible && <Empty text="Turn on Open to Connect to become visible and find other active people." />}
                {app.visible && app.nearby.length === 0 && (
                  <Empty text="No one active is inside both users’ selected radius yet. Open this app on a second phone nearby and switch it on." />
                )}
                {app.nearby.map((person) => (
                  <article key={person.user_id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex gap-3">
                      <Avatar name={person.display_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {person.display_name}<BadgeCheck className="size-4 text-emerald-300" />
                        </div>
                        <p className="text-xs text-white/40">
                          {person.distance_label} · {person.languages.join(" · ") || "Language not added"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-white/70">“{person.status_text || "Open to conversation"}”</p>
                    <button
                      disabled={app.busy}
                      type="button"
                      onClick={() => void app.sendRequest(person)}
                      className="mt-3 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-bold text-emerald-950 disabled:opacity-50"
                    >
                      Say Hi
                    </button>
                  </article>
                ))}
              </section>
            </>
          )}

          {app.tab === "requests" && (
            <section className="space-y-4">
              <RequestGroup title="Incoming" empty="No one has requested to connect yet.">
                {app.incoming.map((connection) => (
                  <article key={connection.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={connection.other?.display_name ?? "Nearby person"} />
                      <div>
                        <p className="font-semibold">{connection.other?.display_name ?? "Nearby person"}</p>
                        <p className="text-xs text-white/40">Would like to say hi</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button disabled={app.busy} type="button" onClick={() => void app.respond(connection, false)} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold">Ignore</button>
                      <button disabled={app.busy} type="button" onClick={() => void app.respond(connection, true)} className="rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-emerald-950">Accept</button>
                    </div>
                  </article>
                ))}
              </RequestGroup>

              <RequestGroup title="Waiting" empty="No outgoing requests.">
                {app.outgoing.map((connection) => <ConnectionCard key={connection.id} connection={connection} actionLabel="Request sent" />)}
              </RequestGroup>

              <RequestGroup title="Connected" empty="Accepted connections appear here.">
                {app.accepted.map((connection) => (
                  <ConnectionCard key={connection.id} connection={connection} actionLabel="Open chat" onAction={() => void app.openChat(connection)} />
                ))}
              </RequestGroup>
            </section>
          )}

          {app.tab === "chat" && (
            app.activeConnection ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Chat with {app.activeConnection.other?.display_name ?? "your connection"}</h2>
                      <p className="text-xs text-white/40">Realtime chat · exact location hidden</p>
                    </div>
                    <button type="button" onClick={() => void app.disconnect()} className="rounded-xl border border-white/10 px-3 py-2 text-xs">Disconnect</button>
                  </div>
                  <div className="mt-4 min-h-52 space-y-2">
                    {app.messages.length === 0 && <p className="py-8 text-center text-sm text-white/35">Say hello and decide whether to chat or meet.</p>}
                    {app.messages.map((message) => (
                      <div key={message.id} className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === app.userId ? "ml-auto bg-emerald-300 text-emerald-950" : "bg-white/10"}`}>
                        {message.body}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={app.draft}
                      onChange={(event) => app.setDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") void app.sendMessage(); }}
                      placeholder="Type a message"
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                    />
                    <button type="button" onClick={() => void app.sendMessage()} className="grid size-11 place-items-center rounded-2xl bg-emerald-300 text-emerald-950"><Send className="size-4" /></button>
                  </div>
                </div>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-emerald-300" /> Meet safely</h3>
                  <p className="mt-1 text-sm text-white/45">Send a public reference point. Never share a home address.</p>
                  <div className="mt-3 grid gap-2">
                    {["📍 Main entrance", "📍 Coffee counter", "📍 Security desk"].map((point) => (
                      <button key={point} type="button" onClick={() => void app.sendMessage(`Meet suggestion: ${point}`)} className="rounded-2xl border border-white/10 px-3 py-2 text-left text-sm">{point}</button>
                    ))}
                  </div>
                </section>
              </section>
            ) : (
              <section className="space-y-3">
                <Empty text="Accept a request or open one of your connected conversations." />
                {app.accepted.map((connection) => (
                  <ConnectionCard key={connection.id} connection={connection} actionLabel="Open chat" onAction={() => void app.openChat(connection)} />
                ))}
              </section>
            )
          )}

          {app.tab === "profile" && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <Avatar name={app.profile.display_name} large />
              <h2 className="mt-3 text-xl font-semibold">{app.profile.display_name}</h2>
              <p className="text-sm text-white/45">{app.profile.languages.join(" · ") || "No languages added"} · 18+ confirmed</p>
              <div className="mt-5 space-y-3 text-sm text-white/65">
                <p className="flex gap-2"><ShieldCheck className="size-5 shrink-0 text-emerald-300" /> Exact coordinates never leave the protected matching function.</p>
                <p className="flex gap-2"><UsersRound className="size-5 shrink-0 text-emerald-300" /> Both people must be active and inside each other’s selected radius.</p>
              </div>
              <button type="button" onClick={() => void app.resetDeviceIdentity()} className="mt-6 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold">Reset this test identity</button>
            </section>
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-4 border-x border-t border-white/10 bg-[#07110f]/95 px-2 pb-3 pt-2 backdrop-blur-xl">
          {([
            ["nearby", "Nearby", Home],
            ["requests", `Requests${app.incoming.length ? ` ${app.incoming.length}` : ""}`, UsersRound],
            ["chat", "Chat", MessageCircle],
            ["profile", "Profile", UserRound],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => app.setTab(id)} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs ${app.tab === id ? "text-emerald-200" : "text-white/35"}`}>
              <Icon className="size-5" />{label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function OnboardingScreen({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: (name: string, languages: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState("Telugu, English");
  const [adult, setAdult] = useState(false);
  const valid = name.trim().length >= 2 && adult;

  return (
    <Shell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm text-emerald-200">First launch</p>
        <h1 className="mt-1 text-2xl font-bold">Create your nearby profile</h1>
        <p className="mt-2 text-sm text-white/45">Only your first name, languages and optional status are shown.</p>
        {error && <div className="mt-4"><ErrorNotice message={error} /></div>}
        <label className="mt-5 block text-sm font-medium" htmlFor="name">First name</label>
        <input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Trinadh" />
        <label className="mt-4 block text-sm font-medium" htmlFor="languages">Languages, separated by commas</label>
        <input id="languages" value={languages} onChange={(event) => setLanguages(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
        <label className="mt-5 flex items-start gap-3 text-sm text-white/70">
          <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} className="mt-1 accent-emerald-300" />
          <span>I confirm that I am at least 18 years old.</span>
        </label>
        <button disabled={!valid || busy} type="button" onClick={() => void onSave(name, languages)} className="mt-5 w-full rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-emerald-950 disabled:opacity-40">
          {busy ? "Creating…" : "Enter CompanyNow"}
        </button>
      </section>
    </Shell>
  );
}

function SetupScreen() {
  return <Shell><section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5"><h1 className="text-xl font-bold">Backend configuration required</h1><p className="mt-2 text-sm text-white/60">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then apply the included Supabase migration.</p></section></Shell>;
}

function LoadingScreen({ label }: { label: string }) {
  return <Shell><div className="flex items-center justify-center gap-3 py-20 text-white/60"><LoaderCircle className="size-5 animate-spin" />{label}</div></Shell>;
}

function ErrorScreen({ message }: { message: string }) {
  return <Shell><ErrorNotice message={message} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#193d35_0,_#081613_42%,_#030807_100%)] px-4 py-8 text-white"><div className="mx-auto max-w-md"><header className="mb-6"><p className="text-2xl font-bold">CompanyNow</p><p className="text-sm text-white/45">Someone nearby. A moment together.</p></header>{children}</div></div>;
}

function ErrorNotice({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><p>{message}</p>{onClose && <button type="button" onClick={onClose} aria-label="Dismiss">×</button>}</div>;
}

function RequestGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="space-y-3"><h2 className="font-semibold">{title}</h2>{hasChildren ? children : <Empty text={empty} />}</div>;
}

function ConnectionCard({ connection, actionLabel, onAction }: { connection: Connection; actionLabel: string; onAction?: () => void }) {
  return <article className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4"><Avatar name={connection.other?.display_name ?? "Nearby person"} /><div className="min-w-0 flex-1"><p className="font-semibold">{connection.other?.display_name ?? "Nearby person"}</p><p className="text-xs text-white/40">{connection.state === "accepted" ? "Connected" : "Waiting for a response"}</p></div><button type="button" disabled={!onAction} onClick={onAction} className={`rounded-xl px-3 py-2 text-xs font-semibold ${onAction ? "bg-emerald-300 text-emerald-950" : "bg-white/5 text-white/35"}`}>{actionLabel}</button></article>;
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <div className={`grid shrink-0 place-items-center bg-emerald-300/15 font-bold text-emerald-200 ${large ? "size-16 rounded-3xl text-xl" : "size-12 rounded-2xl"}`}>{name.trim().charAt(0).toUpperCase() || "?"}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-white/10 p-7 text-center text-sm text-white/40">{text}</div>;
}
