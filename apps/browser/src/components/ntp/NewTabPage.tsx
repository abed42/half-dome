import { PowerUp, hex, ink, reduceMotion, springs, Surface, useTheme } from "../ui";
import { TOOLBAR_ROWS } from "../../lib/toolbarRow";
import { useEffect, useLayoutEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useWindow, useWindowId } from "../../state/browser/hooks";
import { useCardAnchors } from "../../state/windows/layout";
import { NewTabExtras } from "./NewTabExtras";
import { IncognitoHeading } from "./IncognitoHeading";
import { DIA_OFFSET, MARK_ABOVE_BAR, newTabBarTop } from "./newTabLayout";
import { useOnboarding } from "../../state/onboarding/onboarding";
import { Omnibox } from "../omnibox/Omnibox";
import { NTP_BAR } from "./tokens";
import { PLATFORM_FEATURES } from "../../lib/platformFeatures";
import { markNewTabBar } from "../../state/omnibox/newTabMarks";
import { useHeroBarFocusWhenShownAgain } from "../../state/tabs/newTabKeep";

const BAR_HEIGHT = 112;
const HALF_DOME_MARK = require("../../../assets/ntp-halfdome-mark.png");
const MARK_WIDTH = 148;
const MARK_HEIGHT = 77;
const MARK_HIDDEN = 48;

type Size = { width: number; height: number };
let lastSize: { card: Size; size: Size } | null = null;
const introPlayed = new Set<string>();


function sameSize(a: Size, b: Size) {
  return a.width === b.width && a.height === b.height;
}

export function barWidth(viewWidth: number) {
  const content = viewWidth < 708 ? (viewWidth <= 636 ? viewWidth - 20 : 616) : viewWidth < 1700 ? 652 : 774;
  return Math.min(content, viewWidth - 28);
}

export function NewTabPage({ tabId, toolbar = true, kept = false }: { tabId: string; toolbar?: boolean; kept?: boolean }) {
  const theme = useTheme();
  const windowId = useWindowId();
  const incognito = useWindow(windowId, (w) => w?.kind === "private");
  const onboarding = useOnboarding((s) => s.windowId === windowId);
  const card = useCardAnchors((s) => s[windowId]);
  useHeroBarFocusWhenShownAgain(windowId, tabId, kept);
  const [size, setSizeState] = useState<Size | null>(() => (lastSize && (!card || sameSize(lastSize.card, card)) ? lastSize.size : null));
  const setSize = (next: Size) => setSizeState((prev) => (prev && sameSize(prev, next) ? prev : next));
  useEffect(() => {
    if (size && card) lastSize = { card: { width: card.width, height: card.height }, size };
  }, [size, card?.width, card?.height]);
  const [panelHeight, setPanelHeight] = useState(BAR_HEIGHT);
  const [headingHeight, setHeadingHeight] = useState(0);
  const heading = !onboarding && incognito;
  const [playIntro] = useState(() => !introPlayed.has(tabId));
  const [restShown, setRestShown] = useState(() => !PLATFORM_FEATURES.newTabBarFirst || !playIntro);
  const showRest = () => void (restShown || requestAnimationFrame(() => setRestShown(true)));
  useLayoutEffect(() => {
    markNewTabBar("page", tabId);
    return () => markNewTabBar("gone", tabId);
  }, [tabId]);
  useLayoutEffect(() => {
    if (restShown && PLATFORM_FEATURES.newTabBarFirst) markNewTabBar("rest", tabId);
  }, [restShown]);
  const [rise] = useState(() => new Animated.Value(playIntro && !reduceMotion() ? MARK_HIDDEN : 0));
  useEffect(() => {
    introPlayed.add(tabId);
  }, [tabId]);
  useEffect(() => {
    if (!playIntro || reduceMotion()) return;
    const intro = Animated.spring(rise, { toValue: 0, delay: 80, ...springs.smooth, useNativeDriver: true });
    intro.start();
    return () => intro.stop();
  }, [playIntro, rise]);

  if (!size) return <View style={{ flex: 1 }} onLayout={(e) => setSize(e.nativeEvent.layout)} />;

  const width = barWidth(size.width);
  const x = Math.max(size.width / 2 - width / 2, 14) + DIA_OFFSET;
  const under = toolbar ? 0 : TOOLBAR_ROWS.regular.height;
  const top = newTabBarTop(size.height, under, heading ? headingHeight : 0);

  const bar = { x, y: top, width, height: panelHeight };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {restShown && playIntro && theme.powerUpPalette && (
        <PowerUp
          style={StyleSheet.absoluteFill}
          palette={theme.powerUpPalette}
          speed={1}
          origin={0.5}
          cornerRadius={NTP_BAR.radius}
          halo={bar}
        />
      )}
      {heading && <IncognitoHeading left={x} barTop={top} width={width} onHeight={setHeadingHeight} />}
      {restShown && <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: size.width / 2 + DIA_OFFSET - MARK_WIDTH / 2,
          top: top - MARK_ABOVE_BAR,
          width: MARK_WIDTH,
          height: MARK_ABOVE_BAR,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <Animated.Image
          source={HALF_DOME_MARK}
          style={{
            width: MARK_WIDTH,
            height: MARK_HEIGHT,
            transform: [{ translateY: rise }],
          }}
        />
      </View>}
      <View onLayout={(e) => (setPanelHeight(e.nativeEvent.layout.height), showRest())} style={{ position: "absolute", left: x, top, width }}>
        {restShown && NTP_BAR.shadows.map((level, i) => (
          <Surface
            key={i}
            style={StyleSheet.absoluteFill}
            fill={ink.clear}
            cornerRadius={NTP_BAR.radius}
            shadowColor={level.color}
            shadowOpacity={level.opacity}
            shadowRadius={level.radius}
            shadowOffset={level.offset}
          />
        ))}
        <Surface fill={hex(theme.ntpBarSolid)} cornerRadius={NTP_BAR.radius} style={{ padding: NTP_BAR.contentInset }}>
          {onboarding ? <View style={{ height: BAR_HEIGHT - 2 * NTP_BAR.contentInset }} /> : <Omnibox variant="hero" tabId={tabId} />}
          <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: NTP_BAR.radius, borderWidth: NTP_BAR.border, borderColor: theme.ntpBarBorder }} />
        </Surface>
      </View>
      {restShown && <NewTabExtras size={size} bar={bar} />}
    </View>
  );
}
