import { ShieldCheck } from "lucide-react";

import { Avatar, Metric } from "@/components/map-app/shared-ui";
import type { useCompanyNow } from "@/hooks/use-companynow";

export function ProfileScreen({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="space-y-4"><div className="card p-5"><Avatar name={app.profile?.display_name ?? "?"} large /><h2 className="mt-3 text-xl font-semibold">{app.profile?.display_name}</h2><p className="text-sm text-white/45">{app.profile?.languages.join(" · ")} · 18+ confirmed</p><p className="mt-5 flex gap-2 text-sm text-white/65"><ShieldCheck className="size-5 text-emerald-300" />Map icons use approximate positions; exact coordinates stay private.</p></div><div className="grid grid-cols-3 gap-3"><Metric label="Nearby" value={app.nearby.length} /><Metric label="Connected" value={app.accepted.length} /><Metric label="Unread" value={app.unreadTotal} /></div><button className="secondary" onClick={() => void app.resetDeviceIdentity()}>Sign out</button></section>;
}
