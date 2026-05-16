import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PageHeader } from "../../../components/PageHeader";
import { colors, radii, shadowCard, space } from "../../../theme/tokens";
import { listAllowedDashboards } from "../api";
import { EmbedPanel } from "../components/EmbedPanel";
import type { Dashboard } from "../types";
import { listViewPreferences, type ViewMode, VIEW_MODES, upsertViewPreference } from "../viewPreferences";

const modeLabel: Record<ViewMode, string> = {
  default: "Default",
  "fit-width": "Fit width",
  "fit-page": "Fit page",
  fullscreen: "Fullscreen",
};

export function ViewerScreen() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [viewModes, setViewModes] = useState<Record<string, ViewMode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listAllowedDashboards();
        setDashboards(data);
        const preferenceMap = await listViewPreferences(data.map((item) => item.id));
        setViewModes(() => {
          const merged: Record<string, ViewMode> = {};
          for (const item of data) {
            merged[item.id] = preferenceMap[item.id] ?? "default";
          }
          return merged;
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const setModeForDashboard = async (dashboardId: string, mode: ViewMode) => {
    setSaveWarning(null);
    setViewModes((previous) => ({
      ...previous,
      [dashboardId]: mode,
    }));

    try {
      await upsertViewPreference(dashboardId, mode);
    } catch {
      setSaveWarning("Could not save dashboard view mode. Your temporary mode is still applied.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.DEFAULT} />
        <Text style={styles.muted}>Loading dashboards…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorInline}>
          <Text style={styles.errorTitle}>Could not load dashboards</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={dashboards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              title="Published dashboards"
              subtitle="Reports available for your role. Embedded securely below."
            />
            {saveWarning ? (
              <View style={styles.warningInline}>
                <Text style={styles.warningText}>{saveWarning}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No dashboards yet</Text>
            <Text style={styles.emptyBody}>When content is published for your role, it will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <View style={styles.modeWrap}>
              <Text style={styles.modeLabel}>View mode</Text>
              <View style={styles.modeRow}>
                {VIEW_MODES.map((mode) => {
                  const active = (viewModes[item.id] ?? "default") === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => {
                        void setModeForDashboard(item.id, mode);
                      }}
                      style={[styles.modeButton, active ? styles.modeButtonActive : undefined]}
                    >
                      <Text style={[styles.modeButtonText, active ? styles.modeButtonTextActive : undefined]}>
                        {modeLabel[mode]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <EmbedPanel embedUrl={item.power_bi_embed_url} viewMode={viewModes[item.id] ?? "default"} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.page,
  },
  listContent: {
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  headerWrap: {
    gap: space.sm,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.bg.page,
  },
  muted: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  errorInline: {
    maxWidth: 400,
    padding: space.lg,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: space.xs,
  },
  errorBody: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
    gap: space.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.secondary,
  },
  modeWrap: {
    gap: space.sm,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  modeButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  modeButtonActive: {
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.soft,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: colors.accent.hover,
  },
  warningInline: {
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.warning.soft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning.border,
  },
  warningText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  emptyCard: {
    marginHorizontal: space.lg,
    padding: space.xl,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.default,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: space.xs,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
});
