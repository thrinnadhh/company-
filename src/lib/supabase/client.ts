import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_URL = "https://ijrhjjuxslgzzcwhwvyu.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_gOqjThFCiYk18jqkCu6iJA_z73mAClB";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_PUBLISHABLE_KEY;
  return createBrowserClient(url, key);
}
