import React, { useMemo, useCallback } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect, Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

interface VirtualGimbalProps {
  size?: number;
  onMove?: (coords: { x: number; y: number }) => void;
  className?: string;
  snapBackX?: boolean;
  snapBackY?: boolean;
}

export const VirtualGimbal: React.FC<VirtualGimbalProps> = ({
  size = 140,
  onMove,
  className = '',
  snapBackX = true,
  snapBackY = true,
}) => {
  const maxRadius = (size / 2) * 0.45;

  // Reanimated shared values (ทำงานบน UI thread ได้)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // ส่งค่ากลับไป JS thread
  const reportMove = useCallback(
    (x: number, y: number) => {
      if (onMove) {
        onMove({
          x: Number((x / maxRadius).toFixed(2)),
          y: Number((-y / maxRadius).toFixed(2)),
        });
      }
    },
    [onMove, maxRadius]
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          savedX.value = translateX.value;
          savedY.value = translateY.value;
        })
        .onUpdate((e) => {
          let dx = savedX.value + e.translationX;
          let dy = savedY.value + e.translationY;

          // จำกัดขอบเขตเป็นสี่เหลี่ยม (Square constraint)
          dx = Math.max(-maxRadius, Math.min(maxRadius, dx));
          dy = Math.max(-maxRadius, Math.min(maxRadius, dy));

          // ระบบ Deadband: สร้าง "ร่องเสมือน" (Virtual Slot) ตรงกลางแต่ละแกน
          // ป้องกันนิ้วสั่น/เผลอเอียงเวลาตั้งใจจะลากแกนเดียวตรงๆ
          const deadzoneX = maxRadius * 0.20; // ลากซ้าย/ขวาต้องเกิน 20% ถึงจะเริ่มมีผล
          const deadzoneY = maxRadius * 0.15; // ลากบน/ล่างต้องเกิน 15% ถึงจะเริ่มมีผล

          let outDx = 0;
          let outDy = 0;

          // ถ้าค่าเกิน deadzone ค่อยหัก deadzone ออกแล้วขยายกลับเป็น 100% (เพื่อให้ลากแล้วสมูท ไม่กระโดด)
          if (Math.abs(dx) > deadzoneX) {
            outDx = Math.sign(dx) * ((Math.abs(dx) - deadzoneX) / (maxRadius - deadzoneX)) * maxRadius;
          }
          if (Math.abs(dy) > deadzoneY) {
            outDy = Math.sign(dy) * ((Math.abs(dy) - deadzoneY) / (maxRadius - deadzoneY)) * maxRadius;
          }

          translateX.value = outDx;
          translateY.value = outDy;

          runOnJS(reportMove)(outDx, outDy);
        })
        .onEnd(() => {
          const finalX = snapBackX ? 0 : translateX.value;
          const finalY = snapBackY ? 0 : translateY.value;

          // เพิ่ม overshootClamping: true และปรับ damping ให้สูงขึ้น เพื่อไม่ให้จอยเด้งกระดอนไปมา
          translateX.value = withSpring(finalX, { damping: 25, stiffness: 250, overshootClamping: true });
          translateY.value = withSpring(finalY, { damping: 25, stiffness: 250, overshootClamping: true });

          runOnJS(reportMove)(finalX, finalY);
        })
        .minDistance(0)
        .shouldCancelWhenOutside(false),
    [maxRadius, snapBackX, snapBackY, reportMove]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className={`items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        collapsable={false}
      >
        {/* ฐาน Gimbal SVG */}
        <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
          <Svg width={size} height={size} viewBox="0 0 160 160">
            <Defs>
              <RadialGradient id="gimbalGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#2e3440" />
                <Stop offset="70%" stopColor="#1e222b" />
                <Stop offset="100%" stopColor="#111318" />
              </RadialGradient>
              <RadialGradient id="stickGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#434c5e" />
                <Stop offset="60%" stopColor="#252a34" />
                <Stop offset="100%" stopColor="#181a20" />
              </RadialGradient>
            </Defs>

            <Rect x="10" y="10" width="140" height="140" rx="18" fill="#313642" stroke="#1f232b" strokeWidth="3.5" />
            <Circle cx="24" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="136" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="24" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="136" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />

            <Circle cx="80" cy="80" r="56" fill="url(#gimbalGrad)" stroke="#1a1d24" strokeWidth="3" />
            <Circle cx="80" cy="80" r="46" fill="none" stroke="#3b4252" strokeWidth="2.5" />

            <Line x1="80" y1="24" x2="80" y2="40" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="80" y1="120" x2="80" y2="136" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="24" y1="80" x2="40" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="120" y1="80" x2="136" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Rect x="38" y="64" width="84" height="32" rx="8" fill="#252a34" stroke="#17191f" strokeWidth="2.5" />
          </Svg>
        </View>

        {/* คันโยกที่ขยับได้ */}
        <Animated.View pointerEvents="none" style={animatedStyle}>
          <Svg width={46} height={46} viewBox="0 0 46 46">
            <Circle cx="23" cy="23" r="21" fill="#1b1e26" stroke="#0e1014" strokeWidth="2" />
            <Circle cx="23" cy="23" r="16" fill="url(#stickGrad)" stroke="#4c566a" strokeWidth="1.5" />
            <Circle cx="23" cy="23" r="10" fill="#2e3440" stroke="#1b1e26" strokeWidth="1" strokeDasharray="2,2" />
            <Circle cx="23" cy="23" r="5" fill="#88c0d0" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
