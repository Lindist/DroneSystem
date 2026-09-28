import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface DroneCameraViewProps {
  defaultServerUrl?: string;
  onFpsChange?: (fps: number) => void;
  className?: string;
}

export const DroneCameraView: React.FC<DroneCameraViewProps> = ({
  defaultServerUrl = 'ws://10.86.148.147:8888',
  onFpsChange,
  className = '',
}) => {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [customUrl, setCustomUrl] = useState(defaultServerUrl);
  const [connectionStatus, setConnectionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  >('CONNECTING');
  const [fps, setFps] = useState<number>(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const webViewRef = useRef<WebView>(null);

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

  const getStatusBgColor = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return 'bg-emerald-500';
      case 'CONNECTING':
        return 'bg-amber-500';
      case 'ERROR':
        return 'bg-rose-500';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <View className={`w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative ${className}`}>
      {/* Hardware-Accelerated Zero-Flicker Stream Engine */}
      <WebView
        ref={webViewRef}
        key={serverUrl}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        className="w-full h-full bg-[#030712]"
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
      />

      {/* Loading Overlay */}
      {connectionStatus !== 'CONNECTED' && (
        <View className="absolute inset-0 bg-[#030712]/90 justify-center items-center p-4 z-10">
          {connectionStatus === 'CONNECTING' ? (
            <ActivityIndicator size="large" color="#38bdf8" />
          ) : (
            <Text className="text-slate-300 text-sm font-semibold mt-2">
              {connectionStatus === 'ERROR'
                ? '⚠️ Failed to connect to server'
                : 'Reconnecting to Drone Stream...'}
            </Text>
          )}
          <Text className="text-slate-500 text-xs mt-1">{serverUrl}</Text>
        </View>
      )}

      {/* HUD Crosshair Center */}
      <View className="absolute top-1/2 left-1/2 -mt-7 -ml-7 w-14 h-14 justify-center items-center pointer-events-none z-10">
        <View className="w-10 h-10 rounded-full border border-sky-400/40" />
        <View className="absolute w-14 h-[1px] bg-sky-400/50" />
        <View className="absolute w-[1px] h-14 bg-sky-400/50" />
      </View>

      {/* HUD Telemetry Top Bar */}
      <View className="absolute top-2.5 left-2.5 right-2.5 flex-row items-center justify-between z-20">
        <View className="flex-row items-center bg-slate-900/80 px-2.5 py-1 rounded-md border border-sky-400/20">
          <View className={`w-2 h-2 rounded-full mr-2 ${getStatusBgColor()}`} />
          <Text className="text-slate-200 text-[10px] font-bold tracking-wider font-mono">
            {connectionStatus}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="bg-slate-900/80 px-2.5 py-1 rounded-md border border-sky-400/20">
            <Text className="text-slate-200 text-[10px] font-bold font-mono">
              FPS: {fps}
            </Text>
          </View>

          <View className="bg-slate-900/80 px-2.5 py-1 rounded-md border border-sky-400/20">
            <Text className="text-sky-400 text-[10px] font-bold font-mono">
              HW ACCEL
            </Text>
          </View>

          <TouchableOpacity
            className="bg-slate-900/90 px-2.5 py-1 rounded-md border border-sky-400"
            onPress={() => setIsConfigOpen(!isConfigOpen)}>
            <Text className="text-sky-400 text-[10px] font-bold">⚙️ IP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* IP Configuration Bar */}
      {isConfigOpen && (
        <View className="absolute bottom-2.5 left-2.5 right-2.5 p-3 bg-slate-900/95 rounded-xl border border-slate-700 z-30 shadow-2xl">
          <Text className="text-slate-400 text-xs mb-1.5 font-medium">
            WebSocket Server URL:
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 bg-slate-800 text-slate-100 px-3 py-1.5 rounded-lg text-xs border border-slate-700"
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="ws://192.168.1.xxx:8888"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              className="bg-sky-600 px-4 justify-center items-center rounded-lg"
              onPress={() => {
                setServerUrl(customUrl);
                setIsConfigOpen(false);
              }}>
              <Text className="text-white text-xs font-bold">Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
