"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  BootState,
  ChatMessage,
  Connection,
  ConnectionRow,
  NearbyPerson,
  Profile,
  Tab,
} from "@/lib/companynow/types";
import { radiusLabel } from "@/lib/companynow/types";
import { createClient } from "@/lib/supabase/client";

type Coordinates = { latitude: number; longitude: number };

function getCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("Allow location access so nearby people can be found.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

export function useCompanyNow() {
  const supabase = useMemo(() => createClient(), []);
  const [bootState, setBootState] = useState<BootState>(supabase ? "loading" : "setup");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("nearby");
  const [visible, setVisible] = useState(false);
  const [radius, setRadius] = useState(500);
  const [status, setStatus] = useState("Walking in the park — open to company");
  const [nearby, setNearby] = useState<NearbyPerson[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Turn on Open to Connect when you are ready for company.");
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, languages, adult_confirmed")
      .eq("id", id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!data) {
      setBootState("onboarding");
      return;
    }
    setProfile(data as Profile);
    setBootState("ready");
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function bootstrap() {
      try {
        const { data } = await client.auth.getSession();
        const id = data.session?.user.id ?? null;
        if (!id) {
          setBootState("auth");
          return;
        }
        if (cancelled) return;
        setUserId(id);
        await loadProfile(id);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not start CompanyNow.");
        setBootState("error");
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [loadProfile, supabase]);

  const loadConnections = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error: connectionError } = await supabase
      .from("connections")
      .select("id, sender_id, recipient_id, state, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .in("state", ["pending", "accepted"])
      .order("created_at", { ascending: false });
    if (connectionError) throw connectionError;

    const rows = (data ?? []) as ConnectionRow[];
    const otherIds = [...new Set(rows.map((row) => row.sender_id === userId ? row.recipient_id : row.sender_id))];
    let profiles: Profile[] = [];
    if (otherIds.length) {
      const result = await supabase
        .from("profiles")
        .select("id, display_name, languages, adult_confirmed")
        .in("id", otherIds);
      if (result.error) throw result.error;
      profiles = (result.data ?? []) as Profile[];
    }

    const profileMap = new Map(profiles.map((item) => [item.id, item]));
    const next = rows.map((row) => ({
      ...row,
      other: profileMap.get(row.sender_id === userId ? row.recipient_id : row.sender_id) ?? null,
    }));
    setConnections(next);

    if (activeConnection) {
      const refreshed = next.find((item) => item.id === activeConnection.id);
      if (!refreshed || refreshed.state !== "accepted") {
        setActiveConnection(null);
        setMessages([]);
        if (tab === "chat") setTab("requests");
      } else {
        setActiveConnection(refreshed);
      }
    }
  }, [activeConnection, supabase, tab, userId]);

  const loadNearby = useCallback(async () => {
    if (!supabase || !visible) {
      setNearby([]);
      return;
    }
    const { data, error: nearbyError } = await supabase.rpc("nearby_active_people");
    if (nearbyError) throw nearbyError;
    setNearby((data ?? []) as NearbyPerson[]);
  }, [supabase, visible]);

  const loadMessages = useCallback(async (connectionId: string) => {
    if (!supabase) return;
    const { data, error: messageError } = await supabase
      .from("messages")
      .select("id, connection_id, sender_id, body, created_at")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: true });
    if (messageError) throw messageError;
    setMessages((data ?? []) as ChatMessage[]);
  }, [supabase]);

  const writePresence = useCallback(async (active: boolean) => {
    if (!supabase) return;
    const coordinates = await getCoordinates();
    const { error: presenceError } = await supabase.rpc("set_my_presence", {
      p_latitude: coordinates.latitude,
      p_longitude: coordinates.longitude,
      p_radius_m: radius,
      p_status_text: status,
      p_is_active: active,
    });
    if (presenceError) throw presenceError;
  }, [radius, status, supabase]);

  useEffect(() => {
    if (bootState !== "ready") return;
    const timer = window.setTimeout(() => {
      void loadConnections().catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load requests."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bootState, loadConnections]);

  useEffect(() => {
    if (!supabase || !userId || bootState !== "ready") return;
    const channel = supabase
      .channel(`companynow-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => void loadConnections())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const message = payload.new as ChatMessage;
        if (message.connection_id === activeConnection?.id) {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeConnection?.id, bootState, loadConnections, supabase, userId]);

  useEffect(() => {
    if (!visible || bootState !== "ready") return;
    const nearbyTimer = window.setInterval(() => void loadNearby(), 15000);
    const heartbeatTimer = window.setInterval(() => {
      void writePresence(true).catch(() => setNotice("Location heartbeat paused. Reopen the app to stay visible."));
    }, 45000);
    return () => {
      window.clearInterval(nearbyTimer);
      window.clearInterval(heartbeatTimer);
    };
  }, [bootState, loadNearby, visible, writePresence]);

  useEffect(() => {
    if (!visible || bootState !== "ready") return;
    const timer = window.setTimeout(() => {
      void writePresence(true)
        .then(loadNearby)
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not update visibility."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bootState, loadNearby, radius, status, visible, writePresence]);

  async function signUp(email: string, password: string) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) {
      setError(result.error.message);
    } else if (result.data.session?.user) {
      setUserId(result.data.session.user.id);
      await loadProfile(result.data.session.user.id);
    } else {
      setNotice("Check your email, confirm your account, then return here to sign in.");
      setBootState("confirm");
    }
    setBusy(false);
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
    } else if (result.data.user) {
      setUserId(result.data.user.id);
      await loadProfile(result.data.user.id);
    }
    setBusy(false);
  }

  async function saveProfile(name: string, languageText: string) {
    if (!supabase || !userId) return;
    setBusy(true);
    setError(null);
    const languages = languageText.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5);
    const result = await supabase.from("profiles").insert({
      id: userId,
      display_name: name.trim(),
      languages,
      adult_confirmed: true,
    });
    if (result.error) setError(result.error.message);
    else await loadProfile(userId);
    setBusy(false);
  }

  async function toggleVisibility() {
    setBusy(true);
    setError(null);
    try {
      const next = !visible;
      await writePresence(next);
      setVisible(next);
      setNotice(next
        ? `You are live within ${radiusLabel(radius)}. Only fuzzy distance is shown.`
        : "You are no longer visible nearby.");
      if (next) window.setTimeout(() => void loadNearby(), 250);
      else setNearby([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update visibility.");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(person: NearbyPerson) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const result = await supabase.rpc("send_connection_request", { p_recipient_id: person.user_id });
    if (result.error) setError(result.error.message);
    else {
      setNotice(`${person.display_name} received your private Say Hi request.`);
      await loadConnections();
      setTab("requests");
    }
    setBusy(false);
  }

  async function respond(connection: Connection, accept: boolean) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const result = await supabase.rpc("respond_to_connection", {
      p_connection_id: connection.id,
      p_accept: accept,
    });
    if (result.error) setError(result.error.message);
    else {
      await loadConnections();
      if (accept) {
        const accepted = { ...connection, state: "accepted" as const };
        setActiveConnection(accepted);
        await loadMessages(connection.id);
        setTab("chat");
        setNotice(`You and ${connection.other?.display_name ?? "this person"} can now chat.`);
      }
    }
    setBusy(false);
  }

  async function openChat(connection: Connection) {
    setActiveConnection(connection);
    await loadMessages(connection.id);
    setTab("chat");
  }

  async function sendMessage(body = draft) {
    const clean = body.trim();
    if (!supabase || !userId || !activeConnection || !clean) return;
    setDraft("");
    const result = await supabase.from("messages").insert({
      connection_id: activeConnection.id,
      sender_id: userId,
      body: clean,
    });
    if (result.error) setError(result.error.message);
  }

  async function disconnect() {
    if (!supabase || !activeConnection) return;
    const result = await supabase.rpc("close_connection", { p_connection_id: activeConnection.id });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setActiveConnection(null);
    setMessages([]);
    await loadConnections();
    setTab("nearby");
    setNotice("Connection ended. You can continue being visible or turn it off.");
  }

  async function resetDeviceIdentity() {
    if (!supabase) return;
    if (visible) await writePresence(false).catch(() => undefined);
    await supabase.auth.signOut();
    setUserId(null);
    setProfile(null);
    setVisible(false);
    setNearby([]);
    setConnections([]);
    setActiveConnection(null);
    setMessages([]);
    setBootState("auth");
  }

  const incoming = connections.filter((item) => item.state === "pending" && item.recipient_id === userId);
  const outgoing = connections.filter((item) => item.state === "pending" && item.sender_id === userId);
  const accepted = connections.filter((item) => item.state === "accepted");

  return {
    bootState, userId, profile, tab, visible, radius, status, nearby, activeConnection,
    messages, draft, busy, notice, error, incoming, outgoing, accepted,
    setTab, setRadius, setStatus, setDraft, setError,
    loadNearby, loadConnections, signUp, signIn, saveProfile, toggleVisibility, sendRequest,
    respond, openChat, sendMessage, disconnect, resetDeviceIdentity,
  };
}
