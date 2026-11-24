import { symbolIcon } from "../../lib/customIcon";
import type { Profile } from "../browser/types";

export const PROFILE_SYMBOLS: { name: string; title: string }[] = [
  { name: "house.fill", title: "Home" },
  { name: "briefcase.fill", title: "Work" },
  { name: "graduationcap.fill", title: "School" },
  { name: "chevron.left.forwardslash.chevron.right", title: "Code" },
  { name: "paintpalette.fill", title: "Art" },
  { name: "hammer.fill", title: "Projects" },
  { name: "book.closed.fill", title: "Reading" },
  { name: "music.note", title: "Music" },
  { name: "camera.fill", title: "Photos" },
  { name: "gamecontroller.fill", title: "Games" },
  { name: "cart.fill", title: "Shopping" },
  { name: "banknote.fill", title: "Finance" },
  { name: "airplane", title: "Travel" },
  { name: "figure.run", title: "Fitness" },
  { name: "cup.and.saucer.fill", title: "Café" },
  { name: "leaf.fill", title: "Nature" },
  { name: "pawprint.fill", title: "Pets" },
  { name: "heart.fill", title: "Personal" },
  { name: "star.fill", title: "Favorites" },
  { name: "moon.stars.fill", title: "Evenings" },
  { name: "person.fill", title: "Me" },
  { name: "person.2.fill", title: "Family" },
  { name: "building.2.fill", title: "Office" },
  { name: "terminal.fill", title: "Terminal" },
  { name: "server.rack", title: "Servers" },
  { name: "flask.fill", title: "Lab" },
  { name: "lightbulb.fill", title: "Ideas" },
  { name: "sparkles", title: "Side Projects" },
  { name: "newspaper.fill", title: "News" },
  { name: "film.fill", title: "Movies" },
  { name: "headphones", title: "Podcasts" },
  { name: "sportscourt.fill", title: "Sports" },
  { name: "bicycle", title: "Cycling" },
  { name: "fork.knife", title: "Food" },
  { name: "gift.fill", title: "Gifts" },
  { name: "stethoscope", title: "Health" },
  { name: "chart.line.uptrend.xyaxis", title: "Stocks" },
  { name: "envelope.fill", title: "Mail" },
  { name: "bubble.left.and.bubble.right.fill", title: "Chat" },
  { name: "calendar", title: "Calendar" },
  { name: "mountain.2.fill", title: "Outdoors" },
  { name: "beach.umbrella.fill", title: "Holiday" },
  { name: "lock.fill", title: "Private" },
  { name: "flame.fill", title: "Hot" },
  { name: "bolt.fill", title: "Energy" },
];

export const unusedProfileIcon = (profiles: Record<string, Pick<Profile, "icon">>): string => {
  const used = new Set(Object.values(profiles).map((p) => p.icon));
  const name = PROFILE_SYMBOLS.find((s) => !used.has(symbolIcon(s.name)))?.name ?? PROFILE_SYMBOLS[0]!.name;
  return symbolIcon(name);
};
