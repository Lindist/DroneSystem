import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface DroneCameraViewProps {
  serverUrl?: string;
  onFpsChange?: (fps: number) => void;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export const DroneCameraView: React.FC<DroneCameraViewProps> = ({
  serverUrl = 'ws://10.86.148.147:8888',
  onFpsChange,
  onStatusChange,
  className = '',
}) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  >('CONNECTING');
  const webViewRef = useRef<WebView>(null);

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'STATUS') {
          setConnectionStatus(data.status);
          if (onStatusChange) onStatusChange(data.status);
        } else if (data.type === 'FPS') {
          if (onFpsChange) onFpsChange(data.fps);
        }
      } catch (err) {
        // ignore non-json messages
      }
    },
    [onFpsChange, onStatusChange]
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
      background-color: #000;
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
    <View className={`w-full h-full bg-black relative overflow-hidden ${className}`}>
      {/* WebView Live Stream */}
      <WebView
        ref={webViewRef}
        key={serverUrl}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        className="w-full h-full bg-black"
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
      />

      {/* Overlay แจ้งเตือนเมื่อหลุดการเชื่อมต่อ */}
      {connectionStatus !== 'CONNECTED' && (
        <View className="absolute inset-0 bg-black/80 justify-center items-center p-4 z-10">
          <ActivityIndicator size="small" color="#94a3b8" />
          <Text className="text-slate-400 text-xs font-semibold mt-2">
            Connecting to {serverUrl}...
          </Text>
        </View>
      )}
    </View>
  );
};
