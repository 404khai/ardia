import { useEffect, useRef, useState } from "react";
import { Animated, Image, Linking, Pressable } from "react-native";
import { isSafeBriefSource, type BriefSource } from "../../lib/briefContent";


export function BriefSourceLink({ source }: { source: BriefSource }) {
  const [hovered, setHovered] = useState(false);
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tilt, { toValue: hovered ? 1 : 0, duration: 180, useNativeDriver: true }).start();
    return () => tilt.stopAnimation();
  }, [hovered, tilt]);
  if (!isSafeBriefSource(source)) return null;
  const name = source.kind === "github" ? "GitHub" : "Gmail";
  return <Pressable accessibilityRole="link" accessibilityLabel={`Open in ${name}`} tooltip={`Open in ${name}`} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={() => void Linking.openURL(source.url).catch(() => {})} style={({ pressed }) => ({ width: 24, height: 24, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}><Animated.View pointerEvents="none" style={{ width: 20, height: 20, transform: [{ rotate: tilt.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "12deg"] }) }] }}><Image source={source.kind === "github" ? require("../../../assets/site-icons/github.png") : require("../../../assets/site-icons/gmail.png")} resizeMode="contain" style={{ width: 20, height: 20, ...(source.kind === "github" ? { tintColor: "#eeeeeb" } : {}) }} /></Animated.View></Pressable>;
}
