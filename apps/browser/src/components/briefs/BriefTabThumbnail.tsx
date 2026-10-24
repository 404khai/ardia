import { useEffect, useRef } from "react";
import { Animated, Image, Text } from "react-native";
import { briefArtworkForDate, briefTitleForDate } from "./assets";

export function BriefTabThumbnail({ date, hovered, width = 42, height = 28 }: { date: string; hovered: boolean; width?: number; height?: number }) {
  const tilt = useRef(new Animated.Value(-10)).current;
  useEffect(() => {
    Animated.timing(tilt, { toValue: hovered ? -16 : -10, duration: 180, useNativeDriver: true }).start();
  }, [hovered, tilt]);
  const rotate = tilt.interpolate({ inputRange: [-16, -10], outputRange: ["-16deg", "-10deg"] });
  return <Animated.View pointerEvents="none" style={{ width, height, marginLeft: 3, marginRight: 2, borderWidth: 3, borderColor: "#111111", borderRadius: 3, overflow: "hidden", transform: [{ rotate }] }}><Image source={briefArtworkForDate(date).source} style={{ width: "100%", height: "100%" }} resizeMode="cover" /><Text numberOfLines={1} style={{ position: "absolute", top: height * 0.3, left: 0, right: 0, color: "#ffe500", fontFamily: "Georgia", fontSize: 4, textAlign: "center", fontWeight: "700" }}>{briefTitleForDate(date)}</Text></Animated.View>;
}
