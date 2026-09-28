import React, { useRef, useState } from 'react';
import { View, PanResponder, Animated } from 'react-native';
import Svg, { Rect, Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

interface VirtualGimbalProps {
  size?: number;
  onMove?: (coords: { x: number; y: number }) => void;
  className?: string;
}

export const VirtualGimbal: React.FC<VirtualGimbalProps> = ({
  size = 140,
  onMove,
  className = '',
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const maxRadius = (size / 2) * 0.45; // ขอบเขตรัศมีสูงสุดที่คันโยกโยกได้

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let dx = gestureState.dx;
        let dy = gestureState.dy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxRadius) {
          dx = (dx / distance) * maxRadius;
          dy = (dy / distance) * maxRadius;
        }

        pan.setValue({ x: dx, y: dy });

        if (onMove) {
          onMove({
            x: Number((dx / maxRadius).toFixed(2)),
            y: Number((-dy / maxRadius).toFixed(2)), // แกน Y ชี้ขึ้นเป็นบวก
          });
        }
      },
      onPanResponderRelease: () => {
        // ดีดกลับตรงกลางอย่างนุ่มนวล
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          tension: 60,
          useNativeDriver: false,
        }).start();

        if (onMove) {
          onMove({ x: 0, y: 0 });
        }
      },
    })
  ).current;

  return (
    <View
      className={`items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      {...panResponder.panHandlers}>
      {/* ฐานโครงสร้าง Gimbal สไตล์ FPV Transmitter แบบในรูป */}
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

        {/* กรอบสี่เหลี่ยมด้านนอกสีเทาเข้ม มีรูน็อต 4 มุม */}
        <Rect
          x="10"
          y="10"
          width="140"
          height="140"
          rx="18"
          fill="#313642"
          stroke="#1f232b"
          strokeWidth="3.5"
        />

        {/* รูน็อตสีเงิน/เทาอ่อนทั้ง 4 มุม */}
        <Circle cx="24" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
        <Circle cx="136" cy="24" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
        <Circle cx="24" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />
        <Circle cx="136" cy="136" r="4.5" fill="#a0aab8" stroke="#1f232b" strokeWidth="1.5" />

        {/* วงแหวน Gimbal ชั้นนอก */}
        <Circle cx="80" cy="80" r="56" fill="url(#gimbalGrad)" stroke="#1a1d24" strokeWidth="3" />
        <Circle cx="80" cy="80" r="46" fill="none" stroke="#3b4252" strokeWidth="2.5" />

        {/* ก้านโครงสร้าง Cross Struts 4 ทิศ */}
        <Line x1="80" y1="24" x2="80" y2="40" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
        <Line x1="80" y1="120" x2="80" y2="136" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
        <Line x1="24" y1="80" x2="40" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />
        <Line x1="120" y1="80" x2="136" y2="80" stroke="#1f232b" strokeWidth="6" strokeLinecap="round" />

        {/* เบ้ากิมบอลแนวนอน (Horizontal Cradle) */}
        <Rect x="38" y="64" width="84" height="32" rx="8" fill="#252a34" stroke="#17191f" strokeWidth="2.5" />
      </Svg>

      {/* คันโยกตรงกลางที่โยกได้จริงตามนิ้ว (Gimbal Stick Top) */}
      <Animated.View
        style={{
          position: 'absolute',
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        }}>
        <Svg width={46} height={46} viewBox="0 0 46 46">
          {/* ขอบฐานคันโยก */}
          <Circle cx="23" cy="23" r="21" fill="#1b1e26" stroke="#0e1014" strokeWidth="2" />
          {/* หัวคันโยก Knurled Texture ลายฟันปลา FPV */}
          <Circle cx="23" cy="23" r="16" fill="url(#stickGrad)" stroke="#4c566a" strokeWidth="1.5" />
          <Circle cx="23" cy="23" r="10" fill="#2e3440" stroke="#1b1e26" strokeWidth="1" strokeDasharray="2,2" />
          <Circle cx="23" cy="23" r="5" fill="#88c0d0" />
        </Svg>
      </Animated.View>
    </View>
  );
};
