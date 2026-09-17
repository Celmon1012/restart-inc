import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "@supabase/supabase-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared with ConsoleLayout's account menu, so the greeting on Overview and
// the name in the account dropdown always agree.
export function getDisplayName(user: User | null): string {
  return (
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Operator"
  );
}
