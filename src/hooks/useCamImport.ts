import { useState } from 'react';
import { BRIDGE_URL } from '../bridge';

export interface CamImportApi {
  camOpen: boolean;
  camUrl: string;
  camBusy: boolean;
  camError: string | null;
  openCam: () => void;
  closeCam: () => void;
  setCamUrl: (v: string) => void;
  importFromCamScanner: () => Promise<void>;
}

/** 扫描全能王分享链接导入：状态 + 桥接请求编排。 */
export function useCamImport(
  importPdf: (name: string, buffer: ArrayBuffer) => Promise<void>,
): CamImportApi {
  const [camOpen, setCamOpen] = useState(false);
  const [camUrl, setCamUrl] = useState('');
  const [camBusy, setCamBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const importFromCamScanner = async () => {
    const url = camUrl.trim();
    if (url === '') return;
    setCamBusy(true);
    setCamError(null);
    try {
      const res = await fetch(`${BRIDGE_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        let message = `桥接服务返回 HTTP ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* 非 JSON 响应，保留默认消息 */
        }
        throw new Error(message);
      }
      const filename = decodeURIComponent(res.headers.get('X-Pdf-Filename') || '扫描全能王-分享.pdf');
      const buffer = await res.arrayBuffer();
      await importPdf(filename, buffer);
      setCamOpen(false);
      setCamUrl('');
    } catch (err) {
      if (err instanceof TypeError) {
        setCamError('无法连接桥接服务，请先在项目目录运行「npm run bridge」');
      } else {
        setCamError(err instanceof Error ? err.message : '导入失败');
      }
    } finally {
      setCamBusy(false);
    }
  };

  return {
    camOpen,
    camUrl,
    camBusy,
    camError,
    openCam: () => setCamOpen(true),
    closeCam: () => {
      if (!camBusy) setCamOpen(false);
    },
    setCamUrl,
    importFromCamScanner,
  };
}
