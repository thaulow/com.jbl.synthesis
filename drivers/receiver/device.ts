'use strict';

import Homey from 'homey';
import { JblConnection } from '../../lib/JblConnection';
import {
  Cmd, Zone, RC5,
  INPUT_SOURCE_MAP, INPUT_SOURCE_REVERSE,
  DECODE_MODE_2CH_REVERSE, DECODE_MODE_MCH_REVERSE, DECODE_MODE_MAP,
  SAMPLE_RATE_NAMES,
  encodeSignedValue, decodeSignedValue,
  encodeSubTrim, decodeSubTrim,
  encodeLipsync, decodeLipsync,
  parseVideoInfo, formatVideoResolution,
  parseAudioInfo,
  isError,
  type JblResponse,
} from '../../lib/JblProtocol';

const POLL_INTERVAL_ACTIVE = 10000; // 10s when powered on
const POLL_INTERVAL_STANDBY = 60000; // 60s when in standby

class JblSynthesisDevice extends Homey.Device {
  private connection!: JblConnection;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPowered = false;
  private is2chMode = true;

  async onInit(): Promise<void> {
    const settings = this.getSettings();

    this.connection = new JblConnection({
      host: settings.ip,
      port: settings.port || 50000,
      heartbeatInterval: 30000,
      commandTimeout: 5000,
    });

    this.connection.on('connected', () => {
      this.log('Connected to JBL Synthesis receiver');
      this.setAvailable().catch(this.error);
      this.pollAllStatus().catch(this.error);
    });

    this.connection.on('disconnected', () => {
      this.log('Disconnected from JBL Synthesis receiver');
      this.setUnavailable('Connection lost').catch(this.error);
    });

    this.connection.on('error', (err: Error) => {
      this.error('Connection error:', err.message);
    });

    this.connection.on('reconnecting', ({ attempt, delay }: { attempt: number; delay: number }) => {
      this.log(`Reconnecting attempt ${attempt} in ${delay}ms`);
    });

    this.connection.on('status', (response: JblResponse) => {
      this.handleStatusUpdate(response).catch(this.error);
    });

    this.registerCapabilityListeners();

    try {
      await this.connection.connect();
    } catch (err) {
      this.error('Initial connection failed:', err);
      this.setUnavailable('Cannot connect to receiver').catch(this.error);
    }
  }

  async onUninit(): Promise<void> {
    this.stopPolling();
    if (this.connection) {
      await this.connection.disconnect();
    }
  }

  async onSettings({ newSettings, changedKeys }: { newSettings: { [key: string]: string | number | boolean | null | undefined }; changedKeys: string[] }): Promise<void> {
    if (changedKeys.includes('ip') || changedKeys.includes('port')) {
      await this.connection.disconnect();
      this.connection = new JblConnection({
        host: String(newSettings.ip),
        port: Number(newSettings.port) || 50000,
      });
      // Re-register events
      this.connection.on('connected', () => {
        this.setAvailable().catch(this.error);
        this.pollAllStatus().catch(this.error);
      });
      this.connection.on('disconnected', () => {
        this.setUnavailable('Connection lost').catch(this.error);
      });
      this.connection.on('error', (err: Error) => this.error('Connection error:', err.message));
      this.connection.on('status', (response: JblResponse) => {
        this.handleStatusUpdate(response).catch(this.error);
      });
      await this.connection.connect();
    }
  }

  // ── Capability Listeners ────────────────────────────────────────────────

  private registerCapabilityListeners(): void {
    // Power
    this.registerCapabilityListener('onoff', async (value: boolean) => {
      const rc5cmd = value ? RC5.POWER_ON : RC5.POWER_OFF;
      await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, rc5cmd);
      this.isPowered = value;
      this.restartPolling();
    });

    // Volume (0-1 range mapped to 0-99)
    this.registerCapabilityListener('volume_set', async (value: number) => {
      const vol = Math.round(value * 99);
      await this.connection.sendCommand(Zone.MASTER, Cmd.VOLUME, [vol]);
    });

    // Volume Up/Down
    if (this.hasCapability('volume_up')) {
      this.registerCapabilityListener('volume_up', async () => {
        await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, RC5.VOL_UP);
      });
    }
    if (this.hasCapability('volume_down')) {
      this.registerCapabilityListener('volume_down', async () => {
        await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, RC5.VOL_DOWN);
      });
    }

    // Mute
    this.registerCapabilityListener('volume_mute', async (value: boolean) => {
      const rc5cmd = value ? RC5.MUTE_ON : RC5.MUTE_OFF;
      await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, rc5cmd);
    });

    // Input source
    if (this.hasCapability('input_source')) {
      this.registerCapabilityListener('input_source', async (value: string) => {
        const sourceId = INPUT_SOURCE_MAP[value];
        if (sourceId !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.CURRENT_SOURCE, [sourceId]);
        }
      });
    }

    // Decode mode
    if (this.hasCapability('decode_mode')) {
      this.registerCapabilityListener('decode_mode', async (value: string) => {
        const mode = DECODE_MODE_MAP[value];
        if (mode) {
          const cmd = mode.is2ch ? Cmd.DECODE_MODE_2CH : Cmd.DECODE_MODE_MCH;
          await this.connection.sendCommand(Zone.MASTER, cmd, [mode.value]);
        }
      });
    }

    // Direct mode
    if (this.hasCapability('direct_mode')) {
      this.registerCapabilityListener('direct_mode', async (value: boolean) => {
        const rc5cmd = value ? RC5.DIRECT_ON : RC5.DIRECT_OFF;
        await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, rc5cmd);
      });
    }

    // Bass
    if (this.hasCapability('bass')) {
      this.registerCapabilityListener('bass', async (value: number) => {
        const encoded = encodeSignedValue(Math.round(value));
        await this.connection.sendCommand(Zone.MASTER, Cmd.BASS, [encoded]);
      });
    }

    // Treble
    if (this.hasCapability('treble')) {
      this.registerCapabilityListener('treble', async (value: number) => {
        const encoded = encodeSignedValue(Math.round(value));
        await this.connection.sendCommand(Zone.MASTER, Cmd.TREBLE, [encoded]);
      });
    }

    // Balance
    if (this.hasCapability('balance')) {
      this.registerCapabilityListener('balance', async (value: number) => {
        const encoded = encodeSignedValue(Math.round(value));
        await this.connection.sendCommand(Zone.MASTER, Cmd.BALANCE, [encoded]);
      });
    }

    // Room EQ
    if (this.hasCapability('room_eq')) {
      this.registerCapabilityListener('room_eq', async (value: string) => {
        const modes: Record<string, number> = {
          off: 0x00, eq1: 0x01, eq2: 0x02, eq3: 0x03,
        };
        const mode = modes[value];
        if (mode !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.ROOM_EQ, [mode]);
        }
      });
    }

    // Dolby Audio
    if (this.hasCapability('dolby_audio')) {
      this.registerCapabilityListener('dolby_audio', async (value: string) => {
        const modes: Record<string, number> = {
          off: 0x00, movie: 0x01, music: 0x02, night: 0x03,
        };
        const mode = modes[value];
        if (mode !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.DOLBY_AUDIO, [mode]);
        }
      });
    }

    // Subwoofer trim
    if (this.hasCapability('subwoofer_trim')) {
      this.registerCapabilityListener('subwoofer_trim', async (value: number) => {
        const encoded = encodeSubTrim(value);
        await this.connection.sendCommand(Zone.MASTER, Cmd.SUBWOOFER_TRIM, [encoded]);
      });
    }

    // Sub stereo trim
    if (this.hasCapability('sub_stereo_trim')) {
      this.registerCapabilityListener('sub_stereo_trim', async (value: number) => {
        const encoded = encodeSubTrim(value);
        await this.connection.sendCommand(Zone.MASTER, Cmd.SUB_STEREO_TRIM, [encoded]);
      });
    }

    // Lipsync delay
    if (this.hasCapability('lipsync_delay')) {
      this.registerCapabilityListener('lipsync_delay', async (value: number) => {
        const encoded = encodeLipsync(value);
        await this.connection.sendCommand(Zone.MASTER, Cmd.LIPSYNC_DELAY, [encoded]);
      });
    }

    // Compression
    if (this.hasCapability('compression')) {
      this.registerCapabilityListener('compression', async (value: string) => {
        const modes: Record<string, number> = { off: 0x00, medium: 0x01, high: 0x02 };
        const mode = modes[value];
        if (mode !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.COMPRESSION, [mode]);
        }
      });
    }

    // Display brightness
    if (this.hasCapability('display_brightness')) {
      this.registerCapabilityListener('display_brightness', async (value: string) => {
        const rc5cmds: Record<string, number> = { off: RC5.DISPLAY_OFF, dim: RC5.DISPLAY_L1, bright: RC5.DISPLAY_L2 };
        const rc5cmd = rc5cmds[value];
        if (rc5cmd !== undefined) {
          await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, rc5cmd);
        }
      });
    }

    // HDMI output
    if (this.hasCapability('hdmi_output')) {
      this.registerCapabilityListener('hdmi_output', async (value: string) => {
        const outputs: Record<string, number> = { out1: 0x02, out2: 0x03, both: 0x04 };
        const output = outputs[value];
        if (output !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.VIDEO_OUTPUT_SWITCH, [output]);
        }
      });
    }

    // IMAX Enhanced
    if (this.hasCapability('imax_enhanced')) {
      this.registerCapabilityListener('imax_enhanced', async (value: string) => {
        const modes: Record<string, number> = { auto: 0xF1, on: 0xF2, off: 0xF3 };
        const mode = modes[value];
        if (mode !== undefined) {
          await this.connection.sendCommand(Zone.MASTER, Cmd.IMAX_ENHANCED, [mode]);
        }
      });
    }

    // ── Zone 2 ──────────────────────────────────────────────────────────────

    if (this.hasCapability('zone2_power')) {
      this.registerCapabilityListener('zone2_power', async (value: boolean) => {
        const rc5cmd = value ? RC5.Z2_POWER_ON : RC5.Z2_POWER_OFF;
        await this.connection.sendRC5(Zone.ZONE2, RC5.SYSTEM_ZONE2, rc5cmd);
      });
    }

    if (this.hasCapability('zone2_volume')) {
      this.registerCapabilityListener('zone2_volume', async (value: number) => {
        const vol = Math.round(value * 99);
        await this.connection.sendCommand(Zone.ZONE2, Cmd.VOLUME, [vol]);
      });
    }

    if (this.hasCapability('zone2_mute')) {
      this.registerCapabilityListener('zone2_mute', async (value: boolean) => {
        const rc5cmd = value ? RC5.Z2_MUTE : RC5.Z2_MUTE;
        await this.connection.sendRC5(Zone.ZONE2, RC5.SYSTEM_ZONE2, rc5cmd);
      });
    }

    if (this.hasCapability('zone2_source')) {
      this.registerCapabilityListener('zone2_source', async (value: string) => {
        const sourceId = INPUT_SOURCE_MAP[value];
        if (sourceId !== undefined) {
          await this.connection.sendCommand(Zone.ZONE2, Cmd.CURRENT_SOURCE, [sourceId]);
        }
      });
    }
  }

  // ── Status Polling ──────────────────────────────────────────────────────

  private startPolling(): void {
    this.stopPolling();
    const interval = this.isPowered ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_STANDBY;
    this.pollTimer = setInterval(() => {
      this.pollAllStatus().catch(this.error);
    }, interval);
  }

  private restartPolling(): void {
    this.startPolling();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollAllStatus(): Promise<void> {
    if (!this.connection.connected) return;

    try {
      // Always poll power state
      await this.pollPower();

      if (this.isPowered) {
        // Poll all active capabilities
        await this.pollVolume();
        await this.pollMute();
        await this.pollInputSource();
        await this.pollDecodeMode();
        await this.pollDirectMode();
        await this.pollBass();
        await this.pollTreble();
        await this.pollBalance();
        await this.pollRoomEQ();
        await this.pollDolbyAudio();
        await this.pollSubwooferTrim();
        await this.pollSubStereoTrim();
        await this.pollLipsyncDelay();
        await this.pollCompression();
        await this.pollDisplayBrightness();
        await this.pollHdmiOutput();
        await this.pollImaxEnhanced();
        await this.pollAudioFormat();
        await this.pollVideoInfo();
        await this.pollSampleRate();
        await this.pollNowPlaying();

        // Zone 2
        await this.pollZone2();
      }
    } catch (err) {
      this.error('Poll error:', err);
    }

    this.startPolling();
  }

  // ── Individual Poll Methods ─────────────────────────────────────────────

  private async pollPower(): Promise<void> {
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.POWER);
      const powered = resp.data[0] === 0x01;
      const changed = this.isPowered !== powered;
      this.isPowered = powered;
      await this.setCapabilityValue('onoff', powered);
      if (changed) {
        this.restartPolling();
      }
    } catch (_err) { /* ignore */ }
  }

  private async pollVolume(): Promise<void> {
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.VOLUME);
      await this.setCapabilityValue('volume_set', resp.data[0] / 99);
    } catch (_err) { /* ignore */ }
  }

  private async pollMute(): Promise<void> {
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.MUTE);
      // 0x00 = muted, 0x01 = not muted
      await this.setCapabilityValue('volume_mute', resp.data[0] === 0x00);
    } catch (_err) { /* ignore */ }
  }

  private async pollInputSource(): Promise<void> {
    if (!this.hasCapability('input_source')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.CURRENT_SOURCE);
      const sourceEnum = INPUT_SOURCE_REVERSE[resp.data[0]];
      if (sourceEnum) {
        await this.setCapabilityValue('input_source', sourceEnum);
      }
    } catch (_err) { /* ignore */ }
  }

  private async pollDecodeMode(): Promise<void> {
    if (!this.hasCapability('decode_mode')) return;
    try {
      // Try 2ch mode first
      const resp2ch = await this.connection.query(Zone.MASTER, Cmd.DECODE_MODE_2CH);
      const mode2ch = DECODE_MODE_2CH_REVERSE[resp2ch.data[0]];
      if (mode2ch) {
        this.is2chMode = true;
        await this.setCapabilityValue('decode_mode', mode2ch);
        return;
      }
    } catch (_err) { /* ignore */ }

    try {
      // Try MCH mode
      const respMch = await this.connection.query(Zone.MASTER, Cmd.DECODE_MODE_MCH);
      const modeMch = DECODE_MODE_MCH_REVERSE[respMch.data[0]];
      if (modeMch) {
        this.is2chMode = false;
        await this.setCapabilityValue('decode_mode', modeMch);
      }
    } catch (_err) { /* ignore */ }
  }

  private async pollDirectMode(): Promise<void> {
    if (!this.hasCapability('direct_mode')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.DIRECT_MODE);
      await this.setCapabilityValue('direct_mode', resp.data[0] === 0x01);
    } catch (_err) { /* ignore */ }
  }

  private async pollBass(): Promise<void> {
    if (!this.hasCapability('bass')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.BASS);
      await this.setCapabilityValue('bass', decodeSignedValue(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollTreble(): Promise<void> {
    if (!this.hasCapability('treble')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.TREBLE);
      await this.setCapabilityValue('treble', decodeSignedValue(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollBalance(): Promise<void> {
    if (!this.hasCapability('balance')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.BALANCE);
      await this.setCapabilityValue('balance', decodeSignedValue(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollRoomEQ(): Promise<void> {
    if (!this.hasCapability('room_eq')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.ROOM_EQ);
      const map: Record<number, string> = {
        0x00: 'off', 0x01: 'eq1', 0x02: 'eq2', 0x03: 'eq3', 0x04: 'off',
      };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('room_eq', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollDolbyAudio(): Promise<void> {
    if (!this.hasCapability('dolby_audio')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.DOLBY_AUDIO);
      const map: Record<number, string> = {
        0x00: 'off', 0x01: 'movie', 0x02: 'music', 0x03: 'night',
      };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('dolby_audio', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollSubwooferTrim(): Promise<void> {
    if (!this.hasCapability('subwoofer_trim')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.SUBWOOFER_TRIM);
      await this.setCapabilityValue('subwoofer_trim', decodeSubTrim(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollSubStereoTrim(): Promise<void> {
    if (!this.hasCapability('sub_stereo_trim')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.SUB_STEREO_TRIM);
      await this.setCapabilityValue('sub_stereo_trim', decodeSubTrim(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollLipsyncDelay(): Promise<void> {
    if (!this.hasCapability('lipsync_delay')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.LIPSYNC_DELAY);
      await this.setCapabilityValue('lipsync_delay', decodeLipsync(resp.data[0]));
    } catch (_err) { /* ignore */ }
  }

  private async pollCompression(): Promise<void> {
    if (!this.hasCapability('compression')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.COMPRESSION);
      const map: Record<number, string> = { 0x00: 'off', 0x01: 'medium', 0x02: 'high' };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('compression', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollDisplayBrightness(): Promise<void> {
    if (!this.hasCapability('display_brightness')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.DISPLAY_BRIGHTNESS);
      const map: Record<number, string> = { 0x00: 'off', 0x01: 'dim', 0x02: 'bright' };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('display_brightness', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollHdmiOutput(): Promise<void> {
    if (!this.hasCapability('hdmi_output')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.VIDEO_OUTPUT_SWITCH);
      const map: Record<number, string> = { 0x02: 'out1', 0x03: 'out2', 0x04: 'both' };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('hdmi_output', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollImaxEnhanced(): Promise<void> {
    if (!this.hasCapability('imax_enhanced')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.IMAX_ENHANCED);
      const map: Record<number, string> = { 0x00: 'off', 0x01: 'on', 0x02: 'auto' };
      const val = map[resp.data[0]];
      if (val) await this.setCapabilityValue('imax_enhanced', val);
    } catch (_err) { /* ignore */ }
  }

  private async pollAudioFormat(): Promise<void> {
    if (!this.hasCapability('audio_format')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.INCOMING_AUDIO);
      const info = parseAudioInfo(resp.data);
      await this.setCapabilityValue('audio_format', info.format);
    } catch (_err) { /* ignore */ }
  }

  private async pollVideoInfo(): Promise<void> {
    if (!this.hasCapability('video_resolution')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.INCOMING_VIDEO);
      if (resp.data.length >= 8) {
        const info = parseVideoInfo(resp.data);
        await this.setCapabilityValue('video_resolution', formatVideoResolution(info));
        if (this.hasCapability('hdr_format')) {
          await this.setCapabilityValue('hdr_format', info.hdrFormat);
        }
      }
    } catch (_err) { /* ignore */ }
  }

  private async pollSampleRate(): Promise<void> {
    if (!this.hasCapability('sample_rate')) return;
    try {
      const resp = await this.connection.query(Zone.MASTER, Cmd.INCOMING_SAMPLE_RATE);
      const name = SAMPLE_RATE_NAMES[resp.data[0]] || 'Unknown';
      await this.setCapabilityValue('sample_rate', name);
    } catch (_err) { /* ignore */ }
  }

  private async pollNowPlaying(): Promise<void> {
    try {
      if (this.hasCapability('now_playing_title')) {
        const resp = await this.connection.sendCommand(Zone.MASTER, Cmd.NOW_PLAYING, [0xF0]);
        const title = resp.data.toString('ascii').trim();
        await this.setCapabilityValue('now_playing_title', title || '-');
      }
      if (this.hasCapability('now_playing_artist')) {
        const resp = await this.connection.sendCommand(Zone.MASTER, Cmd.NOW_PLAYING, [0xF1]);
        const artist = resp.data.toString('ascii').trim();
        await this.setCapabilityValue('now_playing_artist', artist || '-');
      }
      if (this.hasCapability('now_playing_album')) {
        const resp = await this.connection.sendCommand(Zone.MASTER, Cmd.NOW_PLAYING, [0xF2]);
        const album = resp.data.toString('ascii').trim();
        await this.setCapabilityValue('now_playing_album', album || '-');
      }
    } catch (_err) { /* ignore - may not be available for all sources */ }
  }

  private async pollZone2(): Promise<void> {
    if (!this.hasCapability('zone2_power')) return;
    try {
      const powerResp = await this.connection.query(Zone.ZONE2, Cmd.POWER);
      const z2Powered = powerResp.data[0] === 0x01;
      await this.setCapabilityValue('zone2_power', z2Powered);

      if (z2Powered) {
        if (this.hasCapability('zone2_volume')) {
          const volResp = await this.connection.query(Zone.ZONE2, Cmd.VOLUME);
          await this.setCapabilityValue('zone2_volume', volResp.data[0] / 99);
        }
        if (this.hasCapability('zone2_mute')) {
          const muteResp = await this.connection.query(Zone.ZONE2, Cmd.MUTE);
          await this.setCapabilityValue('zone2_mute', muteResp.data[0] === 0x00);
        }
        if (this.hasCapability('zone2_source')) {
          const srcResp = await this.connection.query(Zone.ZONE2, Cmd.CURRENT_SOURCE);
          const sourceEnum = INPUT_SOURCE_REVERSE[srcResp.data[0]];
          if (sourceEnum) {
            await this.setCapabilityValue('zone2_source', sourceEnum);
          }
        }
      }
    } catch (_err) { /* ignore */ }
  }

  // ── Handle unsolicited status updates ───────────────────────────────────

  private async handleStatusUpdate(response: JblResponse): Promise<void> {
    if (isError(response)) return;

    const { zone } = response;
    const { data } = response;

    switch (response.command) {
      case Cmd.POWER:
        if (zone === Zone.MASTER) {
          this.isPowered = data[0] === 0x01;
          await this.setCapabilityValue('onoff', this.isPowered);
          this.restartPolling();
        } else if (zone === Zone.ZONE2 && this.hasCapability('zone2_power')) {
          await this.setCapabilityValue('zone2_power', data[0] === 0x01);
        }
        break;

      case Cmd.VOLUME:
        if (zone === Zone.MASTER) {
          await this.setCapabilityValue('volume_set', data[0] / 99);
        } else if (zone === Zone.ZONE2 && this.hasCapability('zone2_volume')) {
          await this.setCapabilityValue('zone2_volume', data[0] / 99);
        }
        break;

      case Cmd.MUTE:
        if (zone === Zone.MASTER) {
          await this.setCapabilityValue('volume_mute', data[0] === 0x00);
        } else if (zone === Zone.ZONE2 && this.hasCapability('zone2_mute')) {
          await this.setCapabilityValue('zone2_mute', data[0] === 0x00);
        }
        break;

      case Cmd.CURRENT_SOURCE: {
        const sourceEnum = INPUT_SOURCE_REVERSE[data[0]];
        if (sourceEnum) {
          if (zone === Zone.MASTER && this.hasCapability('input_source')) {
            await this.setCapabilityValue('input_source', sourceEnum);
          } else if (zone === Zone.ZONE2 && this.hasCapability('zone2_source')) {
            await this.setCapabilityValue('zone2_source', sourceEnum);
          }
        }
        break;
      }

      case Cmd.DECODE_MODE_2CH:
        if (this.hasCapability('decode_mode')) {
          const mode = DECODE_MODE_2CH_REVERSE[data[0]];
          if (mode) {
            this.is2chMode = true;
            await this.setCapabilityValue('decode_mode', mode);
          }
        }
        break;

      case Cmd.DECODE_MODE_MCH:
        if (this.hasCapability('decode_mode')) {
          const mode = DECODE_MODE_MCH_REVERSE[data[0]];
          if (mode) {
            this.is2chMode = false;
            await this.setCapabilityValue('decode_mode', mode);
          }
        }
        break;

      case Cmd.DIRECT_MODE:
        if (this.hasCapability('direct_mode')) {
          await this.setCapabilityValue('direct_mode', data[0] === 0x01);
        }
        break;

      case Cmd.BASS:
        if (this.hasCapability('bass')) {
          await this.setCapabilityValue('bass', decodeSignedValue(data[0]));
        }
        break;

      case Cmd.TREBLE:
        if (this.hasCapability('treble')) {
          await this.setCapabilityValue('treble', decodeSignedValue(data[0]));
        }
        break;

      case Cmd.INCOMING_AUDIO:
        if (this.hasCapability('audio_format') && data.length >= 2) {
          const info = parseAudioInfo(data);
          await this.setCapabilityValue('audio_format', info.format);
        }
        break;

      default:
        break;
    }
  }

  // ── Public methods for Flow actions ─────────────────────────────────────

  async sendRC5Command(system: number, command: number): Promise<void> {
    await this.connection.sendRC5(Zone.MASTER, system, command);
  }

  async sendPlaybackCommand(action: string): Promise<void> {
    const commands: Record<string, number> = {
      play: RC5.PLAY,
      pause: RC5.PAUSE,
      stop: RC5.STOP,
      skip_forward: RC5.SKIP_FORWARD,
      skip_back: RC5.SKIP_BACK,
      fast_forward: RC5.FAST_FORWARD,
      rewind: RC5.REWIND,
    };
    const cmd = commands[action];
    if (cmd !== undefined) {
      await this.connection.sendRC5(Zone.MASTER, RC5.SYSTEM_MAIN, cmd);
    }
  }
}

module.exports = JblSynthesisDevice;
