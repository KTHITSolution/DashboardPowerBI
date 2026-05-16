import { createElement, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radii, shadowCard, space } from "../../../theme/tokens";
import type { ViewMode } from "../viewPreferences";

interface EmbedPanelProps {
  embedUrl: string;
  viewMode: ViewMode;
}

function getMobilePowerBiHtml(embedUrl: string, viewMode: ViewMode) {
  return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/powerbi-client@2.23.1/dist/powerbi.min.js"></script>
    <style>
      html, body, #embedContainer {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <div id="embedContainer"></div>
    <script>
      (function () {
        var container = document.getElementById('embedContainer');
        var embedUrl = '${embedUrl}';
        var viewMode = '${viewMode}';
        var tokenFromUrl = '';
        try {
          var parsed = new URL(embedUrl);
          tokenFromUrl = parsed.searchParams.get('access_token') || '';
        } catch (e) {}

        function fallbackIframe() {
          container.innerHTML = '<iframe src="' + embedUrl + '" style="border:0;width:100%;height:100%" allowfullscreen title="Power BI Dashboard"></iframe>';
        }

        if (!window['powerbi-client'] || !window.powerbi) {
          fallbackIframe();
          return;
        }

        try {
          var models = window['powerbi-client'].models;
          var powerbi = window.powerbi;
          var config = {
            type: 'report',
            embedUrl: embedUrl,
            tokenType: models.TokenType.Embed,
            accessToken: tokenFromUrl,
            settings: {
              layoutType: models.LayoutType.MobilePortrait
            }
          };

          if (viewMode === 'fit-page') {
            config.settings.customLayout = {
              displayOption: models.DisplayOption.FitToPage
            };
          } else if (viewMode === 'fit-width') {
            config.settings.customLayout = {
              displayOption: models.DisplayOption.FitToWidth
            };
          }

          powerbi.embed(container, config);
        } catch (err) {
          fallbackIframe();
        }
      })();
    </script>
  </body>
</html>`;
}

function getWebIframeStyle(): Record<string, unknown> {
  return {
    border: 0,
    width: "100%",
    height: "100%",
  };
}

function getContainerHeight(viewMode: ViewMode): number {
  switch (viewMode) {
    case "fit-page":
      return 560;
    case "fit-width":
      return 460;
    case "fullscreen":
      return 680;
    default:
      return 380;
  }
}

function withDisplayMode(embedUrl: string, viewMode: ViewMode): string {
  if (!embedUrl) {
    return embedUrl;
  }

  try {
    const parsed = new URL(embedUrl);
    if (viewMode === "fit-page") {
      parsed.searchParams.set("pageView", "fitToPage");
    } else if (viewMode === "fit-width") {
      parsed.searchParams.set("pageView", "fitToWidth");
    } else {
      parsed.searchParams.delete("pageView");
    }
    return parsed.toString();
  } catch (_err) {
    return embedUrl;
  }
}

export function EmbedPanel({ embedUrl, viewMode }: EmbedPanelProps) {
  const mobileHtml = useMemo(() => getMobilePowerBiHtml(embedUrl, viewMode), [embedUrl, viewMode]);
  const webContainerRef = useRef<HTMLElement | null>(null);
  const embedSrc = useMemo(() => withDisplayMode(embedUrl, viewMode), [embedUrl, viewMode]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const container = webContainerRef.current;
    const doc = typeof document !== "undefined" ? document : null;
    if (!container || !doc) {
      return;
    }

    if (viewMode === "fullscreen" && doc.fullscreenElement !== container && container.requestFullscreen) {
      void container.requestFullscreen().catch(() => undefined);
      return;
    }

    if (viewMode !== "fullscreen" && doc.fullscreenElement === container && doc.exitFullscreen) {
      void doc.exitFullscreen().catch(() => undefined);
    }
  }, [viewMode]);

  if (!embedUrl) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No embed URL</Text>
        <Text style={styles.emptyBody}>Add a Power BI embed link for this dashboard.</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    const height = getContainerHeight(viewMode);
    return (
      <View style={styles.wrap}>
        <View style={styles.chrome}>
          <View style={styles.chromeDot} />
          <View style={styles.chromeDot} />
          <View style={styles.chromeDot} />
          <Text style={styles.chromeLabel}>Preview</Text>
        </View>
        <View
          style={[
            styles.container,
            {
              height,
            },
          ]}
        >
          {createElement(
            "div",
            {
              ref: webContainerRef,
              style: {
                width: "100%",
                height: "100%",
              },
            },
            createElement("iframe", {
              src: embedSrc,
              style: getWebIframeStyle(),
              allowFullScreen: true,
              title: "Power BI Dashboard",
            }),
          )}
        </View>
      </View>
    );
  }

  const containerHeight = getContainerHeight(viewMode);

  return (
    <View style={styles.wrap}>
      <View style={styles.chrome}>
        <View style={styles.chromeDot} />
        <View style={styles.chromeDot} />
        <View style={styles.chromeDot} />
        <Text style={styles.chromeLabel}>Mobile layout</Text>
      </View>
      <View
        style={[
          styles.container,
          {
            height: containerHeight,
          },
        ]}
      >
        <WebView
          source={{ html: mobileHtml }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  chrome: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm,
  },
  chromeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.default,
  },
  chromeLabel: {
    marginLeft: space.sm,
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  container: {
    width: "100%",
    height: 380,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadowCard,
  },
  webview: {
    flex: 1,
  },
  emptyState: {
    padding: space.lg,
    borderRadius: radii.md,
    backgroundColor: colors.warning.soft,
    borderWidth: 1,
    borderColor: colors.warning.border,
    gap: space.xs,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});
