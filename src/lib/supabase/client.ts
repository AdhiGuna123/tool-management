import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('Accept', 'application/json');
          if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            headers.set('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
            if (!headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
            }
          }
          return fetch(url, { ...init, headers });
        },
      },
    }
  );
}
