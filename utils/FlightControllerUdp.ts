import { Buffer } from 'buffer';

// พยายามโหลด react-native-udp แบบ Dynamic ป้องกันปัญหาในโหมดที่ไม่มี Native Module (เช่น Expo Go)
let dgram: any = null;
try {
  dgram = require('react-native-udp');
} catch (e) {
  console.warn('[UDP] react-native-udp not loaded or not in native runtime:', e);
}

export interface DiscoveredDevice {
  type: 'CAM' | 'FC';
  ip: string;
  port?: number;
  streamUrl?: string;
  timestamp: number;
}

type DiscoveryCallback = (device: DiscoveredDevice) => void;

class FlightControllerService {
  // Socket สำหรับส่งข้อมูลควบคุมไปยัง ESP8266
  private sendSocket: any = null;
  private targetIp: string = '192.168.43.50';
  private targetPort: number = 4210;
  private isSocketBound: boolean = false;
  private lastSentString: string = '';
  private packetCount: number = 0;

  // Socket สำหรับรับฟัง UDP Broadcast Auto-Discovery (Port 4212)
  private discoverySocket: any = null;
  private discoveryCallbacks: Set<DiscoveryCallback> = new Set();
  private lastDiscoveredCam: string | null = null;
  private lastDiscoveredFc: string | null = null;

  constructor() {
    this.initSockets();
  }

  public initSockets() {
    this.initSendSocket();
    this.initDiscoverySocket();
  }

  /**
   * สร้าง Socket สำหรับส่งคำสั่งควบคุมการบิน
   */
  private initSendSocket() {
    if (this.sendSocket) {
      try {
        this.sendSocket.close();
      } catch (err) {}
      this.sendSocket = null;
    }

    if (dgram && typeof dgram.createSocket === 'function') {
      try {
        this.sendSocket = dgram.createSocket({ type: 'udp4' });
        this.sendSocket.on('error', (err: any) => {
          console.warn('[UDP Send Error]', err);
        });
        this.sendSocket.bind(0); // สุ่ม local port สำหรับส่ง
        this.isSocketBound = true;
        console.log('[UDP] Flight Controller Send Socket ready');
      } catch (err) {
        console.warn('[UDP] Failed to initialize native UDP send socket:', err);
        this.isSocketBound = false;
      }
    } else {
      this.isSocketBound = false;
    }
  }

  /**
   * สร้าง Socket สำหรับรับฟัง UDP Broadcast Auto-Discovery (Port 4212)
   */
  private initDiscoverySocket() {
    if (this.discoverySocket) {
      try {
        this.discoverySocket.close();
      } catch (err) {}
      this.discoverySocket = null;
    }

    if (dgram && typeof dgram.createSocket === 'function') {
      try {
        this.discoverySocket = dgram.createSocket({ type: 'udp4' });

        this.discoverySocket.on('error', (err: any) => {
          console.warn('[UDP Discovery Error]', err);
        });

        this.discoverySocket.on('message', (msg: Buffer, rinfo: any) => {
          try {
            const text = msg.toString('utf8').trim();
            const remoteIp = rinfo?.address;
            if (!remoteIp) return;

            // ตรวจพบ ESP32-CAM Beacon
            if (text.includes('CATHIO_BEACON:CAM')) {
              const streamUrl = `http://${remoteIp}:81/stream`;
              const device: DiscoveredDevice = {
                type: 'CAM',
                ip: remoteIp,
                port: 81,
                streamUrl,
                timestamp: Date.now(),
              };
              if (this.lastDiscoveredCam !== remoteIp) {
                this.lastDiscoveredCam = remoteIp;
                console.log(`[Auto-Discovery] Found ESP32-CAM at ${remoteIp}`);
              }
              this.discoveryCallbacks.forEach((cb) => cb(device));
            }

            // ตรวจพบ ESP8266 Flight Controller Beacon
            else if (text.includes('CATHIO_BEACON:FC')) {
              const device: DiscoveredDevice = {
                type: 'FC',
                ip: remoteIp,
                port: 4210,
                timestamp: Date.now(),
              };
              if (this.lastDiscoveredFc !== remoteIp) {
                this.lastDiscoveredFc = remoteIp;
                console.log(`[Auto-Discovery] Found ESP8266 FC at ${remoteIp}:4210`);
              }
              this.discoveryCallbacks.forEach((cb) => cb(device));
            }
          } catch (e) {
            console.warn('[Discovery Parse Exception]', e);
          }
        });

        this.discoverySocket.bind(4212, () => {
          try {
            this.discoverySocket.setBroadcast(true);
            console.log('[UDP Discovery] Listening on broadcast port 4212');
          } catch (e) {
            console.warn('[UDP Discovery] setBroadcast error:', e);
          }
        });
      } catch (err) {
        console.warn('[UDP Discovery] Failed to bind discovery socket:', err);
      }
    }
  }

  /**
   * ลงทะเบียนรับ Callback เมื่อพบอุปกรณ์ใหม่ในเครือข่ายอัตโนมัติ
   */
  public onDiscovered(callback: DiscoveryCallback) {
    this.discoveryCallbacks.add(callback);
    return () => {
      this.discoveryCallbacks.delete(callback);
    };
  }

  public setTarget(ip: string, port: number = 4210) {
    this.targetIp = ip.trim();
    this.targetPort = Number(port) || 4210;
  }

  public getTarget() {
    return { ip: this.targetIp, port: this.targetPort };
  }

  public isReady() {
    return this.isSocketBound;
  }

  /**
   * ส่งคำสั่งควบคุมไปยัง ESP8266 Flight Controller
   * @param throttle ค่าคันเร่ง 1000 - 2000
   * @param pitch องศา pitch -50 ถึง 50
   * @param roll องศา roll -50 ถึง 50
   * @param yaw ความเร็ว yaw -50 ถึง 50
   */
  public sendCommand(throttle: number, pitch: number, roll: number, yaw: number) {
    const t = Math.min(2000, Math.max(1000, Math.round(throttle)));
    const p = Math.min(50, Math.max(-50, Math.round(pitch)));
    const r = Math.min(50, Math.max(-50, Math.round(roll)));
    const y = Math.min(50, Math.max(-50, Math.round(yaw)));

    // รูปแบบที่ ESP8266 รอรับผ่าน sscanf: "%d,%f,%f,%f"
    const packet = `${t},${p},${r},${y}`;
    this.lastSentString = packet;
    this.packetCount++;

    if (this.sendSocket && this.isSocketBound) {
      try {
        const buf = Buffer.from(packet);
        this.sendSocket.send(buf, 0, buf.length, this.targetPort, this.targetIp, (err: any) => {
          if (err) {
            console.warn('[UDP Send Error]', err);
          }
        });
      } catch (e) {
        console.warn('[UDP Send Exception]', e);
      }
    }
  }

  /**
   * ดับมอเตอร์ฉุกเฉิน
   */
  public emergencyStop() {
    // ส่งคำสั่ง 1000,0,0,0 ซ้ำหลายครั้งเพื่อให้แน่ใจว่าไปถึง ESP8266 ทันที
    for (let i = 0; i < 3; i++) {
      this.sendCommand(1000, 0, 0, 0);
    }
  }

  public getLastPacket() {
    return this.lastSentString;
  }

  public getPacketCount() {
    return this.packetCount;
  }

  public close() {
    if (this.sendSocket) {
      try {
        this.sendSocket.close();
      } catch (e) {}
      this.sendSocket = null;
    }
    if (this.discoverySocket) {
      try {
        this.discoverySocket.close();
      } catch (e) {}
      this.discoverySocket = null;
    }
    this.isSocketBound = false;
  }
}

export const flightController = new FlightControllerService();
