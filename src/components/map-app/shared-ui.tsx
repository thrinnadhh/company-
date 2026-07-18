import { LoaderCircle, X } from "lucide-react";

import type { Connection } from "@/lib/companynow/types";

export function Frame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#06100e] px-4 py-8 text-white"><div className="mx-auto max-w-md"><header className="mb-6 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-emerald-300 text-xl font-black text-emerald-950">C</div><div><p className="text-2xl font-bold">CompanyNow</p><p className="text-sm text-white/40">Someone nearby. A moment together.</p></div></header>{children}</div></div>;
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card p-5"><h1 className="text-2xl font-bold">{title}</h1>{children}</section>;
}

export function Busy({ text }: { text: string }) {
  return <div className="flex justify-center gap-3 py-20 text-white/60"><LoaderCircle className="size-5 animate-spin" />{text}</div>;
}

export function Alert({ text, onClose }: { text: string; onClose?: () => void }) {
  return <div className="flex justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><p>{text}</p>{onClose && <button aria-label="Close" onClick={onClose}><X className="size-4" /></button>}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-white/10 p-7 text-center text-sm text-white/40">{text}</div>;
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <div className={`grid shrink-0 place-items-center bg-emerald-300/15 font-bold text-emerald-200 ${large ? "size-16 rounded-3xl text-xl" : "size-12 rounded-2xl"}`}>{name.charAt(0).toUpperCase()}</div>;
}

export function Person({ connection, subtitle }: { connection: Connection; subtitle: string }) {
  return <div className="flex min-w-0 items-center gap-3"><Avatar name={connection.other.display_name} /><div className="min-w-0"><p className="truncate font-semibold">{connection.other.display_name}</p><p className="truncate text-xs text-white/40">{subtitle}</p></div></div>;
}

export function Group({ title, empty, items, render }: { title: string; empty: string; items: Connection[]; render: (connection: Connection) => React.ReactNode }) {
  return <div className="space-y-3"><h2 className="font-semibold">{title}</h2>{items.length ? items.map((connection) => <div key={connection.id}>{render(connection)}</div>) : <Empty text={empty} />}</div>;
}

export function Count({ value }: { value: number }) {
  return <span className="rounded-full bg-emerald-300 px-2 py-1 text-xs font-bold text-emerald-950">{value > 99 ? "99+" : value}</span>;
}

export function Metric({ label, value }: { label: string; value: number }) {
  return <div className="card p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="text-xs text-white/40">{label}</p></div>;
}

export function NavButton({ active, label, count = 0, onClick, icon }: { active: boolean; label: string; count?: number; onClick: () => void; icon: React.ReactNode }) {
  return <button onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-xl py-2 text-xs ${active ? "text-emerald-200" : "text-white/35"}`}>{icon}{label}{count > 0 && <span className="absolute right-4 top-0 rounded-full bg-emerald-300 px-1.5 text-[10px] font-bold text-emerald-950">{count > 99 ? "99+" : count}</span>}</button>;
}
