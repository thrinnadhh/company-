"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  BootState,
  ChatMessage,
  Connection,
  ConnectionSummaryRow,
  NearbyPerson,
  Presence,
  Profile,
  ReportReason,
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

function isFreshPresence(presence: Presence) {
  return Date.now() - new Date(presence.updated_at).getTime() < 120_000;
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

  const loadPresence = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error: presenceError } = await supabase
      .from("presences")
      .select("radius_m, status_text, is_active, updated_at")
      .eq("user_id", id)
      .maybeSingle();
    if (presenceError) throw presenceError;
    if (!data) return;

    const presence = data as Presence;
    setRadius(presence.radius_m);
    setStatus(presence.status_text ?? "Open to conversation");
    setVisible(presence.is_active && isFreshPresence(presence));
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
        await Promise.all([loadProfile(id), loadPresence(id)]);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not start CompanyNow.");
        setBootState("error");
      }
    }

    void bootstrap();
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setProfile(null);
        setBootState("auth");
      } else if (session?.user.id) {
        setUserId(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [loadPresence, loadProfile, supabase]);

  const loadConnections = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error: connectionError } = await supabase.rpc("my_connection_summaries");
    if (connectionError) throw connectionError;

    const next = ((data ?? []) as ConnectionSummaryRow[]).map((row) => ({
      id: row.id,
      sender_id: row.sender_id,
      recipient_id: row.recipient_id,
      state: row.state,
      created_at: row.created_at,
      other: {
        id: row.other_user_id,
        display_name: row.other_display_name,
        languages: row.other_languages ?? [],
        adult_confirmed: true,
      },
      last_message_body: row.last_message_body,
      last_message_at: row.last_message_at,
      unread_count: Number(row.unread_count ?? 0),
    }));

    setConnections(next);
    setActiveConnection((current) => {
      if (!current) return null;
      const refreshed = next.find((item) => item.id === current.id);
      return refreshed?.state === "accepted" ? refreshed : null;
    });
  }, [supabase, userId]);

  const loadNearby = useCallback(async () => {
    if (!supabase || !visible) {
      setNearby([]);
      return;
    }
    const { data, error: nearbyError } = await supabase.rpc("nearby_active_people");
    if (nearbyError) throw nearbyError;
    setNearby((data ?? []) as NearbyPerson[]);
  }, [supabase, visible]);

  const markRead = useCallback(async (connectionId: string) => {
    if (!supabase) return;
    const result = await supabase.rpc("mark_connection_read", { p_connection_id: connectionId });
    if (result.error) throw result.error;
  }, [supabase]);

  const loadMessages = useCallback(async (connectionId: string) => {
    if (!supabase) return;
    const { data, error: messageError } = await supabase
      .from("messages")
      .select("id, connection_id, sender_id, body, created_at")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (messageError) throw messageError;
    setMessages(((data ?? []) as ChatMessage[]).reverse());
    await markRead(connectionId);
  }, [markRead, supabase]);

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
        setError(caught instanceof Error ? caught.message : "Could not load connections."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bootState, loadConnections]);

  useEffect(() => {
    if (!supabase || !userId || bootState !== "ready") return;
    const channel = supabase
      .channel(`companynow-user-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        void loadConnections();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const message = payload.new as ChatMessage;
        if (message.connection_id === activeConnection?.id) {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          void markRead(message.connection_id).then(loadConnections);
        } else {
          void loadConnections();
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [activeConnection?.id, bootState, loadConnections, markRead, supabase, userId]);

  useEffect(() => {
    if (!visible || bootState !== "ready") return;
    const nearbyTimer = window.setInterval(() => void loadNearby(), 15_000);
    const heartbeatTimer = window.setInterval(() => {
      void writePresence(true).catch(() => setNotice("Location heartbeat paused. Reopen the app to stay visible."));
    }, 45_000);
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
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href.split("#")[0].split("?")[0] },
    });
    if (result.error) {
      setError(result.error.message);
    } else if (result.data.session?.user) {
      setUserId(result.data.session.user.id);
      await loadProfile(result.data.session.user.id);
    } else {
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
      await Promise.all([loadProfile(result.data.user.id), loadPresence(result.data.user.id)]);
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
        ? `You are live within ${radiusLabel(radius)}. Up to 50 active people may appear.`
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
      await Promise.all([loadConnections(), loadNearby()]);
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
        setNotice(`You and ${connection.other.display_name} can now chat.`);
      }
    }
    setBusy(false);
  }

  async function cancelRequest(connection: Connection) {
    if (!supabase) return;
    setBusy(true);
    const result = await supabase.rpc("close_connection", { p_connection_id: connection.id });
    if (result.error) setError(result.error.message);
    else await Promise.all([loadConnections(), loadNearby()]);
    setBusy(false);
  }

  async function openChat(connection: Connection) {
    setActiveConnection(connection);
    await loadMessages(connection.id);
    await loadConnections();
    setTab("chat");
  }

  async function sendMessage(body = draft) {
    const clean = body.trim();
    if (!supabase || !userId || !activeConnection || !clean) return;
    setDraft("");
    const result = await supabase
      .from("messages")
      .insert({ connection_id: activeConnection.id, sender_id: userId, body: clean })
      .select("id, connection_id, sender_id, body, created_at")
      .single();
    if (result.error) {
      setError(result.error.message);
      setDraft(clean);
      return;
    }
    const message = result.data as ChatMessage;
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    await loadConnections();
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
    await Promise.all([loadConnections(), loadNearby()]);
    setTab("nearby");
    setNotice("Connection ended. You can continue being visible or turn it off.");
  }

  async function blockConnection(connection: Connection) {
    if (!supabase) return;
    setBusy(true);
    const result = await supabase.rpc("block_user", { p_blocked_id: connection.other.id });
    if (result.error) setError(result.error.message);
    else {
      setActiveConnection(null);
      setMessages([]);
      await Promise.all([loadConnections(), loadNearby()]);
      setTab("nearby");
      setNotice(`${connection.other.display_name} has been blocked.`);
    }
    setBusy(false);
  }

  async function reportConnection(connection: Connection, reason: ReportReason, details: string) {
    if (!supabase) return false;
    setBusy(true);
    const result = await supabase.rpc("report_user", {
      p_reported_id: connection.other.id,
      p_connection_id: connection.id,
      p_reason: reason,
      p_details: details,
    });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return false;
    }
    setNotice("Report submitted. Block the person as well if you do not want further contact.");
    setBusy(false);
    return true;
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
  const unreadTotal = accepted.reduce((sum, item) => sum + item.unread_count, 0);

  return {
    bootState, userId, profile, tab, visible, radius, status, nearby, activeConnection,
    messages, draft, busy, notice, error, incoming, outgoing, accepted, unreadTotal,
    setTab, setRadius, setStatus, setDraft, setError,
    loadNearby, loadConnections, signUp, signIn, saveProfile, toggleVisibility, sendRequest,
    respond, cancelRequest, openChat, sendMessage, disconnect, blockConnection,
    reportConnection, resetDeviceIdentity,
  };
}
