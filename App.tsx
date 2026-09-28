import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationBar } from 'expo-navigation-bar';
import { DroneCameraView } from './components/DroneCameraView';
import './global.css';

function DroneCockpit() {
  const insets = useSafeAreaInsets();
  const [flightMode, setFlightMode] = useState<'MANUAL' | 'ALT_HOLD' | 'RTH'>('ALT_HOLD');
  const [isArmed, setIsArmed] = useState(false);
  const [fps, setFps] = useState(0);

  // ตั้งค่าล็อกแนวนอน และซ่อนแถบปุ่ม Navigation Bar แบบ Immersive Fullscreen
  useEffect(() => {
    async function configureFullscreen() {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );

        if (Platform.OS === 'android') {
          // ซ่อนปุ่ม Navigation Bar ด้านล่างของ Android (โผล่ชั่วคราวเมื่อปัดขอบจอ)
          NavigationBar.setHidden(true);
        }
      } catch (err) {
        console.warn('Failed to configure fullscreen landscape:', err);
      }
    }
    configureFullscreen();
  }, []);

  return (
    <View
      className="flex-1 bg-[#090d16]"
      style={{
        // เว้นขอบจอตาม Safe Area เพื่อป้องกันปุ่มล่างและติ่งกล้องบดบังเนื้อหา
        paddingTop: Math.max(insets.top, 4),
        paddingBottom: Math.max(insets.bottom, 4),
        paddingLeft: Math.max(insets.left, 8),
        paddingRight: Math.max(insets.right, 8),
      }}>
      {/* ซ่อน Status Bar (เวลา, แบต, ไอคอนระบบ) เพื่อเพิ่มพื้นที่จอเต็มตา */}
      <StatusBar hidden={true} />

      {/* Top Header Cockpit Bar */}
      <View className="px-3 py-1.5 flex-row justify-between items-center border-b border-slate-800/80 bg-slate-950/70 rounded-xl mb-2">
        <View className="flex-row items-center gap-2.5">
          <Text className="text-slate-100 text-sm font-black tracking-widest font-mono">
            AERO-LINK FPV
          </Text>
          <View className="bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
            <Text className="text-sky-400 text-[9px] font-bold font-mono">
              IMMERSIVE COCKPIT
            </Text>
          </View>
        </View>

        {/* Quick Telemetry Indicators */}
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Text className="text-slate-500 text-[10px] font-semibold">BAT:</Text>
            <Text className="text-emerald-400 text-[11px] font-bold font-mono">11.8V (86%)</Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-slate-500 text-[10px] font-semibold">SIGNAL:</Text>
            <Text className="text-sky-400 text-[11px] font-bold font-mono">-62 dBm</Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-slate-500 text-[10px] font-semibold">ALT:</Text>
            <Text className="text-amber-400 text-[11px] font-bold font-mono">4.2 m</Text>
          </View>

          {/* Armed Badge */}
          <View className="flex-row items-center bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-700">
            <View
              className={`w-2 h-2 rounded-full mr-1.5 ${
                isArmed ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <Text className="text-slate-200 text-[10px] font-bold tracking-wider font-mono">
              {isArmed ? 'ARMED' : 'DISARMED'}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Landscape Cockpit Body */}
      <View className="flex-1 flex-row gap-2.5">
        {/* Left Column: Live FPV Video Feed (ESP32-CAM) */}
        <View className="flex-[3] h-full rounded-2xl overflow-hidden shadow-2xl">
          <DroneCameraView
            defaultServerUrl="ws://10.86.148.147:8888"
            onFpsChange={setFps}
            className="h-full"
          />
        </View>

        {/* Right Column: Drone Controls & Flight Telemetry Panel */}
        <View className="flex-[2] h-full justify-between">
          {/* Flight Modes Selection */}
          <View className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
            <Text className="text-slate-400 text-[9px] font-bold tracking-wider mb-1.5 font-mono">
              FLIGHT MODES
            </Text>
            <View className="flex-row gap-1.5">
              {(['MANUAL', 'ALT_HOLD', 'RTH'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  className={`flex-1 py-1.5 rounded-lg items-center border ${
                    flightMode === mode
                      ? 'bg-sky-600 border-sky-400'
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                  onPress={() => setFlightMode(mode)}>
                  <Text
                    className={`text-[11px] font-bold ${
                      flightMode === mode ? 'text-white' : 'text-slate-400'
                    }`}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Live Sensors Grid */}
          <View className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 flex-row justify-between">
            <View className="items-center">
              <Text className="text-slate-500 text-[9px] font-semibold">SPEED</Text>
              <Text className="text-slate-200 text-xs font-bold font-mono">0.0 m/s</Text>
            </View>
            <View className="items-center">
              <Text className="text-slate-500 text-[9px] font-semibold">PITCH</Text>
              <Text className="text-slate-200 text-xs font-bold font-mono">+1.2°</Text>
            </View>
            <View className="items-center">
              <Text className="text-slate-500 text-[9px] font-semibold">ROLL</Text>
              <Text className="text-slate-200 text-xs font-bold font-mono">-0.4°</Text>
            </View>
            <View className="items-center">
              <Text className="text-slate-500 text-[9px] font-semibold">FPS</Text>
              <Text
                className={`text-xs font-bold font-mono ${
                  fps > 20 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                {fps}
              </Text>
            </View>
          </View>

          {/* Flight Safety & Power Actions */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl items-center justify-center ${
                isArmed ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
              onPress={() => setIsArmed(!isArmed)}>
              <Text className="text-white text-xs font-black tracking-wider">
                {isArmed ? 'DISARM MOTORS' : 'ARM MOTORS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 py-3 rounded-xl items-center justify-center bg-rose-500/20 border border-rose-500"
              onPress={() => {
                setIsArmed(false);
                alert('EMERGENCY CUT-OFF ACTIVATED');
              }}>
              <Text className="text-rose-500 text-xs font-black tracking-wider">
                EMERGENCY STOP
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DroneCockpit />
    </SafeAreaProvider>
  );
}
