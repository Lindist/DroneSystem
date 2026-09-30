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
  serverUrl = 'http://192.168.43.10:81/stream',
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
          if (data.status !== 'CONNECTED' && onFpsChange) {
            onFpsChange(0);
          }
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
  <img id="stream" alt="Cathoa FPV Video Feed" />
  <script>
    const img = document.getElementById('stream');
    const TARGET_URL = '${serverUrl.trim()}';
    const isHttp = TARGET_URL.startsWith('http://') || TARGET_URL.startsWith('https://');
    let ws;
    let urlObject;
    let frameCount = 0;
    let abortController = null;

    function sendToNative(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // ส่งค่า FPS ไปยังฝั่ง Native ทุกๆ 1 วินาที
    setInterval(() => {
      sendToNative({ type: 'FPS', fps: frameCount });
      frameCount = 0;
    }, 1000);

    if (isHttp) {
      // ----------------------------------------------------
      // โหมด Standalone: เชื่อมต่อตรงไปยัง ESP32-CAM MJPEG Stream
      // ใช้ ReadableStream แยกเฟรม JPEG เพื่อคำนวณ FPS จริงแบบ Real-time
      // ----------------------------------------------------
      sendToNative({ type: 'STATUS', status: 'CONNECTING' });

      function appendBuffer(b1, b2) {
        const merged = new Uint8Array(b1.length + b2.length);
        merged.set(b1, 0);
        merged.set(b2, b1.length);
        return merged;
      }

      async function startMjpegStream() {
        if (abortController) {
          try { abortController.abort(); } catch (e) {}
        }
        abortController = new AbortController();

        try {
          const res = await fetch(TARGET_URL, {
            signal: abortController.signal,
            cache: 'no-store'
          });

          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }

          sendToNative({ type: 'STATUS', status: 'CONNECTED' });

          const reader = res.body.getReader();
          let buf = new Uint8Array(0);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            buf = appendBuffer(buf, value);

            while (true) {
              // ค้นหาจุดเริ่มต้นของไฟล์ JPEG (SOI): 0xFF, 0xD8
              let startIndex = -1;
              for (let i = 0; i < buf.length - 1; i++) {
                if (buf[i] === 0xFF && buf[i + 1] === 0xD8) {
                  startIndex = i;
                  break;
                }
              }

              if (startIndex === -1) {
                if (buf.length > 1) {
                  buf = buf.slice(-1);
                }
                break;
              }

              // ค้นหาจุดสิ้นสุดของไฟล์ JPEG (EOI): 0xFF, 0xD9
              let endIndex = -1;
              for (let i = startIndex + 2; i < buf.length - 1; i++) {
                if (buf[i] === 0xFF && buf[i + 1] === 0xD9) {
                  endIndex = i + 2;
                  break;
                }
              }

              if (endIndex === -1) {
                if (startIndex > 0) {
                  buf = buf.slice(startIndex);
                }
                break;
              }

              // ได้ภาพ JPEG 1 เฟรมเต็ม
              const frameBytes = buf.slice(startIndex, endIndex);
              frameCount++;

              if (urlObject) {
                URL.revokeObjectURL(urlObject);
              }
              urlObject = URL.createObjectURL(new Blob([frameBytes], { type: 'image/jpeg' }));
              img.src = urlObject;

              buf = buf.slice(endIndex);
            }
          }

          sendToNative({ type: 'STATUS', status: 'DISCONNECTED' });
          setTimeout(startMjpegStream, 1500);

        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('MJPEG fetch reader error:', err);
          sendToNative({ type: 'STATUS', status: 'ERROR' });

          // ถ้าเกิดข้อผิดพลาด ให้ fallback ใช้ img.src ชั่วคราว และลองต่อใหม่
          img.src = TARGET_URL + (TARGET_URL.includes('?') ? '&' : '?') + '_t=' + Date.now();
          setTimeout(startMjpegStream, 2500);
        }
      }

      startMjpegStream();

    } else {
      // ----------------------------------------------------
      // โหมด WebSocket Relay (สำหรับระบบที่รัน Server ตัวกลาง)
      // ----------------------------------------------------
      function connectWs() {
        sendToNative({ type: 'STATUS', status: 'CONNECTING' });
        try {
          ws = new WebSocket(TARGET_URL);
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
            setTimeout(connectWs, 2000);
          };
        } catch (e) {
          sendToNative({ type: 'STATUS', status: 'ERROR' });
          setTimeout(connectWs, 2000);
        }
      }

      connectWs();
    }
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
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
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
