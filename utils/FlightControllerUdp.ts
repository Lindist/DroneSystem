import { Buffer } from 'buffer';

// พยายามโหลด react-native-udp แบบ Dynamic ป้องกันปัญหาในโหมดที่ไม่มี Native Module (เช่น Expo Go)
let dgram: any = null;
try {
  dgram = require('react-native-udp');
} catch (e) {
  console.warn('[UDP] react-native-udp not loaded or not in native runtime:', e);
}

class FlightControllerService {
  private socket: any = null;
  private targetIp: string = '192.168.43.50';
  private targetPort: number = 4210;
  private isSocketBound: boolean = false;
  private lastSentString: string = '';
  private packetCount: number = 0;

  constructor() {
    this.initSocket();
  }

  public initSocket() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {}
      this.socket = null;
    }

    if (dgram && typeof dgram.createSocket === 'function') {
      try {
        this.socket = dgram.createSocket({ type: 'udp4' });
        this.socket.on('error', (err: any) => {
          console.warn('[UDP Error]', err);
        });
        this.socket.bind(0); // สุ่ม local port สำหรับส่ง
        this.isSocketBound = true;
        console.log('[UDP] Flight Controller Socket initialized successfully');
      } catch (err) {
        console.warn('[UDP] Failed to initialize native UDP socket:', err);
        this.isSocketBound = false;
      }
    } else {
      console.log('[UDP] Running in simulation/dev mode (no native UDP module active)');
      this.isSocketBound = false;
    }
  }

  public setTarget(ip: string, port: number = 4210) {
    this.targetIp = ip.trim();
    this.targetPort = Number(port) || 4210;
    console.log(`[UDP Target] Set to ${this.targetIp}:${this.targetPort}`);
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

    if (this.socket && this.isSocketBound) {
      try {
        const buf = Buffer.from(packet);
        this.socket.send(buf, 0, buf.length, this.targetPort, this.targetIp, (err: any) => {
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
}

export const flightController = new FlightControllerService();
