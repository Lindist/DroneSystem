import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DroneCameraView } from './components/DroneCameraView';
import './global.css';

export default function App() {
  const [flightMode, setFlightMode] = useState<'MANUAL' | 'ALT_HOLD' | 'RTH'>('ALT_HOLD');
  const [isArmed, setIsArmed] = useState(false);
  const [fps, setFps] = useState(0);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          
          {/* Header Bar */}
          <View style={styles.header}>
            <View>
              <Text style={styles.brandTitle}>AERO-LINK FPV</Text>
              <Text style={styles.brandSubtitle}>Drone Ground Control Station</Text>
            </View>
            <View style={styles.telemetryBadge}>
              <View
                style={[
                  styles.armedDot,
                  { backgroundColor: isArmed ? '#22c55e' : '#ef4444' },
                ]}
              />
              <Text style={styles.armedText}>{isArmed ? 'ARMED' : 'DISARMED'}</Text>
            </View>
          </View>

          {/* Quick Stats Top Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BATTERY</Text>
              <Text style={styles.statValue}>11.8V (86%)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SIGNAL</Text>
              <Text style={[styles.statValue, { color: '#38bdf8' }]}>-62 dBm</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ALTITUDE</Text>
              <Text style={styles.statValue}>4.2 m</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>FPS</Text>
              <Text style={[styles.statValue, { color: fps > 15 ? '#22c55e' : '#eab308' }]}>
                {fps}
              </Text>
            </View>
          </View>

          {/* Live Camera Stream Section (ESP32-CAM via WebSocket) */}
          <View style={styles.cameraSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LIVE CAMERA FEED (ESP32-CAM)</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>WEBSOCKET</Text>
              </View>
            </View>

            {/* Drone Camera Component */}
            <DroneCameraView
              defaultServerUrl="ws://10.86.148.147:8888"
              onFpsChange={setFps}
            />
          </View>

          {/* Flight Mode Selector */}
          <View style={styles.controlCard}>
            <Text style={styles.controlCardTitle}>FLIGHT MODES</Text>
            <View style={styles.modeRow}>
              {(['MANUAL', 'ALT_HOLD', 'RTH'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modeButton,
                    flightMode === mode && styles.modeButtonActive,
                  ]}
                  onPress={() => setFlightMode(mode)}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      flightMode === mode && styles.modeButtonTextActive,
                    ]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Primary Drone Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isArmed ? styles.actionBtnDisarm : styles.actionBtnArm,
              ]}
              onPress={() => setIsArmed(!isArmed)}>
              <Text style={styles.actionBtnText}>
                {isArmed ? 'DISARM MOTORS' : 'ARM MOTORS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnEmergency]}
              onPress={() => {
                setIsArmed(false);
                alert('EMERGENCY STOP TRIGGERED: Motors cut off');
              }}>
              <Text style={styles.actionBtnEmergencyText}>EMERGENCY STOP</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Guide / Help Note */}
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>💡 WebSocket Setup Note</Text>
            <Text style={styles.noteContent}>
              1. สั่งรัน Server ด้วยคำสั่ง <Text style={styles.codeText}>npm run server</Text>{'\n'}
              2. ตรวจสอบ IP เครื่องใน Terminal และนำไปใส่ใน <Text style={styles.codeText}>CameraWebServerLocalHost.ino</Text>{'\n'}
              3. กดปุ่ม <Text style={styles.codeText}>⚙️ IP</Text> บนจอกล้องเพื่อเปลี่ยน WebSocket URL ให้ตรงกัน
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  armedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  armedText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cameraSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
    marginRight: 4,
  },
  liveText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  controlCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  controlCardTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeButtonActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  modeButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnArm: {
    backgroundColor: '#15803d',
  },
  actionBtnDisarm: {
    backgroundColor: '#b45309',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionBtnEmergency: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  actionBtnEmergencyText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noteCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noteTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  noteContent: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 20,
  },
  codeText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
