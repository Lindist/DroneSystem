import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface DroneCameraViewProps {
  defaultServerUrl?: string;
  onFpsChange?: (fps: number) => void;
}

export const DroneCameraView: React.FC<DroneCameraViewProps> = ({
  defaultServerUrl = 'ws://10.86.148.147:8888',
  onFpsChange,
}) => {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [customUrl, setCustomUrl] = useState(defaultServerUrl);
  const [connectionStatus, setConnectionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  >('CONNECTING');
  const [fps, setFps] = useState<number>(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // รับข้อความสถานะและ FPS จาก WebView Stream Engine
  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'STATUS') {
          setConnectionStatus(data.status);
        } else if (data.type === 'FPS') {
          setFps(data.fps);
          if (onFpsChange) onFpsChange(data.fps);
        }
      } catch (err) {
        // ignore non-json messages
      }
    },
    [onFpsChange]
  );

  // สร้าง HTML Streaming Engine โดยใช้ Blob และ ObjectURL แบบเดียวกับ client.html
  // วิธีนี้ใช้ GPU Hardware Acceleration โดยตรง ไม่ต้องแปลง Base64 และไม่มีทางกระพริบดำ 100%
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #030712;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #stream {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background-color: #030712;
    }
  </style>
</head>
<body>
  <img id="stream" />
  <script>
    const img = document.getElementById('stream');
    const WS_URL = '${serverUrl}';
    let ws;
    let urlObject;
    let frameCount = 0;

    function sendToNative(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // คำนวณและส่งค่า FPS กลับไปที่ React Native UI ทุก 1 วินาที
    setInterval(() => {
      sendToNative({ type: 'FPS', fps: frameCount });
      frameCount = 0;
    }, 1000);

    function connect() {
      sendToNative({ type: 'STATUS', status: 'CONNECTING' });
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        sendToNative({ type: 'STATUS', status: 'CONNECTED' });
      };

      ws.onmessage = (message) => {
        frameCount++;
        const arrayBuffer = message.data;
        if (urlObject) {
          URL.revokeObjectURL(urlObject);
        }
        urlObject = URL.createObjectURL(new Blob([arrayBuffer]));
        img.src = urlObject;
      };

      ws.onerror = () => {
        sendToNative({ type: 'STATUS', status: 'ERROR' });
      };

      ws.onclose = () => {
        sendToNative({ type: 'STATUS', status: 'DISCONNECTED' });
        setTimeout(connect, 2000);
      };
    }

    connect();
  </script>
</body>
</html>
  `;

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return '#22c55e'; // Green
      case 'CONNECTING':
        return '#eab308'; // Amber
      case 'ERROR':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Slate
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Viewport / HUD */}
      <View style={styles.viewport}>
        {/* Hardware-Accelerated Zero-Flicker Stream Engine */}
        <WebView
          ref={webViewRef}
          key={serverUrl}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
        />

        {/* Loading Overlay เมื่อยังไม่ต่อติด */}
        {connectionStatus !== 'CONNECTED' && (
          <View style={styles.loadingOverlay}>
            {connectionStatus === 'CONNECTING' ? (
              <ActivityIndicator size="large" color="#38bdf8" />
            ) : (
              <Text style={styles.placeholderText}>
                {connectionStatus === 'ERROR'
                  ? '⚠️ Failed to connect to server'
                  : 'Reconnecting to Drone Stream...'}
              </Text>
            )}
            <Text style={styles.placeholderSubtext}>{serverUrl}</Text>
          </View>
        )}

        {/* HUD Crosshair & Overlays */}
        <View style={styles.crosshairCenter}>
          <View style={styles.crosshairCircle} />
          <View style={styles.crosshairHoriz} />
          <View style={styles.crosshairVert} />
        </View>

        {/* HUD Telemetry Top Bar */}
        <View style={styles.telemetryOverlay}>
          <View style={styles.hudBadge}>
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <Text style={styles.hudText}>{connectionStatus}</Text>
          </View>

          <View style={styles.hudBadge}>
            <Text style={styles.hudText}>FPS: {fps}</Text>
          </View>

          <View style={styles.hudBadge}>
            <Text style={styles.hudText}>HARDWARE: ACCEL</Text>
          </View>

          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => setIsConfigOpen(!isConfigOpen)}>
            <Text style={styles.configBtnText}>⚙️ IP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* IP Configuration Bar */}
      {isConfigOpen && (
        <View style={styles.configPanel}>
          <Text style={styles.configLabel}>WebSocket Server URL:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="ws://192.168.1.xxx:8888"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => {
                setServerUrl(customUrl);
                setIsConfigOpen(false);
              }}>
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#090d16',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  viewport: {
    width: '100%',
    height: 260,
    backgroundColor: '#030712',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#030712',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 5,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  placeholderSubtext: {
    color: '#475569',
    fontSize: 12,
    marginTop: 4,
  },
  crosshairCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginTop: -30,
    marginLeft: -30,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
  crosshairCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  crosshairHoriz: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.5)',
  },
  crosshairVert: {
    position: 'absolute',
    width: 1,
    height: 60,
    backgroundColor: 'rgba(56, 189, 248, 0.5)',
  },
  telemetryOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  hudText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  configBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  configBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  configPanel: {
    padding: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  configLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  connectButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
