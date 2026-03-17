/**
 * Supabase Client — Single instance for the entire app.
 * Architecture decision: we use the browser client (@supabase/supabase-js)
 * because this is a client-side SPA. For SSR pages, create a separate
 * server client if needed.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
