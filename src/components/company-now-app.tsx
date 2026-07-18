"use client";

import {
  BadgeCheck,
  Home,
  MapPin,
  MessageCircle,
  Power,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "nearby" | "requests" | "chat" | "profile";
type RequestState = "idle" | "sent" | "accepted";
type Person = {
  id: string;
  name: string;
  initials: string;
  distance: number;
  distanceLabel: string;
  languages: string;
  status: string;
};
type Message = { id: number; sender: "me" | "them" | "system"; text: string };

const PEOPLE: Person[] = [
  {
    id: "rahul",
    name: "Rahul",
    initials: "R",
    distance: 240,
    distanceLabel: "Around 200–500 m away",
    languages: "Telugu · English",
    status: "Walking in the park and open to talking.",
  },
  {
    id: "meera",
    name: "Meera",
    initials: "M",
    distance: 460,
    distanceLabel: "Around 500 m away",
    languages: "English · Hindi",
    status: "Having coffee before heading home.",
  },
];

const INITIAL_MESSAGES: Message[] = [
  { id: 1, sender: "system", text: "You both accepted. Exact locations remain private." },
  { id: 2, sender: "them", text: "Hi! Are you walking near the main track?" },
];

function radiusLabel(radius: number) {
  return radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;
}

export function CompanyNowApp() {
  const [tab, setTab] = useState<Tab>("nearby");
  const [visible, setVisible] = useState(false);
  const [radius, setRadius] = useState(500);
  const [status, setStatus] = useState("Walking in the park — open to company");
  const [selected, setSelected] = useState<Person>(PEOPLE[0]);
  const [request, setRequest] = useState<RequestState>("idle");
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [meetingPoint, setMeetingPoint] = useState<string | null>(null);
  const [notice, setNotice] = useState("Turn on Open to Connect to begin the judge demo.");

  const nearby = useMemo(
    () => (visible ? PEOPLE.filter((person) => person.distance <= radius) : []),
    [visible, radius],
  );

  function toggleVisibility() {
    const next = !visible;
    setVisible(next);
    setNotice(
      next
        ? `You are visible within ${radiusLabel(radius)}. Exact coordinates stay hidden.`
        : "You are no longer visible nearby.",
    );
  }

  function sayHi(person: Person) {
    setSelected(person);
    setRequest("sent");
    setTab("requests");
    setNotice(`${person.name} received a private Say Hi request.`);
  }

  function accept() {
    setRequest("accepted");
    setTab("chat");
    setNotice("Both people accepted. The coordination chat is open.");
  }

  function ignore() {
    setRequest("idle");
    setTab("nearby");
    setNotice("The request was ignored privately. No rejection is shown.");
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: Date.now(), sender: "me", text }]);
    setDraft("");
  }

  function reset() {
    setTab("nearby");
    setVisible(false);
    setRadius(500);
    setStatus("Walking in the park — open to company");
    setRequest("idle");
    setMessages(INITIAL_MESSAGES);
    setMeetingPoint(null);
    setNotice("Turn on Open to Connect to begin the judge demo.");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#193d35_0,_#081613_42%,_#030807_100%)] text-white">
      <div className="mx-auto min-h-screen max-w-md border-x border-white/10 bg-[#07110f]/95">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-lg font-bold">CompanyNow</p>
            <p className="text-xs text-white/45">Someone nearby. A moment together.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${visible ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-white/45"}`}>
            {visible ? "Visible now" : "Private"}
          </span>
        </header>

        <main className="space-y-4 px-4 pb-28 pt-4">
          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50">
            <div className="flex items-start justify-between gap-3">
              <p>{notice}</p>
              <button type="button" onClick={reset} aria-label="Reset demo" className="shrink-0 rounded-xl p-1 text-emerald-100/70 hover:bg-white/10">
                <RotateCcw className="size-4" />
              </button>
            </div>
          </section>

          {tab === "nearby" && (
            <>
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="font-semibold">Open to Connect</h1>
                    <p className="mt-1 text-sm text-white/45">See and be seen only by nearby people who also opt in.</p>
                  </div>
                  <button type="button" onClick={toggleVisibility} className={`grid size-14 place-items-center rounded-full transition ${visible ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}>
                    <Power className="size-6" />
                  </button>
                </div>

                <label className="mt-5 block text-sm font-medium" htmlFor="radius">Radius: {radiusLabel(radius)}</label>
                <input id="radius" className="mt-2 w-full accent-emerald-300" type="range" min="100" max="2000" step="100" value={radius} onChange={(event) => setRadius(Number(event.target.value))} />

                <label className="mt-4 block text-sm font-medium" htmlFor="status">Optional status</label>
                <textarea id="status" value={status} onChange={(event) => setStatus(event.target.value)} maxLength={100} rows={2} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-300/50" />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Nearby now</h2>
                  <span className="text-xs text-white/40">{nearby.length} active</span>
                </div>
                {!visible && <Empty text="Turn on Open to Connect to view active people nearby." />}
                {visible && nearby.length === 0 && <Empty text="No active people are currently inside this radius." />}
                {nearby.map((person) => (
                  <article key={person.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex gap-3">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-300/15 font-bold text-emerald-200">{person.initials}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold">{person.name}<BadgeCheck className="size-4 text-emerald-300" /></div>
                        <p className="text-xs text-white/40">{person.distanceLabel} · {person.languages}</p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-white/70">“{person.status}”</p>
                    <button type="button" onClick={() => sayHi(person)} className="mt-3 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-bold text-emerald-950">Say Hi</button>
                  </article>
                ))}
              </section>
            </>
          )}

          {tab === "requests" && (
            request === "sent" ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Receiver demo</p>
                <h2 className="mt-2 text-xl font-semibold">Trinadh would like to say hi</h2>
                <p className="mt-2 text-sm text-white/50">Nearby · {status || "Open to conversation"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" onClick={ignore} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold">Ignore</button>
                  <button type="button" onClick={accept} className="rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-emerald-950">Accept</button>
                </div>
              </section>
            ) : <Empty text="No pending requests. Send Say Hi from the Nearby screen." />
          )}

          {tab === "chat" && (
            request === "accepted" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <div><h2 className="font-semibold">Chat with {selected.name}</h2><p className="text-xs text-white/40">Connected · exact location hidden</p></div>
                    <button type="button" onClick={() => { setRequest("idle"); setTab("nearby"); setMeetingPoint(null); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs">Disconnect</button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {messages.map((message) => (
                      <div key={message.id} className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${message.sender === "me" ? "ml-auto bg-emerald-300 text-emerald-950" : message.sender === "system" ? "mx-auto bg-white/5 text-center text-xs text-white/45" : "bg-white/10"}`}>{message.text}</div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Type a message" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
                    <button type="button" onClick={sendMessage} className="grid size-11 place-items-center rounded-2xl bg-emerald-300 text-emerald-950"><Send className="size-4" /></button>
                  </div>
                </div>
                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-emerald-300" /> Meet safely</h3>
                  <p className="mt-1 text-sm text-white/45">Suggest a public reference point. Both people still decide whether to meet.</p>
                  <div className="mt-3 grid gap-2">
                    {["Main park entrance", "Coffee counter", "Security desk"].map((point) => (
                      <button key={point} type="button" onClick={() => setMeetingPoint(point)} className={`rounded-2xl border px-3 py-2 text-left text-sm ${meetingPoint === point ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10"}`}>{point}</button>
                    ))}
                  </div>
                </section>
              </section>
            ) : <Empty text="Chat opens only after the Say Hi request is accepted." />
          )}

          {tab === "profile" && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="grid size-16 place-items-center rounded-3xl bg-emerald-300/15 text-xl font-bold text-emerald-200">T</div>
              <h2 className="mt-3 text-xl font-semibold">Trinadh</h2>
              <p className="text-sm text-white/45">Telugu · English · Phone verified</p>
              <div className="mt-5 space-y-3 text-sm text-white/65">
                <p className="flex gap-2"><ShieldCheck className="size-5 text-emerald-300" /> Exact coordinates are never shown to other users.</p>
                <p className="flex gap-2"><UsersRound className="size-5 text-emerald-300" /> CompanyNow is for temporary, mutual company—not dating.</p>
              </div>
            </section>
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-4 border-x border-t border-white/10 bg-[#07110f]/95 px-2 pb-3 pt-2 backdrop-blur-xl">
          {([
            ["nearby", "Nearby", Home],
            ["requests", "Requests", UsersRound],
            ["chat", "Chat", MessageCircle],
            ["profile", "Profile", UserRound],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs ${tab === id ? "text-emerald-200" : "text-white/35"}`}>
              <Icon className="size-5" />{label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">{text}</div>;
}
