import type { ImageSourcePropType } from "react-native";
import { parseBriefDate } from "../../lib/briefDates";

export type BriefArtwork = { source: ImageSourcePropType; title: string; artist: string; year: string };

export function briefDate(date?: string): Date {
  return (date ? parseBriefDate(date) : null) ?? new Date();
}

export function briefTitleForDate(date?: string): string {
  const day = briefDate(date);
  return `The ${day.toLocaleDateString("en-US", { weekday: "long" })} Brief - ${day.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

const ARTWORKS: BriefArtwork[] = [
  { source: require("../../../assets/briefs/saturn-from-titan.jpg"), title: "Saturn as Seen from Titan", artist: "Chesley Bonestell", year: "1944" },
  { source: require("../../../assets/briefs/aurora-borealis.jpg"), title: "Aurora Borealis", artist: "Frederic Edwin Church", year: "1865" },
  { source: require("../../../assets/briefs/wanderer.jpg"), title: "Wanderer above the Sea of Fog", artist: "Caspar David Friedrich", year: "1818" },
  { source: require("../../../assets/briefs/mount-corcoran.jpg"), title: "Mount Corcoran", artist: "Albert Bierstadt", year: "c. 1876–1877" },
  { source: require("../../../assets/briefs/shawangunk-mountains.jpg"), title: "The Shawangunk Mountains", artist: "Sanford Robinson Gifford", year: "1864" },
  { source: require("../../../assets/briefs/sunset-in-the-woods.jpg"), title: "Sunset in the Woods", artist: "George Inness", year: "1891" },
  { source: require("../../../assets/briefs/grand-canyon-yellowstone.jpg"), title: "The Grand Canyon of the Yellowstone", artist: "Thomas Moran", year: "1872" },
];

export function briefArtworkForDate(date?: string): BriefArtwork {
  return ARTWORKS[briefDate(date).getDay()]!;
}
