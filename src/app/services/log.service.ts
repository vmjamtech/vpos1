import { Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root',
})
export class LogService {
  constructor() {}

  /** Generate log file name based on current date: log-YYYY-DD-MM.txt */
  private getLogFileName(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getDate())}-${pad(
      now.getMonth() + 1
    )}`;
    return `log-${dateStr}.txt`;
  }

  /** Convert a Blob to string */
  private async blobToText(blob: Blob): Promise<string> {
    return await new Response(blob).text();
  }

  /** Append a new log entry */
  async log(entry: string | Blob): Promise<void> {
    try {
      const content: string =
        entry instanceof Blob ? await this.blobToText(entry) : entry;

      // Format timestamp as YYYY-DD-MM HH:mm:ss
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getDate())}-${pad(
        now.getMonth() + 1
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
        now.getSeconds()
      )}`;

      const logLine = `[${timestamp}] ${content}\n`;
      const logFileName = this.getLogFileName();

      // Read existing log (if any)
      let existing = '';
      try {
        const result = await Filesystem.readFile({
          path: logFileName,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        existing =
          typeof result.data === 'string'
            ? result.data
            : await this.blobToText(result.data);
      } catch {
        // File does not exist, will create
      }

      // Write updated log back
      await Filesystem.writeFile({
        path: logFileName,
        data: existing + logLine,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  /** Read today's log */
  async readLog(): Promise<string> {
    const logFileName = this.getLogFileName();
    try {
      const result = await Filesystem.readFile({
        path: logFileName,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return typeof result.data === 'string'
        ? result.data
        : await this.blobToText(result.data);
    } catch {
      return '';
    }
  }

  /** Clear today's log */
  async clearLog(): Promise<void> {
    const logFileName = this.getLogFileName();
    try {
      await Filesystem.deleteFile({
        path: logFileName,
        directory: Directory.Data,
      });
    } catch {
      // ignore if file doesn't exist
    }
  }
}
