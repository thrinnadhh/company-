export type Tab = "nearby" | "requests" | "chat" | "profile";
export type BootState = "loading" | "setup" | "onboarding" | "ready" | "error";

export type Profile = {
  id: string;
  display_name: string;
  languages: string[];
  adult_confirmed: boolean;
};

export type NearbyPerson = {
  user_id: string;
  display_name: string;
  languages: string[];
  status_text: string | null;
  distance_m: number;
  distance_label: string;
};

export type ConnectionRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  state: "pending" | "accepted" | "declined" | "closed";
  created_at: string;
};

export type Connection = ConnectionRow & { other: Profile | null };

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
