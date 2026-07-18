"use client";

import { useState } from "react";

import { Alert, Frame, Panel } from "@/components/map-app/shared-ui";

export function AuthScreen({ busy, error, onSignUp, onSignIn }: { busy: boolean; error: string | null; onSignUp: (email: string, password: string) => Promise<void>; onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 8;
  return <Frame><Panel title="Connect nearby, safely"><p className="text-sm text-white/50">Create a private account. Your exact location is never shared.</p>{error && <div className="mt-4"><Alert text={error} /></div>}<label className="mt-5 block text-sm" htmlFor="email">Email</label><input id="email" className="field mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /><label className="mt-4 block text-sm" htmlFor="password">Password</label><input id="password" className="field mt-2" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /><button disabled={!valid || busy} className="primary mt-5" onClick={() => void onSignIn(email.trim(), password)}>Sign in</button><button disabled={!valid || busy} className="secondary mt-3" onClick={() => void onSignUp(email.trim(), password)}>Create account</button></Panel></Frame>;
}

export function OnboardingScreen({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: (name: string, languages: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState("Telugu, English");
  const [adult, setAdult] = useState(false);
  return <Frame><Panel title="Create your nearby profile">{error && <Alert text={error} />}<label className="mt-5 block text-sm" htmlFor="name">First name</label><input id="name" className="field mt-2" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /><label className="mt-4 block text-sm" htmlFor="languages">Languages</label><input id="languages" className="field mt-2" value={languages} onChange={(event) => setLanguages(event.target.value)} /><label className="mt-5 flex gap-3 text-sm text-white/70"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />I confirm I am at least 18.</label><button disabled={busy || !adult || name.trim().length < 2} className="primary mt-5" onClick={() => void onSave(name, languages)}>Enter CompanyNow</button></Panel></Frame>;
}
