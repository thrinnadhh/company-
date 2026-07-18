"use client";

import { Home, MessageCircle, RefreshCw, UserRound, UsersRound } from "lucide-react";

import { AuthScreen, OnboardingScreen } from "@/components/map-app/auth-screens";
import { ChatScreen } from "@/components/map-app/chat-screen";
import { NearbyScreen } from "@/components/map-app/nearby-screen";
import { ProfileScreen } from "@/components/map-app/profile-screen";
import { RequestsScreen } from "@/components/map-app/requests-screen";
import { Alert, Busy, Frame, NavButton, Panel } from "@/components/map-app/shared-ui";
import { useCompanyNow } from "@/hooks/use-companynow";

export function CompanyNowMapApp() {
  const app = useCompanyNow();

  if (app.bootState === "loading") return <Frame><Busy text="Opening CompanyNow…" /></Frame>;
  if (app.bootState === "auth") return <AuthScreen busy={app.busy} error={app.error} onSignIn={app.signIn} onSignUp={app.signUp} />;
  if (app.bootState === "confirm") return <Frame><Panel title="Confirm your email"><p className="text-sm text-white/60">Open the CompanyNow confirmation email, confirm the account, then return here and sign in.</p><button className="primary mt-5" onClick={() => window.location.reload()}>Return to sign in</button></Panel></Frame>;
  if (app.bootState === "onboarding") return <OnboardingScreen busy={app.busy} error={app.error} onSave={app.saveProfile} />;
  if (app.bootState === "setup" || app.bootState === "error") return <Frame><Alert text={app.error ?? "Backend configuration is unavailable."} /></Frame>;
  if (!app.profile || !app.userId) return <Frame><Busy text="Loading profile…" /></Frame>;

  return <div className="min-h-screen bg-[#06100e] text-white"><div className="mx-auto min-h-screen max-w-md border-x border-white/10 bg-[#081613]"><header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-emerald-300 text-lg font-black text-emerald-950">C</div><div><p className="font-bold">CompanyNow</p><p className="text-xs text-white/40">Someone nearby. A moment together.</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${app.visible ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-white/40"}`}>{app.visible ? "Live now" : "Private"}</span></header><main className="space-y-4 px-4 pb-28 pt-4"><div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50"><p>{app.notice}</p><button aria-label="Refresh" onClick={() => void Promise.all([app.loadNearby(), app.loadConnections()])}><RefreshCw className="size-4" /></button></div>{app.error && <Alert text={app.error} onClose={() => app.setError(null)} />}{app.tab === "nearby" && <NearbyScreen app={app} />}{app.tab === "requests" && <RequestsScreen app={app} />}{app.tab === "chat" && <ChatScreen app={app} />}{app.tab === "profile" && <ProfileScreen app={app} />}</main><nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-4 border-x border-t border-white/10 bg-[#07110f]/95 px-2 pb-3 pt-2 backdrop-blur-xl"><NavButton active={app.tab === "nearby"} label="Map" onClick={() => app.setTab("nearby")} icon={<Home className="size-5" />} /><NavButton active={app.tab === "requests"} label="Requests" count={app.incoming.length} onClick={() => app.setTab("requests")} icon={<UsersRound className="size-5" />} /><NavButton active={app.tab === "chat"} label="Chat" count={app.unreadTotal} onClick={() => app.setTab("chat")} icon={<MessageCircle className="size-5" />} /><NavButton active={app.tab === "profile"} label="Profile" onClick={() => app.setTab("profile")} icon={<UserRound className="size-5" />} /></nav></div></div>;
}
