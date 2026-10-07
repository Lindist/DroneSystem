import React, { useMemo, useCallback, useEffect } from 'react';
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
  initialX?: number; // -1 to 1 (default 0)
  initialY?: number; // -1 to 1 (-1 = bottom, 0 = center, 1 = top)
  resetTrigger?: number; // trigger increment to reset to initial position
  accentColor?: string; // center jewel color
  deadzoneXPercent?: number; // 0.0 to 1.0 — สัดส่วน deadzone แกน X (default 0.20)
  deadzoneYPercent?: number; // 0.0 to 1.0 — สัดส่วน deadzone แกน Y (default 0.15)
}

export const VirtualGimbal: React.FC<VirtualGimbalProps> = ({
  size = 180,
  onMove,
  className = '',
  snapBackX = true,
  snapBackY = true,
  initialX = 0,
  initialY = 0,
  resetTrigger = 0,
  accentColor = '#38bdf8',
  deadzoneXPercent = 0.20,
  deadzoneYPercent = 0.15,
}) => {
  const maxRadius = (size / 2) * 0.44;
  // เพิ่มขนาดปุ่มลากจอยให้ใหญ่ขึ้น เต็มมือนิ้วโป้ง (~68px สำหรับขนาด 180)
  const knobSize = Math.round(size * 0.38);

  // คำนวณพิกัดเริ่มต้น (แกน Y ของหน้าจอ: บวก = ลงล่าง, ลบ = ขึ้นบน)
  // ดังนั้น initialY = -1 (Throttle ล่างสุด) -> startY = +maxRadius
  const startX = initialX * maxRadius;
  const startY = -initialY * maxRadius;

  // Reanimated shared values (ทำงานบน UI thread ได้)
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);
  const savedX = useSharedValue(startX);
  const savedY = useSharedValue(startY);

  // ส่งค่าพิกัดกลับไป JS thread ในช่วง -1.0 ถึง +1.0
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

  // ส่งค่าพิกัดเริ่มต้นเมื่อ Component โหลดครั้งแรก
  useEffect(() => {
    reportMove(startX, startY);
  }, [startX, startY, reportMove]);

  // ระบบรีเซ็ตตำแหน่งจอย (เมื่อกด Start / Reset)
  useEffect(() => {
    if (resetTrigger > 0) {
      const targetX = initialX * maxRadius;
      const targetY = -initialY * maxRadius;

      savedX.value = targetX;
      savedY.value = targetY;

      translateX.value = withSpring(targetX, {
        damping: 25,
        stiffness: 250,
        overshootClamping: true,
      });
      translateY.value = withSpring(targetY, {
        damping: 25,
        stiffness: 250,
        overshootClamping: true,
      });

      reportMove(targetX, targetY);
    }
  }, [resetTrigger, initialX, initialY, maxRadius, reportMove, savedX, savedY, translateX, translateY]);

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
          const deadzoneX = maxRadius * deadzoneXPercent;
          const deadzoneY = maxRadius * deadzoneYPercent;

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
          const finalX = snapBackX ? (initialX * maxRadius) : translateX.value;
          const finalY = snapBackY ? (-initialY * maxRadius) : translateY.value;

          savedX.value = finalX;
          savedY.value = finalY;

          translateX.value = withSpring(finalX, {
            damping: 25,
            stiffness: 250,
            overshootClamping: true,
          });
          translateY.value = withSpring(finalY, {
            damping: 25,
            stiffness: 250,
            overshootClamping: true,
          });

          runOnJS(reportMove)(finalX, finalY);
        })
        .minDistance(0)
        .shouldCancelWhenOutside(false),
    [maxRadius, snapBackX, snapBackY, initialX, initialY, reportMove, savedX, savedY, translateX, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // รัศมีกึ่งกลางของปุ่มลากจอย
  const halfKnob = knobSize / 2;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className={`items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        collapsable={false}
      >
        {/* 1. ฐาน Gimbal SVG */}
        <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
          <Svg width={size} height={size} viewBox="0 0 160 160">
            <Defs>
              <RadialGradient id="gimbalGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#2e3440" />
                <Stop offset="70%" stopColor="#1e222b" />
                <Stop offset="100%" stopColor="#111318" />
              </RadialGradient>
              <RadialGradient id="knobDishGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#475569" />
                <Stop offset="65%" stopColor="#1e293b" />
                <Stop offset="100%" stopColor="#0f172a" />
              </RadialGradient>
              <RadialGradient id="knobOuterGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#334155" />
                <Stop offset="70%" stopColor="#1e2430" />
                <Stop offset="100%" stopColor="#090b10" />
              </RadialGradient>
            </Defs>

            {/* กรอบสี่เหลี่ยมด้านนอก พร้อมหมุดยึด 4 มุม */}
            <Rect x="10" y="10" width="140" height="140" rx="18" fill="#313642" stroke="#1f232b" strokeWidth="3.5" />
            <Circle cx="24" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="136" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="24" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
            <Circle cx="136" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />

            {/* เบ้ากลมและขอบร่องเลื่อนจอย */}
            <Circle cx="80" cy="80" r="56" fill="url(#gimbalGrad)" stroke="#1a1d24" strokeWidth="3" />
            <Circle cx="80" cy="80" r="46" fill="none" stroke="#3b4252" strokeWidth="2.5" />

            {/* เส้นบอกกึ่งกลางแกน Crosshair */}
            <Line x1="80" y1="24" x2="80" y2="40" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="80" y1="120" x2="80" y2="136" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="24" y1="80" x2="40" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Line x1="120" y1="80" x2="136" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
            <Rect x="38" y="64" width="84" height="32" rx="8" fill="#252a34" stroke="#17191f" strokeWidth="2.5" />
          </Svg>
        </View>

        {/* 2. คันโยกที่ขยับได้ (ปุ่มลากจอยขนาดใหญ่ พร้อมพื้นผิวกันลื่นแบบ Transmitter จริง) */}
        <Animated.View pointerEvents="none" style={animatedStyle}>
          <Svg width={knobSize} height={knobSize} viewBox={`0 0 ${knobSize} ${knobSize}`}>
            {/* ขอบด้านนอกสุด */}
            <Circle
              cx={halfKnob}
              cy={halfKnob}
              r={halfKnob - 2}
              fill="url(#knobOuterGrad)"
              stroke="#0b0e14"
              strokeWidth="2.5"
            />
            {/* วงแหวนลายบากกันลื่น (Knurled Grip Texture) */}
            <Circle
              cx={halfKnob}
              cy={halfKnob}
              r={halfKnob - 6}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="3,3"
              opacity="0.75"
            />
            {/* ร่องจานกดตรงกลาง (Concave Thumb Dish) */}
            <Circle
              cx={halfKnob}
              cy={halfKnob}
              r={halfKnob - 10}
              fill="url(#knobDishGrad)"
              stroke="#1e293b"
              strokeWidth="2"
            />
            {/* เส้นรอยกลึงวงใน */}
            <Circle
              cx={halfKnob}
              cy={halfKnob}
              r={halfKnob - 17}
              fill="none"
              stroke="#475569"
              strokeWidth="1.2"
              strokeDasharray="2,2"
              opacity="0.8"
            />
            {/* หมุดอัญมณีตรงกลาง แสดงสีประจำแกน (Cyan/Amber) */}
            <Circle
              cx={halfKnob}
              cy={halfKnob}
              r={halfKnob * 0.22}
              fill={accentColor}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* แสงสะท้อน 3D ไฮไลต์ */}
            <Circle
              cx={halfKnob - (halfKnob * 0.08)}
              cy={halfKnob - (halfKnob * 0.08)}
              r={halfKnob * 0.08}
              fill="#ffffff"
              opacity="0.7"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
