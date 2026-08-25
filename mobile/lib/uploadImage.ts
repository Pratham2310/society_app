import { Platform } from 'react-native';
import { API } from '../constants/api';

/**
 * Upload a picked file (image or document) to Cloudinary via the backend and
 * return its URL. Handles the platform difference in multipart bodies:
 *  - native: React Native accepts `{ uri, name, type }`
 *  - web: FormData needs a real Blob (the `{ uri }` object becomes "[object
 *    Object]" and the upload fails), so we fetch the blob from the uri first.
 */
export async function uploadPickedFile(
  file: { uri: string; name?: string | null; mimeType?: string | null },
  token: string,
): Promise<string> {
  const name = file.name || `upload-${Date.now()}.jpg`;
  const mime = file.mimeType || 'image/jpeg';

  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri: file.uri, name, type: mime } as any);
  }

  const res = await fetch(API.UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // let fetch set the multipart boundary
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.fileUrl) throw new Error(json.message || 'Upload failed');
  return json.fileUrl as string;
}
