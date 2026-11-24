import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { Button, Panel, lineHeight, radius, shadow, space, Symbol, Text, springs } from "../ui";
import { useTheme } from "../ui/theme";
import { useOnboarding } from "../../state/onboarding/onboarding";
import { useTour } from "../../state/onboarding/tour";
import {
  dismissSpacesTip,
  markSpacesTipShown,
  spacesTipDue,
  spacesTipOnboardingDone,
  useSpacesTip,
} from "../../state/profiles/spacesTip";
import { useProfileDotsShown } from "./ProfileDots";

export const SPACES_TIP_COPY = {
  title: "Spaces in Half Dome",
  body: "Each Space keeps its own tabs and look. Right-click one below to change its icon, name or theme colour.",
  action: "Got it",
} as const;

const TIP_GAP = space.m;
const TIP_INSET = space.l;
const APPEAR_DELAY_MS = 900;

export function SpacesTip({ windowId, bottom, width }: { windowId: string; bottom: number; width: number }) {
  const dismissed = useSpacesTip((s) => s.dismissedAt !== null);
  const switcherShown = useProfileDotsShown();
  const onboardingOpen = useOnboarding((s) => s.windowId !== null);
  const tourActive = useTour((s) => s.windowId === windowId && s.stops.length > 0);
  const onboardingDone = !onboardingOpen && spacesTipOnboardingDone();
  const due = spacesTipDue({ dismissed, onboardingDone, switcherShown, tourActive });
  if (!due) return null;
  return <TipCard windowId={windowId} bottom={bottom} width={width} />;
}

function TipCard({ windowId, bottom, width }: { windowId: string; bottom: number; width: number }) {
  const theme = useTheme();
  const appear = useRef(new Animated.Value(0)).current;
  const cardWidth = Math.min(width - TIP_INSET * 2, 220);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      markSpacesTipShown();
      Animated.spring(appear, { toValue: 1, ...springs.smooth, useNativeDriver: true }).start();
    }, APPEAR_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appear, windowId]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: TIP_INSET,
        width: cardWidth,
        bottom: bottom + TIP_GAP,
        opacity: appear,
        transform: [
          { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
        ],
      }}
    >
      <Panel radius={radius.panel} shadow={shadow.card} style={CARD}>
        <View style={HEADER}>
          <Symbol name="square.stack" size={12} color={theme.icon} style={ICON} />
          <Text size="small" weight="semibold" style={FILL}>
            {SPACES_TIP_COPY.title}
          </Text>
          <Button variant="close" look="panel" tooltip="Dismiss" onPress={() => dismissSpacesTip("gotIt")} style={CLOSE} />
        </View>
        <Text size="caption" tone="textSecondary" style={BODY}>
          {SPACES_TIP_COPY.body}
        </Text>
        <Button variant="pill" tone="prompt" title={SPACES_TIP_COPY.action} onPress={() => dismissSpacesTip("gotIt")} />
      </Panel>
    </Animated.View>
  );
}

const CARD = { padding: space.ml, gap: space.s } as const;
const HEADER = { flexDirection: "row" as const, alignItems: "center" as const, gap: space.s };
const FILL = { flex: 1 } as const;
const ICON = { width: 16, height: 16 } as const;
const CLOSE = { marginVertical: -space.xs, marginRight: -space.xs } as const;
const BODY = { lineHeight: lineHeight.caption } as const;
