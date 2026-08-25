// SDK 54 moved cacheDirectory/EncodingType behind the legacy entry point.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/**
 * Share a gate pass — the QR image where possible, the details as text
 * otherwise.
 *
 * React Native's Share is not implemented on react-native-web, and
 * expo-sharing needs a real filesystem, so on the web build both paths did
 * nothing at all: tapping "Share" appeared to be ignored. The web branch below
 * uses the browser's own share sheet, and falls back to downloading the QR so
 * the resident always ends up with something they can send on.
 *
 * Returns a short line describing what happened, or null when the user simply
 * dismissed the share sheet — callers show it as an on-screen notice.
 */
export type PassShare = {
  /** QR as a data: URI, exactly as the API returns it. */
  qr: string;
  passCode: string;
  /** Message body: who the pass is for, where, until when. */
  text: string;
  /** Used for the file name; keep it filesystem-safe. */
  fileLabel?: string;
};

const fileNameFor = (p: PassShare) =>
  `gate-pass-${(p.fileLabel || p.passCode).replace(/[^a-zA-Z0-9-_]/g, '-')}.png`;

function dataUriToBlob(dataUri: string): Blob {
  const [meta, b64] = dataUri.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function shareOnWeb(pass: PassShare): Promise<string | null> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  const fileName = fileNameFor(pass);

  // 1. Native browser share sheet, with the QR attached when allowed.
  if (nav?.share) {
    try {
      const blob = dataUriToBlob(pass.qr);
      const file = new File([blob], fileName, { type: blob.type });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: pass.text, title: 'Gate pass' });
        return null;
      }
      await nav.share({ text: pass.text, title: 'Gate pass' });
      return null;
    } catch (err: any) {
      // AbortError means the user closed the sheet — that isn't a failure.
      if (err?.name === 'AbortError') return null;
      // Anything else: fall through to the download path.
    }
  }

  // 2. No share sheet (desktop Chrome, most in-app browsers): hand them the
  //    file and put the details on the clipboard.
  try {
    const url = URL.createObjectURL(dataUriToBlob(pass.qr));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    try { await nav?.clipboard?.writeText(pass.text); } catch { /* clipboard blocked */ }
    return 'QR downloaded and the details copied — send them to your visitor.';
  } catch {
    try { await nav?.clipboard?.writeText(pass.text); } catch { /* ignore */ }
    return 'Pass details copied to the clipboard.';
  }
}

export async function sharePass(pass: PassShare): Promise<string | null> {
  if (Platform.OS === 'web') return shareOnWeb(pass);

  try {
    // Write the QR out as a real PNG so the share sheet can attach the image.
    const base64 = pass.qr.replace(/^data:image\/\w+;base64,/, '');
    const fileUri = `${FileSystem.cacheDirectory}${fileNameFor(pass)}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Send gate pass',
        UTI: 'public.png',
      });
      return null;
    }
  } catch {
    // Fall through to a plain text share.
  }

  try {
    await Share.share({ message: pass.text });
    return null;
  } catch {
    return 'Could not open the share sheet. The pass code is on screen — send that instead.';
  }
}
