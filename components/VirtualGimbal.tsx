import React, { useState, useRef } from 'react';
import { View, Animated } from 'react-native';
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
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastPos = useRef({ x: 0, y: 0 });
  const maxRadius = (size / 2) * 0.45;
  const center = size / 2;

  const handleTouch = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    
    let dx = locationX - center;
    let dy = locationY - center;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    pan.setValue({ x: dx, y: dy });
    lastPos.current = { x: dx, y: dy };

    if (onMove) {
      onMove({
        x: Number((dx / maxRadius).toFixed(2)),
        y: Number((-dy / maxRadius).toFixed(2)), // แกน Y ชี้ขึ้นเป็นบวก
      });
    }
  };

  const handleRelease = () => {
    const finalX = snapBackX ? 0 : lastPos.current.x;
    const finalY = snapBackY ? 0 : lastPos.current.y;

    Animated.spring(pan, {
      toValue: { x: finalX, y: finalY },
      friction: 6,
      tension: 60,
      useNativeDriver: false,
    }).start();

    if (onMove) {
      onMove({
        x: Number((finalX / maxRadius).toFixed(2)),
        y: Number((-finalY / maxRadius).toFixed(2)),
      });
    }
  };

  return (
    <View
      className={`items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={handleRelease}
      onTouchCancel={handleRelease}
    >
      {/* เราครอบ Svg ด้วย pointerEvents="none" เพื่อให้ touch event ตกที่ View หลักเท่านั้น ป้องกันอาการ Glitch */}
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

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        }}>
        <Svg width={46} height={46} viewBox="0 0 46 46">
          <Circle cx="23" cy="23" r="21" fill="#1b1e26" stroke="#0e1014" strokeWidth="2" />
          <Circle cx="23" cy="23" r="16" fill="url(#stickGrad)" stroke="#4c566a" strokeWidth="1.5" />
          <Circle cx="23" cy="23" r="10" fill="#2e3440" stroke="#1b1e26" strokeWidth="1" strokeDasharray="2,2" />
          <Circle cx="23" cy="23" r="5" fill="#88c0d0" />
        </Svg>
      </Animated.View>
    </View>
  );
};
