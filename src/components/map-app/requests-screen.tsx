import type { useCompanyNow } from "@/hooks/use-companynow";

import { Count, Group, Person } from "@/components/map-app/shared-ui";

export function RequestsScreen({ app }: { app: ReturnType<typeof useCompanyNow> }) {
  return <section className="space-y-5">
    <Group title="Incoming" empty="No incoming requests." items={app.incoming} render={(connection) => <article className="card p-4"><Person connection={connection} subtitle="Would like to say hi" /><div className="mt-4 grid grid-cols-2 gap-3"><button disabled={app.busy} className="secondary" onClick={() => void app.respond(connection, false)}>Ignore</button><button disabled={app.busy} className="primary" onClick={() => void app.respond(connection, true)}>Accept</button></div></article>} />
    <Group title="Waiting" empty="No outgoing requests." items={app.outgoing} render={(connection) => <article className="card p-4"><Person connection={connection} subtitle="Waiting for response" /><button disabled={app.busy} className="secondary mt-4" onClick={() => void app.cancelRequest(connection)}>Cancel request</button></article>} />
    <Group title="Connected" empty="No accepted connections." items={app.accepted} render={(connection) => <article className="card p-4"><div className="flex items-center justify-between gap-3"><Person connection={connection} subtitle={connection.last_message_body ?? "Connected"} />{connection.unread_count > 0 && <Count value={connection.unread_count} />}</div><button className="secondary mt-4" onClick={() => void app.openChat(connection)}>Open chat</button></article>} />
  </section>;
}
