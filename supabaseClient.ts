import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://aqckuwcmnppwzuwelkbh.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxY2t1d2NtbnBwd3p1d2Vsa2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDMyNjYsImV4cCI6MjA4MTExOTI2Nn0.qy9vu2SkIlWrx-5E9Z2hBLlipFJfghYaodjSgIS-8GE';

export const supabase = createClient(supabaseUrl, supabaseKey);