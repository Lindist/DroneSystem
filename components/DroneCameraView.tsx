import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Line } from 'react-native-svg';

interface DroneCameraViewProps {
  serverUrl?: string;
  onFpsChange?: (fps: number) => void;
  className?: string;
}

export const DroneCameraView: React.FC<DroneCameraViewProps> = ({
  serverUrl = 'ws://10.86.148.147:8888',
  onFpsChange,
  className = '',
}) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  >('CONNECTING');
  const [fps, setFps] = useState<number>(0);
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
      background-color: #d1d5db;
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

  return (
    <View className={`w-full h-full bg-[#d1d5db] relative overflow-hidden ${className}`}>
      {/* WebView Live Stream */}
      <WebView
        ref={webViewRef}
        key={serverUrl}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        className="w-full h-full bg-[#d1d5db]"
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
      />

      {/* เส้นกากบาททะแยงมุม X (Optical Framing Guide) ตามแบบร่าง */}
      <View className="absolute inset-0 pointer-events-none" style={{ opacity: 0.55 }}>
        <Svg width="100%" height="100%">
          <Line x1="0" y1="0" x2="100%" y2="100%" stroke="#1f2937" strokeWidth="1.2" />
          <Line x1="100%" y1="0" x2="0" y2="100%" stroke="#1f2937" strokeWidth="1.2" />
        </Svg>
      </View>

      {/* แถบ HUD ด้านบนของกล้องตามแบบร่างเป๊ะๆ */}
      <View className="absolute top-0 left-0 right-0 h-6 bg-[#b8bcc4]/70 flex-row items-center justify-between px-3 z-20">
        {/* จุดเขียว และ CONNECTED */}
        <View className="flex-row items-center gap-1.5">
          <View
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'CONNECTED' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
            }`}
          />
          <Text className="text-[#374151] text-[10px] font-bold tracking-wider">
            {connectionStatus === 'CONNECTED' ? 'CONNECTED' : connectionStatus}
          </Text>
        </View>

        {/* SIGNAL และ FPS */}
        <View className="flex-row items-center gap-4">
          <Text className="text-[#4b5563] text-[10px] font-semibold tracking-wide">
            SIGNAL: -62 dBm
          </Text>
          <Text className="text-[#4b5563] text-[10px] font-semibold tracking-wide">
            FPS: {fps > 0 ? fps : 26}
          </Text>
        </View>

        {/* แบตเตอรี่กล่องดำมน [ 100% ] */}
        <View className="flex-row items-center bg-black px-1.5 py-0.5 rounded-[4px]">
          <Text className="text-white text-[9px] font-bold tracking-tighter">
            100%
          </Text>
        </View>
      </View>

      {/* Overlay แจ้งเตือนเมื่อหลุดการเชื่อมต่อ */}
      {connectionStatus !== 'CONNECTED' && (
        <View className="absolute inset-0 bg-[#d1d5db]/80 justify-center items-center p-4 z-10">
          <ActivityIndicator size="small" color="#1f2937" />
          <Text className="text-[#374151] text-xs font-semibold mt-2">
            Connecting to {serverUrl}...
          </Text>
        </View>
      )}
    </View>
  );
};
