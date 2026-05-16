import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PageHeader } from "../../../components/PageHeader";
import { colors, radii, shadowCard, space } from "../../../theme/tokens";
import {
  createPublisherDashboard,
  listInChargeOptionsForPublisher,
  listPublisherDashboards,
  listTargetRoles,
  updatePublisherDashboard,
  withdrawPendingDashboard,
} from "../api";
import { EmbedPanel } from "../components/EmbedPanel";
import type { Dashboard, InChargeOption } from "../types";
import { listViewPreferences, type ViewMode, VIEW_MODES, upsertViewPreference } from "../viewPreferences";

type DraftForm = {
  title: string;
  description: string;
  power_bi_embed_url: string;
};

function canEdit(status: Dashboard["status"]) {
  return status === "Draft" || status === "Rejected";
}

export function PublisherScreen() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [inChargeOptions, setInChargeOptions] = useState<InChargeOption[]>([]);
  const [targetRoleId, setTargetRoleId] = useState("");
  const [newDashboard, setNewDashboard] = useState<DraftForm>({
    title: "",
    description: "",
    power_bi_embed_url: "",
  });
  const [newInChargeId, setNewInChargeId] = useState("");
  const [formById, setFormById] = useState<Record<string, DraftForm>>({});
  const [viewModes, setViewModes] = useState<Record<string, ViewMode>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, inChargeList, targetRoles] = await Promise.all([
        listPublisherDashboards(),
        listInChargeOptionsForPublisher(),
        listTargetRoles(),
      ]);
      setDashboards(data);
      setInChargeOptions(inChargeList);
      if (!newInChargeId && inChargeList[0]) {
        setNewInChargeId(inChargeList[0].id);
      }
      if (!targetRoleId && targetRoles[0]) {
        setTargetRoleId(targetRoles[0].id);
      }
      const preferenceMap = await listViewPreferences(data.map((item) => item.id));
      setViewModes(() => {
        const merged: Record<string, ViewMode> = {};
        for (const item of data) {
          merged[item.id] = preferenceMap[item.id] ?? "default";
        }
        return merged;
      });
      setFormById((prev) => {
        const next: Record<string, DraftForm> = { ...prev };
        for (const row of data) {
          next[row.id] = next[row.id] ?? {
            title: row.title,
            description: row.description ?? "",
            power_bi_embed_url: row.power_bi_embed_url,
          };
        }
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [newInChargeId, targetRoleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedDashboards = useMemo(
    () =>
      [...dashboards].sort((a, b) => {
        if (a.status === "Rejected" && b.status !== "Rejected") return -1;
        if (a.status !== "Rejected" && b.status === "Rejected") return 1;
        return 0;
      }),
    [dashboards],
  );

  const patchForm = (id: string, patch: Partial<DraftForm>) => {
    setFormById((prev) => ({
      ...prev,
      [id]: {
        title: prev[id]?.title ?? "",
        description: prev[id]?.description ?? "",
        power_bi_embed_url: prev[id]?.power_bi_embed_url ?? "",
        ...patch,
      },
    }));
  };

  const submit = async (row: Dashboard, status: "Draft" | "Pending_Review") => {
    const form = formById[row.id];
    if (!form) return;
    try {
      setBusyId(row.id);
      setError(null);
      setNotice(null);
      await updatePublisherDashboard(row.id, {
        title: form.title,
        description: form.description,
        power_bi_embed_url: form.power_bi_embed_url,
        status,
      });
      setNotice(status === "Draft" ? "Draft saved." : "Submitted for review.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (dashboardId: string) => {
    try {
      setBusyId(dashboardId);
      setError(null);
      setNotice(null);
      await withdrawPendingDashboard(dashboardId);
      setNotice("Submission withdrawn back to Draft.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const createNewDashboard = async () => {
    try {
      setBusyId("new");
      setError(null);
      setNotice(null);
      await createPublisherDashboard({
        title: newDashboard.title,
        description: newDashboard.description,
        power_bi_embed_url: newDashboard.power_bi_embed_url,
        target_role_id: targetRoleId,
        in_charge_id: newInChargeId,
      });
      setNewDashboard({
        title: "",
        description: "",
        power_bi_embed_url: "",
      });
      setNotice("New dashboard created as Draft.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const setModeForDashboard = async (dashboardId: string, mode: ViewMode) => {
    setViewModes((previous) => ({
      ...previous,
      [dashboardId]: mode,
    }));
    try {
      await upsertViewPreference(dashboardId, mode);
    } catch {
      setNotice("View mode changed temporarily but could not be saved.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.DEFAULT} />
        <Text style={styles.muted}>Loading your dashboards…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={sortedDashboards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              title="Publisher workspace"
              subtitle="Edit your draft/rejected dashboards, then submit for review."
            />
            {notice ? (
              <View style={styles.noticeInline}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorInline}>
                <Text style={styles.errorTitle}>Action failed</Text>
                <Text style={styles.errorBody}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create dashboard</Text>
              <Text style={styles.label}>Title</Text>
              <TextInput
                value={newDashboard.title}
                onChangeText={(value) => setNewDashboard((prev) => ({ ...prev, title: value }))}
                style={styles.input}
              />
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={newDashboard.description}
                onChangeText={(value) => setNewDashboard((prev) => ({ ...prev, description: value }))}
                style={[styles.input, styles.inputMultiline]}
                multiline
              />
              <Text style={styles.label}>Power BI embed URL</Text>
              <TextInput
                value={newDashboard.power_bi_embed_url}
                onChangeText={(value) => setNewDashboard((prev) => ({ ...prev, power_bi_embed_url: value }))}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Assign In-Charge</Text>
              <View style={styles.choiceRow}>
                {inChargeOptions.map((option) => {
                  const active = newInChargeId === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setNewInChargeId(option.id)}
                      style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.full_name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {inChargeOptions.length === 0 ? (
                <Text style={styles.helperText}>
                  No In-Charge users are visible for your department yet. Ask SuperAdmin to assign an
                  `InCharge` profile in your department.
                </Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (pressed || busyId === "new") && styles.btnDisabled]}
                disabled={busyId === "new" || inChargeOptions.length === 0 || !newInChargeId}
                onPress={() => void createNewDashboard()}
              >
                <Text style={styles.primaryBtnText}>
                  {busyId === "new" ? "Creating…" : "Create as Draft"}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No publisher dashboards yet</Text>
            <Text style={styles.emptyBody}>Ask SuperAdmin to create an assigned dashboard for you.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const editable = canEdit(item.status);
          const form = formById[item.id] ?? {
            title: item.title,
            description: item.description,
            power_bi_embed_url: item.power_bi_embed_url,
          };

          return (
            <View style={styles.card}>
              <View style={styles.rowTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.statusPill}>{item.status}</Text>
              </View>
              {item.status === "Rejected" && item.rejection_reason ? (
                <View style={styles.rejectNote}>
                  <Text style={styles.rejectNoteTitle}>Rejected reason</Text>
                  <Text style={styles.rejectNoteBody}>{item.rejection_reason}</Text>
                </View>
              ) : null}
              <View style={styles.modeWrap}>
                <Text style={styles.modeLabel}>Preview mode</Text>
                <View style={styles.choiceRow}>
                  {VIEW_MODES.map((mode) => {
                    const active = (viewModes[item.id] ?? "default") === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => {
                          void setModeForDashboard(item.id, mode);
                        }}
                        style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{mode}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <EmbedPanel embedUrl={item.power_bi_embed_url} viewMode={viewModes[item.id] ?? "default"} />
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                value={form.title}
                onChangeText={(value) => patchForm(item.id, { title: value })}
                style={[styles.input, !editable && styles.inputDisabled]}
                editable={editable && busyId !== item.id}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={form.description}
                onChangeText={(value) => patchForm(item.id, { description: value })}
                style={[styles.input, styles.inputMultiline, !editable && styles.inputDisabled]}
                multiline
                editable={editable && busyId !== item.id}
              />

              <Text style={styles.label}>Power BI embed URL</Text>
              <TextInput
                value={form.power_bi_embed_url}
                onChangeText={(value) => patchForm(item.id, { power_bi_embed_url: value })}
                style={[styles.input, !editable && styles.inputDisabled]}
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable && busyId !== item.id}
              />

              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    (pressed || busyId === item.id || !editable) && styles.btnDisabled,
                  ]}
                  onPress={() => void submit(item, "Draft")}
                  disabled={busyId === item.id || !editable}
                >
                  <Text style={styles.secondaryBtnText}>Save draft</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (pressed || busyId === item.id || !editable) && styles.btnDisabled,
                  ]}
                  onPress={() => void submit(item, "Pending_Review")}
                  disabled={busyId === item.id || !editable}
                >
                  <Text style={styles.primaryBtnText}>
                    {busyId === item.id ? "Submitting…" : "Submit for review"}
                  </Text>
                </Pressable>
                {item.status === "Pending_Review" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      (pressed || busyId === item.id) && styles.btnDisabled,
                    ]}
                    onPress={() => void withdraw(item.id)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.secondaryBtnText}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
              {!editable ? (
                <Text style={styles.helperText}>
                  This dashboard is locked in `{item.status}`. Edit when status is Draft or Rejected.
                </Text>
              ) : null}
            </View>
          );
        }}
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
  listContent: {
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  headerWrap: {
    gap: space.sm,
  },
  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
    gap: space.sm,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },
  statusPill: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.secondary,
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  rejectNote: {
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.warning.soft,
    borderWidth: 1,
    borderColor: colors.warning.border,
    gap: space.xs,
  },
  rejectNoteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
  },
  rejectNoteBody: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: space.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.bg.muted,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  inputDisabled: {
    opacity: 0.65,
  },
  buttonRow: {
    marginTop: space.sm,
    flexDirection: "row",
    gap: space.sm,
    flexWrap: "wrap",
  },
  modeWrap: {
    gap: space.sm,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  choiceRow: {
    flexDirection: "row",
    gap: space.sm,
    flexWrap: "wrap",
  },
  choiceBtn: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.full,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    backgroundColor: colors.bg.surface,
  },
  choiceBtnActive: {
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.soft,
  },
  choiceText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  choiceTextActive: {
    color: colors.accent.hover,
  },
  primaryBtn: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.text.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  helperText: {
    marginTop: space.xs,
    fontSize: 12,
    color: colors.text.muted,
  },
  errorInline: {
    marginHorizontal: space.lg,
    padding: space.md,
    backgroundColor: colors.danger.soft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger.dark,
    marginBottom: space.xs,
  },
  errorBody: {
    fontSize: 13,
    color: colors.danger.dark,
  },
  noticeInline: {
    marginHorizontal: space.lg,
    padding: space.md,
    backgroundColor: colors.accent.soft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  noticeText: {
    fontSize: 13,
    color: colors.accent.hover,
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
