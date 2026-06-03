import { z } from 'zod';

export const PRODUCT_NAME = 'TheOpenHub Skills Studio';
export const CURRENT_PHASE = 'Phase 1';

export const appInfoResponseSchema = z
  .object({
    productName: z.literal(PRODUCT_NAME),
    phase: z.literal(CURRENT_PHASE),
    localFirst: z.literal(true)
  })
  .strict();

export type AppInfo = z.infer<typeof appInfoResponseSchema>;

export const appInfo: AppInfo = {
  productName: PRODUCT_NAME,
  phase: CURRENT_PHASE,
  localFirst: true
};

const emptyRequestSchema = z.object({}).strict();

export const desktopShellContract = {
  appInfo: {
    channel: 'app.info',
    request: emptyRequestSchema,
    response: appInfoResponseSchema
  }
} as const;

export type IpcChannel = (typeof desktopShellContract)[keyof typeof desktopShellContract]['channel'];

export function parseIpcRequest(channel: string, payload: unknown): Record<string, never> {
  if (channel === desktopShellContract.appInfo.channel) {
    return desktopShellContract.appInfo.request.parse(payload);
  }

  throw new Error(`Unknown IPC channel: ${channel}`);
}

export function parseIpcResponse(channel: string, payload: unknown): AppInfo {
  if (channel === desktopShellContract.appInfo.channel) {
    return desktopShellContract.appInfo.response.parse(payload);
  }

  throw new Error(`Unknown IPC channel: ${channel}`);
}
