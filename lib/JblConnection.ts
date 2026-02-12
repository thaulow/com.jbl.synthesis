'use strict';

import { EventEmitter } from 'events';
import * as net from 'net';
import {
  buildCommand, buildQuery, buildRC5,
  parseResponse, isError, errorMessage,
  Cmd, Zone,
  type JblResponse,
} from './JblProtocol';

export interface ConnectionOptions {
  host: string;
  port: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  commandTimeout?: number;
}

interface QueuedCommand {
  buffer: Buffer;
  resolve: (response: JblResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class JblConnection extends EventEmitter {
  private socket: net.Socket | null = null;
  private options: Required<ConnectionOptions>;
  private receiveBuffer = Buffer.alloc(0);
  private commandQueue: QueuedCommand[] = [];
  private currentCommand: QueuedCommand | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;
  private _connected = false;

  constructor(options: ConnectionOptions) {
    super();
    this.options = {
      reconnectDelay: 3000,
      maxReconnectDelay: 60000,
      heartbeatInterval: 30000,
      commandTimeout: 5000,
      ...options,
    };
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    this.intentionalDisconnect = false;
    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.destroy();
      }

      this.socket = new net.Socket();
      this.socket.setNoDelay(true);

      const connectTimeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error(`Connection timeout to ${this.options.host}:${this.options.port}`));
      }, 10000);

      this.socket.once('connect', () => {
        clearTimeout(connectTimeout);
        this._connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data: Buffer) => this.onData(data));

      this.socket.on('error', (err: Error) => {
        clearTimeout(connectTimeout);
        this.emit('error', err);
      });

      this.socket.on('close', () => {
        const wasConnected = this._connected;
        this._connected = false;
        this.stopHeartbeat();
        this.rejectPending('Connection closed');

        if (wasConnected) {
          this.emit('disconnected');
        }

        if (!this.intentionalDisconnect) {
          this.scheduleReconnect();
        }
      });

      this.socket.connect(this.options.port, this.options.host);
    });
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnect();
    this.rejectPending('Disconnecting');

    return new Promise((resolve) => {
      if (!this.socket) {
        this._connected = false;
        resolve();
        return;
      }

      this.socket.once('close', () => {
        this._connected = false;
        resolve();
      });

      this.socket.destroy();
      this.socket = null;
    });
  }

  /**
   * Send a command and wait for the response.
   * Commands are queued and sent one at a time.
   */
  async sendCommand(zone: Zone, cmd: Cmd, data: number[]): Promise<JblResponse> {
    const buffer = buildCommand(zone, cmd, data);
    return this.enqueue(buffer);
  }

  /**
   * Send a query (request current value) and wait for the response.
   */
  async query(zone: Zone, cmd: Cmd): Promise<JblResponse> {
    const buffer = buildQuery(zone, cmd);
    return this.enqueue(buffer);
  }

  /**
   * Send an RC5 IR command.
   */
  async sendRC5(zone: Zone, system: number, command: number): Promise<JblResponse> {
    const buffer = buildRC5(zone, system, command);
    return this.enqueue(buffer);
  }

  /**
   * Try to connect and send a heartbeat to verify the connection.
   * Used during pairing to test connectivity.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      const response = await this.query(Zone.MASTER, Cmd.HEARTBEAT);
      return !isError(response);
    } catch (_err) {
      return false;
    } finally {
      await this.disconnect();
    }
  }

  // ── Private Methods ───────────────────────────────────────────────────────

  private enqueue(buffer: Buffer): Promise<JblResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue if still pending
        const idx = this.commandQueue.findIndex((q) => q.timeout === timeout);
        if (idx !== -1) {
          this.commandQueue.splice(idx, 1);
        }
        if (this.currentCommand?.timeout === timeout) {
          this.currentCommand = null;
          this.processQueue();
        }
        reject(new Error('Command timeout'));
      }, this.options.commandTimeout);

      const queued: QueuedCommand = {
        buffer, resolve, reject, timeout,
      };
      this.commandQueue.push(queued);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.currentCommand) return;
    if (this.commandQueue.length === 0) return;
    if (!this._connected || !this.socket) return;

    this.currentCommand = this.commandQueue.shift()!;

    try {
      this.socket.write(this.currentCommand.buffer);
    } catch (err) {
      clearTimeout(this.currentCommand.timeout);
      this.currentCommand.reject(err instanceof Error ? err : new Error(String(err)));
      this.currentCommand = null;
      this.processQueue();
    }
  }

  private onData(data: Buffer): void {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    // Process all complete messages in the buffer
    let result = parseResponse(this.receiveBuffer);
    while (result) {
      const { response, bytesConsumed } = result;
      this.receiveBuffer = Buffer.from(this.receiveBuffer.subarray(bytesConsumed));

      // If this is a response to our current command, resolve it
      if (this.currentCommand) {
        clearTimeout(this.currentCommand.timeout);

        if (isError(response)) {
          this.currentCommand.reject(new Error(errorMessage(response.answer)));
        } else {
          this.currentCommand.resolve(response);
        }

        this.currentCommand = null;
        // Small delay between commands to not overwhelm the device
        setTimeout(() => this.processQueue(), 50);
      } else {
        // Unsolicited status update
        this.emit('status', response);
      }

      result = parseResponse(this.receiveBuffer);
    }

    // Prevent buffer from growing unbounded with garbage data
    if (this.receiveBuffer.length > 1024) {
      this.receiveBuffer = Buffer.alloc(0);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.query(Zone.MASTER, Cmd.HEARTBEAT).catch(() => {
        // Heartbeat failure will trigger reconnect via socket close
      });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // connect failure will trigger close which will schedule another reconnect
      });
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectPending(reason: string): void {
    if (this.currentCommand) {
      clearTimeout(this.currentCommand.timeout);
      this.currentCommand.reject(new Error(reason));
      this.currentCommand = null;
    }
    for (const queued of this.commandQueue) {
      clearTimeout(queued.timeout);
      queued.reject(new Error(reason));
    }
    this.commandQueue = [];
  }
}
