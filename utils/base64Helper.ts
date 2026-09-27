/**
 * แปลง ArrayBuffer หรือ Uint8Array เป็น Base64 string เพื่อนำไปใช้กับ <Image source={{ uri: 'data:image/jpeg;base64,...' }} />
 */
import * as base64 from 'base64-js';

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return base64.fromByteArray(bytes);
}
