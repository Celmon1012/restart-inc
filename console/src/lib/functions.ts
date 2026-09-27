import { supabase } from "./supabase";

// Edge function call that surfaces the function's own {error} body. supabase-js's
// error.message is just "Edge Function returned a non-2xx status code" -- the
// useful message is only reachable via error.context (the raw Response) and has
// to be read out explicitly.
export async function invokeFunction<T = any>(
  name: string,
  options: { body?: unknown; query?: string } = {}
): Promise<T> {
  const path = options.query ? `${name}?${options.query}` : name;
  const { data, error } = await supabase.functions.invoke(path, options.body ? { body: options.body } : undefined);
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      let message: string | null = null;
      try {
        const body = await context.json();
        if (body?.error) message = String(body.error);
      } catch {
        // fall through to the generic error below
      }
      if (message) throw new Error(message);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
