import { useRef, useState, type ReactNode } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radii, shadowCard, space } from "../../../theme/tokens";
import { approveDashboard, rejectDashboard } from "../api";
import { EmbedPanel } from "./EmbedPanel";
import type { Dashboard } from "../types";

interface ApprovalDashboardProps {
  dashboards: Dashboard[];
  onChanged: () => void;
  header?: ReactNode;
}

export function ApprovalDashboard({ dashboards, onChanged, header }: ApprovalDashboardProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});
  const actionLockRef = useRef(false);

  function notify(title: string, body: string) {
    const fullMessage = `${title}: ${body}`;
    setMessage(fullMessage);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(fullMessage);
    } else {
      Alert.alert(title, body);
    }
  }

  async function onApprove(id: string) {
    if (actionLockRef.current) return;
    if (resolvedIds[id]) return;
    try {
      actionLockRef.current = true;
      setBusyId(id);
      setRejectingId(null);
      setReason("");
      setMessage(null);
      await approveDashboard(id);
      setResolvedIds((prev) => ({ ...prev, [id]: true }));
      notify("Approved", "Dashboard has been published.");
      await onChanged();
    } catch (error) {
      notify("Approval failed", (error as Error).message);
    } finally {
      actionLockRef.current = false;
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    if (actionLockRef.current) return;
    if (resolvedIds[id]) return;
    try {
      if (!reason.trim()) {
        notify("Reject failed", "Rejection reason is required.");
        return;
      }
      actionLockRef.current = true;
      setBusyId(id);
      setMessage(null);
      await rejectDashboard(id, reason);
      setResolvedIds((prev) => ({ ...prev, [id]: true }));
      setRejectingId(null);
      setReason("");
      notify("Rejected", "Dashboard has been rejected.");
      await onChanged();
    } catch (error) {
      notify("Reject failed", (error as Error).message);
    } finally {
      actionLockRef.current = false;
      setBusyId(null);
    }
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      {header}
      {message ? (
        <View style={styles.flashBanner}>
          <Text style={styles.flashText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={dashboards}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>✓</Text>
          <Text style={styles.emptyTitle}>{"You're all caught up"}</Text>
          <Text style={styles.emptyBody}>No dashboards are waiting for your review right now.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.statusDot} />
            <Text style={styles.pendingLabel}>Pending review</Text>
          </View>
          <Text style={styles.title}>{item.title}</Text>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          <EmbedPanel embedUrl={item.power_bi_embed_url} viewMode="default" />

          {resolvedIds[item.id] ? (
            <View style={styles.doneBanner}>
              <Text style={styles.doneText}>Submitted — refreshing…</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [
                  styles.approveBtn,
                  pressed && styles.btnPressed,
                  busyId === item.id && styles.btnDisabled,
                ]}
                onPress={() => void onApprove(item.id)}
                disabled={busyId === item.id}
              >
                <Text style={styles.btnTextPrimary}>
                  {busyId === item.id ? "Approving…" : "Approve"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.rejectBtn,
                  pressed && styles.btnPressed,
                  busyId === item.id && styles.btnDisabled,
                ]}
                onPress={() => setRejectingId((prev) => (prev === item.id ? null : item.id))}
                disabled={busyId === item.id}
              >
                <Text style={styles.btnTextDanger}>Reject</Text>
              </Pressable>
            </View>
          )}

          {rejectingId === item.id && !resolvedIds[item.id] ? (
            <View style={styles.rejectBox}>
              <Text style={styles.rejectLabel}>Rejection reason</Text>
              <TextInput
                placeholder="Explain what needs to change before this can go live…"
                placeholderTextColor={colors.text.muted}
                value={reason}
                onChangeText={setReason}
                style={styles.input}
                multiline
                maxLength={500}
              />
              <Text style={styles.helperText}>
                {reason.length}/500 · visible to reviewers with access
              </Text>
              <View style={styles.rejectFooterRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelRejectBtn,
                    pressed && styles.btnPressed,
                    busyId === item.id && styles.btnDisabled,
                  ]}
                  onPress={() => {
                    setRejectingId(null);
                    setReason("");
                  }}
                  disabled={busyId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel rejection and go back"
                >
                  <Text style={styles.cancelRejectBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmRejectBtn,
                    styles.confirmRejectBtnFlex,
                    pressed && styles.btnPressed,
                    busyId === item.id && styles.btnDisabled,
                  ]}
                  onPress={() => void onReject(item.id)}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.btnTextPrimary}>
                    {busyId === item.id ? "Rejecting…" : "Confirm reject"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: space.md,
    marginBottom: space.sm,
  },
  listContainer: {
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  flashBanner: {
    marginHorizontal: space.lg,
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent.soft,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  flashText: {
    fontSize: 14,
    color: colors.accent.hover,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
    gap: space.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  pendingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.secondary,
  },
  row: {
    flexDirection: "row",
    gap: space.md,
    flexWrap: "wrap",
  },
  approveBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.success.DEFAULT,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: "center",
  },
  rejectBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.bg.surface,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.danger.DEFAULT,
  },
  confirmRejectBtn: {
    backgroundColor: colors.danger.DEFAULT,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
  },
  confirmRejectBtnFlex: {
    flex: 1,
    minWidth: 140,
  },
  rejectFooterRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space.md,
    marginTop: space.xs,
  },
  cancelRejectBtn: {
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
    minWidth: 100,
  },
  cancelRejectBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  btnPressed: {
    opacity: 0.92,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnTextPrimary: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 15,
  },
  btnTextDanger: {
    color: colors.danger.DEFAULT,
    fontWeight: "700",
    fontSize: 15,
  },
  rejectBox: {
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  rejectLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: space.md,
    minHeight: 96,
    textAlignVertical: "top",
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.bg.muted,
  },
  helperText: {
    color: colors.text.muted,
    fontSize: 12,
  },
  doneBanner: {
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.success.soft,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  doneText: {
    color: "#166534",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  emptyWrap: {
    marginHorizontal: space.lg,
    marginTop: space.xl,
    padding: space.xl,
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.default,
  },
  emptyEmoji: {
    fontSize: 28,
    marginBottom: space.sm,
    opacity: 0.35,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: space.xs,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
});
