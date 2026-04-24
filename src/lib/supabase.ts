import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mrgayvtieafnerbmegzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZ2F5dnRpZWFmbmVyYm1lZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAwNzQsImV4cCI6MjA5MjU5NjA3NH0.IeZH23xy0oDu3MDfetieFzvy3nP07QLO9bRolbiQg3w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);