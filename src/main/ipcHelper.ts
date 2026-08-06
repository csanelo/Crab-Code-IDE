import { ipcMain, type IpcMainInvokeEvent } from "electron";

export function handleIpc(
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => any
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}
