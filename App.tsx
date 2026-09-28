import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationBar } from 'expo-navigation-bar';
import Svg, { Path } from 'react-native-svg';
import { DroneCameraView } from './components/DroneCameraView';
import { VirtualGimbal } from './components/VirtualGimbal';
import './global.css';

function DroneCockpit() {
  const insets = useSafeAreaInsets();
  const [serverUrl, setServerUrl] = useState('ws://10.86.148.147:8888');
  const [tempUrl, setTempUrl] = useState('ws://10.86.148.147:8888');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fps, setFps] = useState(26);

  // ค่าที่ได้รับจาก Gimbal ซ้ายและขวา
  const [leftStick, setLeftStick] = useState({ x: 0, y: 0 });
  const [rightStick, setRightStick] = useState({ x: 0, y: 0 });

  // ล็อกแนวนอนและซ่อนแถบปุ่มแบบ Immersive
  useEffect(() => {
    async function configureFullscreen() {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );

        if (Platform.OS === 'android') {
          NavigationBar.setHidden(true);
        }
      } catch (err) {
        console.warn('Fullscreen config error:', err);
      }
    }
    configureFullscreen();
  }, []);

  return (
    <View
      className="flex-1 bg-white justify-between"
      style={{
        paddingTop: Math.max(insets.top, 8),
        paddingBottom: Math.max(insets.bottom, 12),
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
      }}>
      <StatusBar hidden={true} />

      {/* 1. Header Bar: Cathoa FPV & Settings Gear */}
      <View className="flex-row justify-between items-center px-2 py-1">
        <Text className="text-black text-2xl font-normal tracking-tight">
          Cathoa FPV
        </Text>

        <TouchableOpacity
          className="p-1.5"
          onPress={() => {
            setTempUrl(serverUrl);
            setIsSettingsOpen(true);
          }}>
          {/* ไอคอนรูปเฟืองสีดำตามแบบร่าง */}
          <Svg width="26" height="26" viewBox="0 0 24 24" fill="black">
            <Path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 2. Main Middle Section: Left Gimbal - Center Screen - Right Gimbal */}
      <View className="flex-1 flex-row items-center justify-between px-2">
        {/* Left Gimbal (Throttle / Yaw) */}
        <View className="items-center justify-center">
          <VirtualGimbal size={150} onMove={setLeftStick} />
        </View>

        {/* Center Live Screen (Cathoa FPV Video Viewport with X crosshair) */}
        <View className="w-[48%] h-[82%] rounded-md overflow-hidden shadow-sm border border-slate-300">
          <DroneCameraView
            serverUrl={serverUrl}
            onFpsChange={setFps}
            className="w-full h-full"
          />
        </View>

        {/* Right Gimbal (Pitch / Roll) */}
        <View className="items-center justify-center">
          <VirtualGimbal size={150} onMove={setRightStick} />
        </View>
      </View>

      {/* 3. Bottom Button: Emergency Stop (Pill Shape) */}
      <View className="items-center justify-center pb-1">
        <TouchableOpacity
          className="bg-[#ff2b55] px-10 py-2.5 rounded-full shadow-md active:opacity-80"
          onPress={() => {
            alert('EMERGENCY STOP TRIGGERED: Motors cut off');
          }}>
          <Text className="text-white text-base font-medium tracking-normal">
            Emergency Stop
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal (สำหรับเปลี่ยน WebSocket IP ได้สะดวก) */}
      <Modal visible={isSettingsOpen} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white rounded-2xl p-5 w-80 shadow-2xl border border-slate-200">
            <Text className="text-slate-900 text-base font-bold mb-3">
              WebSocket Connection
            </Text>

            <Text className="text-slate-500 text-xs mb-1.5 font-medium">
              Drone Server URL:
            </Text>
            <TextInput
              className="bg-slate-100 text-slate-900 px-3 py-2 rounded-lg text-xs border border-slate-300 mb-4"
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="ws://10.86.148.147:8888"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View className="flex-row justify-end gap-2">
              <TouchableOpacity
                className="px-4 py-2 rounded-lg bg-slate-200"
                onPress={() => setIsSettingsOpen(false)}>
                <Text className="text-slate-700 text-xs font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-4 py-2 rounded-lg bg-slate-900"
                onPress={() => {
                  setServerUrl(tempUrl);
                  setIsSettingsOpen(false);
                }}>
                <Text className="text-white text-xs font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
