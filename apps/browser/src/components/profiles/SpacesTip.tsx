import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { Button, Panel, lineHeight, radius, shadow, space, Symbol, Text, springs } from "../ui";
import { useTheme } from "../ui/theme";
import { useIsIncognito } from "../../state/browser/hooks";
import { useOnboarding } from "../../state/onboarding/onboarding";
import { useTour } from "../../state/onboarding/tour";
import { requestCreateProfile } from "../../state/profiles/createProfileRequest";
import { useProfileOrder } from "../../state/profiles/hooks";
import {
  dismissSpacesTip,
  markSpacesTipShown,
  spacesTipDue,
  spacesTipOnboardingDone,
  useSpacesTip,
} from "../../state/profiles/spacesTip";
import { consentToken } from "../../state/telemetry/usageClient";

export const SPACES_TIP_COPY = {
  title: "Profiles in Half Dome",
  one: "Each Profile keeps its own tabs, look and logins. Add a second one to switch between them here.",
  many: "Each Profile keeps its own tabs and look. Right-click one below to change its icon, name or theme color.",
  gotIt: "Got it",
  add: "New Profile…",
} as const;

export function spacesTipCopy(profileCount: number) {
  const one = profileCount < 2;
  return {
    title: SPACES_TIP_COPY.title,
    body: one ? SPACES_TIP_COPY.one : SPACES_TIP_COPY.many,
    action: one ? SPACES_TIP_COPY.add : SPACES_TIP_COPY.gotIt,
  };
}

const TIP_GAP = space.m;
const TIP_INSET = space.l;
const APPEAR_DELAY_MS = 900;

export function SpacesTip({ windowId, bottom, width }: { windowId: string; bottom: number; width: number }) {
  const dismissed = useSpacesTip((s) => s.dismissedAt !== null);
  const incognito = useIsIncognito();
  const onboardingOpen = useOnboarding((s) => s.windowId !== null);
  const tourActive = useTour((s) => s.windowId === windowId && s.stops.length > 0);
  const onboardingDone = !onboardingOpen && spacesTipOnboardingDone();
  const due = !incognito && spacesTipDue({ dismissed, onboardingDone, tourActive });
  if (!due) return null;
  return <TipCard windowId={windowId} bottom={bottom} width={width} />;
}

function TipCard({ windowId, bottom, width }: { windowId: string; bottom: number; width: number }) {
  const theme = useTheme();
  const profileCount = useProfileOrder((o) => o.length);
  const copy = spacesTipCopy(profileCount);
  const appear = useRef(new Animated.Value(0)).current;
  const cardWidth = Math.min(width - TIP_INSET * 2, 220);

  useEffect(() => {
    let cancelled = false;
    const consent = consentToken();
    const timer = setTimeout(() => {
      if (cancelled) return;
      markSpacesTipShown(consent);
      Animated.spring(appear, { toValue: 1, ...springs.smooth, useNativeDriver: true }).start();
    }, APPEAR_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appear, windowId]);

  const onAction = () => {
    const consent = consentToken();
    dismissSpacesTip("gotIt", consent);
    if (profileCount < 2) void requestCreateProfile(windowId);
  };

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
          <Symbol name="person.crop.circle" size={12} color={theme.icon} style={ICON} />
          <Text size="small" weight="semibold" style={FILL}>
            {copy.title}
          </Text>
          <Button variant="close" look="panel" tooltip="Dismiss" onPress={() => dismissSpacesTip("gotIt", consentToken())} style={CLOSE} />
        </View>
        <Text size="caption" tone="textSecondary" style={BODY}>
          {copy.body}
        </Text>
        <Button variant="pill" tone="prompt" title={copy.action} onPress={onAction} />
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
