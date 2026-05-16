import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../../lib/supabase";
import type { Dashboard } from "./types";

interface UsePendingReviewNotificationsParams {
  userId: string;
  onEvent?: (dashboard: Dashboard) => void;
}

export function usePendingReviewNotifications({
  userId,
  onEvent,
}: UsePendingReviewNotificationsParams) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dashboards-in-charge-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dashboards",
          filter: `in_charge_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Dashboard;
          if (row.status !== "Pending_Review") {
            return;
          }

          const message = `Dashboard "${row.title}" is pending your review.`;
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(message);
          } else {
            Alert.alert("Approval Required", message);
          }

          onEvent?.(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dashboards",
          filter: `in_charge_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Dashboard;
          if (row.status !== "Pending_Review") {
            return;
          }

          const message = `Dashboard "${row.title}" is pending your review.`;
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(message);
          } else {
            Alert.alert("Approval Required", message);
          }

          onEvent?.(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onEvent]);
}
