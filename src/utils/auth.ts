import { supabase } from '@/lib/supabase';

export const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({
        email,
        password,
    });
};

export const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
        email,
        password,
    });
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
};