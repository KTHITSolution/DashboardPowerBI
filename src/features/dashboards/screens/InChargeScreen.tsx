import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PageHeader } from "../../../components/PageHeader";
import { colors, radii, shadowCard, space } from "../../../theme/tokens";
import { listPendingReviewForInCharge } from "../api";
import { ApprovalDashboard } from "../components/ApprovalDashboard";
import { usePendingReviewNotifications } from "../realtime";
import type { Dashboard } from "../types";

interface InChargeScreenProps {
  userId: string;
}

export function InChargeScreen({ userId }: InChargeScreenProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listPendingReviewForInCharge();
      setDashboards(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  usePendingReviewNotifications({
    userId,
    onEvent: () => {
      void load();
    },
  });

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.DEFAULT} />
        <Text style={styles.muted}>Loading pending reviews…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorInline}>
          <Text style={styles.errorTitle}>Could not load approvals</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ApprovalDashboard
        dashboards={dashboards}
        onChanged={load}
        header={
          <PageHeader
            title="Approval queue"
            subtitle="Review embedded reports, then approve or reject with a clear reason."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.page,
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
});
