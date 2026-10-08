/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (userId, fallbackUser = null) => {
    if (!userId || !isSupabaseConfigured) {
      setProfile(null);
      return null;
    }

    try {
      const { data, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr) {
        console.error("Error fetching profile:", profileErr);
        // Fallback profile if row hasn't synced yet
        if (fallbackUser) {
          const fallback = {
            id: fallbackUser.id,
            name: fallbackUser.user_metadata?.name || fallbackUser.email?.split("@")[0] || "User",
            email: fallbackUser.email,
            role: "member",
          };
          setProfile(fallback);
          return fallback;
        }
        return null;
      }

      if (data) {
        setProfile(data);
        return data;
      } else if (fallbackUser) {
        // Attempt to create profile if missing
        const newProfile = {
          id: fallbackUser.id,
          name: fallbackUser.user_metadata?.name || fallbackUser.email?.split("@")[0] || "User",
          email: fallbackUser.email,
          role: "member",
        };
        await supabase.from("profiles").upsert(newProfile);
        setProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      console.error("Profile fetch exception:", err);
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen to real-time auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email, password) => {
    setError(null);
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured yet. Please configure your .env file.");
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      throw signInErr;
    }

    setUser(data.user);
    const prof = await fetchProfile(data.user.id, data.user);
    return { user: data.user, profile: prof };
  };

  const signUp = async (name, email, password) => {
    setError(null);
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured yet. Please configure your .env file.");
    }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      throw signUpErr;
    }

    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id, data.user);
      return { user: data.user, profile: prof, session: data.session };
    }

    return data;
  };

  const signOut = async () => {
    setError(null);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const updateProfileName = async (newName) => {
    if (!user || !isSupabaseConfigured) return;
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ name: newName.trim() })
      .eq("id", user.id);

    if (updateErr) throw updateErr;
    await fetchProfile(user.id);
  };

  const role = profile?.role || "member";
  const isAdmin = role === "admin";

  const value = {
    user,
    profile,
    role,
    isAdmin,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => (user ? fetchProfile(user.id, user) : Promise.resolve(null)),
    updateProfileName,
    isConfigured: isSupabaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
