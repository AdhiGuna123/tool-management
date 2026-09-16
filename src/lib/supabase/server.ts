import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
      global: {
        fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('Accept', 'application/json');
          headers.set('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
          return fetch(url, { ...init, headers });
        },
      },
    }
  );
}
