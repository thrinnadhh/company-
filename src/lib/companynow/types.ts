export type Tab = "nearby" | "requests" | "chat" | "profile";
export type BootState = "loading" | "setup" | "auth" | "confirm" | "onboarding" | "ready" | "error";
export type ConnectionState = "pending" | "accepted" | "declined" | "closed";
export type ReportReason = "harassment" | "spam" | "unsafe" | "fake_profile" | "other";

export type Profile = {
  id: string;
  display_name: string;
  languages: string[];
  adult_confirmed: boolean;
};

export type Presence = {
  radius_m: number;
  status_text: string | null;
  is_active: boolean;
  updated_at: string;
};

export type NearbyPerson = {
  user_id: string;
  display_name: string;
  languages: string[];
  status_text: string | null;
  distance_m: number;
  distance_label: string;
};

export type ConnectionSummaryRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  state: ConnectionState;
  created_at: string;
  other_user_id: string;
  other_display_name: string;
  other_languages: string[];
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type Connection = {
  id: string;
  sender_id: string;
  recipient_id: string;
  state: ConnectionState;
  created_at: string;
  other: Profile;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  connection_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function radiusLabel(radius: number) {
  return radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;
}
