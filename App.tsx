import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationBar, addVisibilityListener } from 'expo-navigation-bar';
import Svg, { Path } from 'react-native-svg';
import { DroneCameraView } from './components/DroneCameraView';
import { VirtualGimbal } from './components/VirtualGimbal';
import { flightController } from './utils/FlightControllerUdp';
import './global.css';

function DroneCockpit() {
  const insets = useSafeAreaInsets();

  // ที่อยู่ของ ESP32-CAM (ดึงสตรีมตรงโดยไม่ต้องมี Node.js)
  const [cameraUrl, setCameraUrl] = useState('http://192.168.43.10:81/stream');
  const [tempCameraUrl, setTempCameraUrl] = useState('http://192.168.43.10:81/stream');

  // ที่อยู่ของ ESP8266 Flight Controller (ส่งคำสั่งควบคุมทาง UDP พอร์ต 4210)
  const [fcIp, setFcIp] = useState('192.168.43.50');
  const [tempFcIp, setTempFcIp] = useState('192.168.43.50');
  const [fcPort, setFcPort] = useState('4210');
  const [tempFcPort, setTempFcPort] = useState('4210');

  // สถานะการตรวจพบอุปกรณ์อัตโนมัติ (UDP Auto-Discovery)
  const [isCamDiscovered, setIsCamDiscovered] = useState(false);
  const [isFcDiscovered, setIsFcDiscovered] = useState(false);

  // สถานะเปิด/ปิดการทำงานของมอเตอร์ (Start / Stop)
  const [isStarted, setIsStarted] = useState(false);
  // ตัวกระตุ้นให้ก้าน Throttle เด้งรีเซ็ตกลับลงมาด้านล่างสุด
  const [throttleResetTrigger, setThrottleResetTrigger] = useState(0);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');

  // ค่าที่ได้รับจาก Gimbal ซ้าย (Throttle, Yaw) และ ขวา (Pitch, Roll)
  // เริ่มต้นให้ Throttle (y) อยู่ที่ -1.0 (ล่างสุด = 0% / 1000 PWM) เพื่อความปลอดภัย
  const [leftStick, setLeftStick] = useState({ x: 0, y: -1 });
  const [rightStick, setRightStick] = useState({ x: 0, y: 0 });

  // ล็อกแนวนอนและซ่อนแถบปุ่มแบบ Immersive ถาวร
  useEffect(() => {
    async function configureFullscreen() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        if (Platform.OS === 'android') {
          NavigationBar.setHidden(true);
        }
      } catch (err) {
        console.warn('Fullscreen config error:', err);
      }
    }
    configureFullscreen();

    // ล็อคไม่ให้แถบนำทางโผล่ค้างเวลาไปกดปุ่มอื่น
    const subscription = addVisibilityListener(({ visibility }) => {
      if (visibility === 'visible' && Platform.OS === 'android') {
        setTimeout(() => {
          NavigationBar.setHidden(true);
        }, 1500); // ซ่อนกลับอัตโนมัติ
      }
    });

    return () => subscription.remove();
  }, []);

  // ----------------------------------------------------
  // ระบบ UDP Broadcast Auto-Discovery: ดักฟัง IP บอร์ดอัตโนมัติ
  // ----------------------------------------------------
  useEffect(() => {
    const unsubscribe = flightController.onDiscovered((device) => {
      if (device.type === 'CAM' && device.streamUrl) {
        setCameraUrl(device.streamUrl);
        setTempCameraUrl(device.streamUrl);
        setIsCamDiscovered(true);
      } else if (device.type === 'FC') {
        setFcIp(device.ip);
        setTempFcIp(device.ip);
        const portStr = String(device.port || 4210);
        setFcPort(portStr);
        setTempFcPort(portStr);
        flightController.setTarget(device.ip, Number(portStr));
        setIsFcDiscovered(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // ซิงค์ IP/Port เริ่มต้นกับ Flight Controller Service
  useEffect(() => {
    flightController.setTarget(fcIp, Number(fcPort) || 4210);
  }, [fcIp, fcPort]);

  // ลูปส่งคำสั่ง UDP แบบต่อเนื่อง (20Hz = ทุก 50ms) ป้องกัน Failsafe บน ESP8266 ตัดการทำงาน
  useEffect(() => {
    // หากยังไม่กด START (Motors Not Started) จะยังไม่ส่งข้อมูลใดๆ ไปยัง ESP8266
    if (!isStarted) {
      return;
    }

    const timer = setInterval(() => {
      // เมื่อกด START แล้ว (โหมด Armed) ส่งค่าพิกัดจริงที่อ่านได้จากคันโยก
      const throttleNorm = (leftStick.y + 1) / 2; // 0.0 (ล่างสุด) ถึง 1.0 (บนสุด)
      const throttlePwm = 1000 + Math.round(throttleNorm * 1000);

      // แปลงค่าแกนอื่นๆ (-1 ถึง 1) ให้เป็นช่วง -50 ถึง +50 องศา
      const yawVal = Math.round(leftStick.x * 50);
      const pitchVal = Math.round(rightStick.y * 50);
      const rollVal = Math.round(rightStick.x * 50);

      flightController.sendCommand(throttlePwm, pitchVal, rollVal, yawVal);
    }, 50);

    return () => clearInterval(timer);
  }, [isStarted, leftStick.x, leftStick.y, rightStick.x, rightStick.y]);

  // คำนวณเปอร์เซ็นต์สำหรับแสดงบน Telemetry Bar (แสดงค่าจริงตามตำแหน่งคันโยกเสมอ แม้ยังไม่กด Start)
  const throttlePercent = Math.max(0, Math.min(100, Math.round(((leftStick.y + 1) / 2) * 100)));
  const yawPercent = Math.round(leftStick.x * 100);
  const pitchPercent = Math.round(rightStick.y * 100);
  const rollPercent = Math.round(rightStick.x * 100);

  // ฟังก์ชันสลับการทำงานปุ่ม START / STOP
  const handleToggleStartStop = () => {
    if (!isStarted) {
      // --- เมื่อกด START ---
      setIsStarted(true);
      // รีเซ็ตคันโยก Throttle ให้เด้งกลับลงไปด้านล่างสุดทันที
      setThrottleResetTrigger((prev) => prev + 1);
      setLeftStick((prev) => ({ ...prev, y: -1 }));

      if (Platform.OS === 'android') {
        NavigationBar.setHidden(true);
      }
    } else {
      // --- เมื่อกด STOP ---
      setIsStarted(false);
      // ตัดไฟมอเตอร์ทันทีด้วยสัญญาณ 1000
      flightController.emergencyStop();
      // รีเซ็ต Throttle กลับลงด้านล่าง
      setThrottleResetTrigger((prev) => prev + 1);
      setLeftStick((prev) => ({ ...prev, y: -1 }));

      alert('MOTORS STOPPED: ตัดกำลังมอเตอร์และเข้าสู่โหมดปลอดภัยแล้ว');
      if (Platform.OS === 'android') {
        NavigationBar.setHidden(true);
      }
    }
  };

  return (
    <View
      className="flex-1 bg-[#0f172a] justify-between"
      style={{
        paddingTop: Math.max(insets.top, 4),
        paddingBottom: Math.max(insets.bottom, 4),
        paddingLeft: Math.max(insets.left, 8),
        paddingRight: Math.max(insets.right, 8),
      }}>
      <StatusBar hidden={true} />

      {/* 1. Header Bar: Cathoa FPV, Status Badges & Settings Gear */}
      <View className="flex-row justify-between items-center px-2 py-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-white text-xl font-bold tracking-widest uppercase">
            Cathoa FPV
          </Text>

          {/* ป้ายแสดงสถานะการตรวจพบอุปกรณ์อัตโนมัติ */}
          <View className="flex-row items-center gap-1.5 ml-1">
            <View
              className={`px-2 py-0.5 rounded-full border ${
                isCamDiscovered
                  ? 'bg-cyan-950/80 border-cyan-500/40'
                  : 'bg-slate-800/80 border-slate-700/50'
              }`}>
              <Text
                className={`text-[9px] font-semibold tracking-wider uppercase ${
                  isCamDiscovered ? 'text-cyan-400' : 'text-slate-400'
                }`}>
                CAM: {isCamDiscovered ? 'AUTO' : 'SEARCHING'}
              </Text>
            </View>

            <View
              className={`px-2 py-0.5 rounded-full border ${
                isFcDiscovered
                  ? 'bg-emerald-950/80 border-emerald-500/40'
                  : 'bg-slate-800/80 border-slate-700/50'
              }`}>
              <Text
                className={`text-[9px] font-semibold tracking-wider uppercase ${
                  isFcDiscovered ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                FC: {isFcDiscovered ? 'AUTO' : 'SEARCHING'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="p-1.5 active:opacity-70"
          onPress={() => {
            setTempCameraUrl(cameraUrl);
            setTempFcIp(fcIp);
            setTempFcPort(fcPort);
            setIsSettingsOpen(true);
          }}>
          <Svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <Path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 2. Main Middle Section: Left Gimbal - Center Screen - Right Gimbal */}
      <View className="flex-1 flex-row items-center justify-between px-2 my-1">
        {/* Left Gimbal (Throttle / Yaw) - ปุ่มลากขนาดใหญ่ขึ้น + รีเซ็ตลงด้านล่างสุดได้ */}
        <View className="items-center justify-center">
          <VirtualGimbal
            size={180}
            onMove={setLeftStick}
            snapBackX={true}
            snapBackY={false}
            initialY={-1}
            resetTrigger={throttleResetTrigger}
            accentColor="#38bdf8"
          />
        </View>

        {/* Center Live Screen (Cathoa FPV Video Viewport) */}
        <View className="flex-1 h-full mx-2">
          {/* HUD Status Bar */}
          <View className="h-6 bg-[#1e293b] flex-row items-center justify-between px-3 rounded-t-lg border border-b-0 border-slate-700">
            <View className="flex-row items-center gap-1.5">
              <View
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'CONNECTED' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                }`}
              />
              <Text className="text-slate-300 text-[10px] font-bold tracking-wider">
                {connectionStatus}
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Text className="text-slate-400 text-[10px] font-semibold tracking-wide">
                UDP: {fcIp}:{fcPort}
              </Text>
              <Text className="text-slate-400 text-[10px] font-semibold tracking-wide">
                FPS: {fps > 0 ? fps : '--'}
              </Text>
            </View>

            {/* ป้ายแสดงสถานะการบิน (ARMED / DISARMED) */}
            <View
              className={`flex-row items-center px-2 py-0.5 rounded-[4px] border ${
                isStarted
                  ? 'bg-emerald-600/90 border-emerald-400'
                  : 'bg-amber-600/80 border-amber-400/60'
              }`}>
              <Text className="text-white text-[9px] font-bold tracking-wider">
                {isStarted ? 'ARMED' : 'DISARMED'}
              </Text>
            </View>
          </View>

          {/* Stream View */}
          <View className="flex-1 rounded-b-lg overflow-hidden border border-t-0 border-slate-700 bg-black">
            <DroneCameraView
              serverUrl={cameraUrl}
              onFpsChange={setFps}
              onStatusChange={setConnectionStatus}
              className="w-full h-full"
            />
          </View>
        </View>

        {/* Right Gimbal (Pitch / Roll) - ปุ่มลากขนาดใหญ่ขึ้น + Snapback กึ่งกลาง */}
        <View className="items-center justify-center">
          <VirtualGimbal
            size={180}
            onMove={setRightStick}
            snapBackX={true}
            snapBackY={true}
            initialY={0}
            accentColor="#f59e0b"
          />
        </View>
      </View>

      {/* 3. Bottom Section: Telemetry Bar & Start/Stop Button */}
      <View className="items-center justify-end pb-2 gap-2">
        {/* Telemetry Bar */}
        <View className="flex-row items-center justify-center bg-[#1e293b]/90 px-6 py-1.5 rounded-full border border-slate-700/50 gap-6">
          <View className="flex-row items-center gap-2">
            <Text className="text-slate-400 text-[10px] font-bold">THROTTLE</Text>
            <Text className="text-cyan-400 text-xs font-mono w-12 text-right">
              {throttlePercent}%
            </Text>
          </View>
          <View className="w-[1px] h-3 bg-slate-600" />
          <View className="flex-row items-center gap-2">
            <Text className="text-slate-400 text-[10px] font-bold">YAW</Text>
            <Text className="text-emerald-400 text-xs font-mono w-12 text-right">
              {yawPercent}%
            </Text>
          </View>
          <View className="w-[1px] h-3 bg-slate-600" />
          <View className="flex-row items-center gap-2">
            <Text className="text-slate-400 text-[10px] font-bold">PITCH</Text>
            <Text className="text-amber-400 text-xs font-mono w-12 text-right">
              {pitchPercent}%
            </Text>
          </View>
          <View className="w-[1px] h-3 bg-slate-600" />
          <View className="flex-row items-center gap-2">
            <Text className="text-slate-400 text-[10px] font-bold">ROLL</Text>
            <Text className="text-violet-400 text-xs font-mono w-12 text-right">
              {rollPercent}%
            </Text>
          </View>
        </View>

        {/* ปุ่ม Start / Stop แทนปุ่ม Emergency Stop เดิม */}
        <TouchableOpacity
          className={`px-14 py-2.5 rounded-full shadow-lg border-2 flex-row items-center gap-2.5 ${
            isStarted
              ? 'bg-rose-600 active:bg-rose-700 border-rose-400'
              : 'bg-emerald-600 active:bg-emerald-700 border-emerald-400'
          }`}
          onPress={handleToggleStartStop}>
          {isStarted ? (
            // ไอคอนสี่เหลี่ยม STOP
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <Path d="M6 6h12v12H6z" />
            </Svg>
          ) : (
            // ไอคอนสามเหลี่ยม START
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <Path d="M8 5v14l11-7z" />
            </Svg>
          )}
          <Text className="text-white text-base font-bold tracking-widest uppercase">
            {isStarted ? 'STOP MOTORS' : 'START MOTORS'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal (ปรับแต่ง IP กล้อง ESP32 และ IP ไฟลท์คอนโทรลเลอร์ ESP8266) */}
      <Modal visible={isSettingsOpen} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-[#1e293b] rounded-2xl p-5 w-96 shadow-2xl border border-slate-700 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-white text-base font-bold tracking-wide">
                Hardware Connection Settings
              </Text>
              <View className="flex-row items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <Text className="text-emerald-400 text-[9px] font-bold">AUTO-DISCOVERY</Text>
              </View>
            </View>

            <Text className="text-slate-400 text-[11px] mb-3">
              ระบบตรวจจับ IP อัตโนมัติ (หรือกำหนดเองหากต้องการ)
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
              {/* 1. ESP32-CAM Stream URL */}
              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-cyan-400 text-[11px] font-semibold">
                    1. ESP32-CAM Stream URL
                  </Text>
                  {isCamDiscovered && (
                    <Text className="text-emerald-400 text-[9px] font-bold">✓ AUTO-FOUND</Text>
                  )}
                </View>
                <TextInput
                  className="bg-slate-900 text-slate-100 px-3 py-2 rounded-lg text-xs border border-slate-700 font-mono"
                  value={tempCameraUrl}
                  onChangeText={setTempCameraUrl}
                  placeholder="http://192.168.43.10:81/stream"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* 2. ESP8266 Flight Controller Target */}
              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-emerald-400 text-[11px] font-semibold">
                    2. ESP8266 Flight Controller (UDP)
                  </Text>
                  {isFcDiscovered && (
                    <Text className="text-emerald-400 text-[9px] font-bold">✓ AUTO-FOUND</Text>
                  )}
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-slate-400 text-[10px] mb-0.5">IP Address:</Text>
                    <TextInput
                      className="bg-slate-900 text-slate-100 px-3 py-2 rounded-lg text-xs border border-slate-700 font-mono"
                      value={tempFcIp}
                      onChangeText={setTempFcIp}
                      placeholder="192.168.43.50"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View className="w-24">
                    <Text className="text-slate-400 text-[10px] mb-0.5">UDP Port:</Text>
                    <TextInput
                      className="bg-slate-900 text-slate-100 px-3 py-2 rounded-lg text-xs border border-slate-700 font-mono"
                      value={tempFcPort}
                      onChangeText={setTempFcPort}
                      placeholder="4210"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Helper Notice */}
              <View className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <Text className="text-cyan-400 text-[10px] font-bold mb-0.5">
                  ✨ ระบบค้นหา IP อัตโนมัติ (Zero-Config):
                </Text>
                <Text className="text-slate-300 text-[10px] leading-relaxed">
                  ทันทีที่บอร์ด ESP32-CAM และ ESP8266 เชื่อมต่อเข้า Hotspot ของมือถือได้สำเร็จ ทั้ง 2 บอร์ดจะส่งสัญญาณ Beacon มายังแอปเพื่อลงทะเบียน IP อัตโนมัติทันทีโดยที่คุณไม่ต้องกรอกเองครับ
                </Text>
              </View>
            </ScrollView>

            {/* Modal Buttons */}
            <View className="flex-row justify-end gap-2 pt-2 border-t border-slate-700/60">
              <TouchableOpacity
                className="px-4 py-2 rounded-lg bg-slate-800 active:bg-slate-700"
                onPress={() => setIsSettingsOpen(false)}>
                <Text className="text-slate-300 text-xs font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-5 py-2 rounded-lg bg-cyan-600 active:bg-cyan-500 shadow-md"
                onPress={() => {
                  setCameraUrl(tempCameraUrl.trim());
                  setFcIp(tempFcIp.trim());
                  setFcPort(tempFcPort.trim());
                  flightController.setTarget(tempFcIp.trim(), Number(tempFcPort) || 4210);
                  setIsSettingsOpen(false);
                }}>
                <Text className="text-white text-xs font-bold">Save Settings</Text>
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
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <DroneCockpit />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
