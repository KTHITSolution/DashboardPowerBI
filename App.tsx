import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { getCurrentProfile } from "./src/features/dashboards/api";
import { InChargeScreen } from "./src/features/dashboards/screens/InChargeScreen";
import { PublisherScreen } from "./src/features/dashboards/screens/PublisherScreen";
import { ViewerScreen } from "./src/features/dashboards/screens/ViewerScreen";
import type { Profile } from "./src/features/dashboards/types";
import { supabase } from "./src/lib/supabase";
import { colors, radii, shadowCard, shadowHeader, space } from "./src/theme/tokens";

function AuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    try {
      setSubmitting(true);
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <ScrollView
      contentContainerStyle={styles.authScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.authBrand}>
        <View style={styles.authLogoMark}>
          <Text style={styles.authLogoGlyph}>BI</Text>
        </View>
        <Text style={styles.authProductName}>Secure Portal</Text>
        <Text style={styles.authTagline}>Power BI dashboards with role-based access</Text>
      </View>

      <View style={styles.authCard}>
        <Text style={styles.authCardTitle}>Sign in</Text>
        <Text style={styles.authCardHint}>Use your organization account</Text>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@company.com"
          placeholderTextColor={colors.text.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.text.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={() => void onSignIn()}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Signing in…" : "Continue"}</Text>
        </Pressable>
      </View>

      <Text style={styles.authFooter}>Protected by Supabase Auth</Text>
    </ScrollView>
  );

  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView style={styles.authRoot} behavior="padding">
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.authRoot}>{content}</View>;
}

function TopBar({ fullName, roleName, onSignOut }: { fullName: string; roleName: string; onSignOut: () => void }) {
  const initial = fullName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarUser}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.topBarTextCol}>
          <Text style={styles.topBarName} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleName}</Text>
          </View>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
        onPress={() => void onSignOut()}
      >
        <Text style={styles.outlineButtonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [activePanel, setActivePanel] = useState<"approval" | "viewer">("approval");

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setNeedsAuth(false);
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);
    } catch (err) {
      const message = (err as Error).message;
      const lowerMessage = message.toLowerCase();
      const isAuthMissing =
        lowerMessage.includes("authenticated") ||
        lowerMessage.includes("auth session missing") ||
        lowerMessage.includes("not logged in") ||
        lowerMessage.includes("jwt");
      if (isAuthMissing) {
        setNeedsAuth(true);
        setProfile(null);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.accent.DEFAULT} />
        <Text style={styles.loadingText}>Loading your workspace…</Text>
      </View>
    );
  }

  if (needsAuth) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <AuthGate onSignedIn={() => void loadProfile()} />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.errorRoot}>
        <StatusBar style="dark" />
        <View style={styles.errorCard}>
          <Text style={styles.errorCardTitle}>Something went wrong</Text>
          <Text style={styles.errorCardBody}>{error ?? "No profile found."}</Text>
        </View>
      </View>
    );
  }

  const roleName = profile.role?.role_name ?? "";
  const isInCharge = roleName === "InCharge" || roleName === "SuperAdmin";
  const isPublisher = roleName === "Publisher" || roleName === "Publisher_Department" || roleName === "Publisher_Global";
  const canUseApprovalPanel = isInCharge;

  async function onSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <TopBar fullName={profile.full_name} roleName={roleName} onSignOut={onSignOut} />
      {isInCharge ? (
        <View style={styles.panelSwitchRow}>
          <Pressable
            style={({ pressed }) => [
              styles.panelSwitchBtn,
              activePanel === "approval" && styles.panelSwitchBtnActive,
              pressed && styles.panelSwitchBtnPressed,
            ]}
            onPress={() => setActivePanel("approval")}
          >
            <Text
              style={[
                styles.panelSwitchBtnText,
                activePanel === "approval" && styles.panelSwitchBtnTextActive,
              ]}
            >
              Approval
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.panelSwitchBtn,
              activePanel === "viewer" && styles.panelSwitchBtnActive,
              pressed && styles.panelSwitchBtnPressed,
            ]}
            onPress={() => setActivePanel("viewer")}
          >
            <Text
              style={[
                styles.panelSwitchBtnText,
                activePanel === "viewer" && styles.panelSwitchBtnTextActive,
              ]}
            >
              View Dashboards
            </Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.mainFill}>
        {isPublisher ? (
          <PublisherScreen />
        ) : canUseApprovalPanel && activePanel === "approval" ? (
          <InChargeScreen userId={profile.id} />
        ) : (
          <ViewerScreen />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.page,
  },
  mainFill: {
    flex: 1,
  },
  panelSwitchRow: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  panelSwitchBtn: {
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  panelSwitchBtnActive: {
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.soft,
  },
  panelSwitchBtnPressed: {
    opacity: 0.9,
  },
  panelSwitchBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  panelSwitchBtnTextActive: {
    color: colors.accent.hover,
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    backgroundColor: colors.bg.page,
    padding: space.lg,
  },
  loadingText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: colors.bg.page,
  },
  errorCard: {
    maxWidth: 400,
    width: "100%",
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
  },
  errorCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: space.sm,
  },
  errorCardBody: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  authRoot: {
    flex: 1,
    backgroundColor: colors.bg.page,
  },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  authBrand: {
    alignItems: "center",
    marginBottom: space.xl,
    gap: space.sm,
  },
  authLogoMark: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  authLogoGlyph: {
    color: colors.text.inverse,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  authProductName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text.primary,
  },
  authTagline: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.xl,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
    gap: space.sm,
  },
  authCardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text.primary,
  },
  authCardHint: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: space.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.bg.muted,
  },
  errorBanner: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radii.sm,
    backgroundColor: colors.danger.soft,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    color: colors.danger.dark,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: space.lg,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonPressed: {
    backgroundColor: colors.accent.hover,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: "700",
  },
  authFooter: {
    marginTop: space.xl,
    fontSize: 12,
    color: colors.text.muted,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    ...shadowHeader,
  },
  topBarUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.accent.soft,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent.DEFAULT,
  },
  topBarTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topBarName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.bg.muted,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  outlineButton: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  outlineButtonPressed: {
    backgroundColor: colors.bg.muted,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
