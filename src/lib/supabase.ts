import { createClient } from '@supabase/supabase-js';

// Access environment variables with fallbacks
// Vite/Netlify use import.meta.env.VITE_*
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Export a dummy supabase object if credentials are missing to prevent crash
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { 
      storage: { 
        from: () => ({ 
          upload: async () => ({ error: new Error('Supabase credentials missing') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        }) 
      } 
    } as any;
