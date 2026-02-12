'use strict';

import Homey from 'homey';
import { JblConnection } from '../../lib/JblConnection';

class JblSynthesisDriver extends Homey.Driver {

  async onInit(): Promise<void> {
    this.log('JBL Synthesis driver initialized');
    this.registerFlowCards();
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    let ipAddress = '';
    let port = 50000;
    let model = 'SDR-38';

    session.setHandler('configure', async (data: { ip: string; port: number; model: string }) => {
      ipAddress = data.ip;
      port = data.port || 50000;
      model = data.model || 'SDR-38';

      // Test connection
      const connection = new JblConnection({ host: ipAddress, port });
      const success = await connection.testConnection();

      if (!success) {
        throw new Error('Could not connect to the receiver. Please check the IP address and port.');
      }

      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!ipAddress) return [];

      return [{
        name: `JBL ${model}`,
        data: {
          id: `jbl-synthesis-${ipAddress.replace(/\./g, '-')}-${port}`,
        },
        settings: {
          ip: ipAddress,
          port,
          model,
        },
      }];
    });
  }

  async onRepair(session: Homey.Driver.PairSession, device: Homey.Device): Promise<void> {
    session.setHandler('configure', async (data: { ip: string; port: number }) => {
      const connection = new JblConnection({ host: data.ip, port: data.port || 50000 });
      const success = await connection.testConnection();

      if (!success) {
        throw new Error('Could not connect to the receiver.');
      }

      await device.setSettings({ ip: data.ip, port: data.port || 50000 });
      return true;
    });
  }

  private registerFlowCards(): void {
    // ── Trigger Cards ───────────────────────────────────────────────────────

    // input_source_changed trigger is auto-registered via capability

    // ── Condition Cards ─────────────────────────────────────────────────────

    this.homey.flow.getConditionCard('is_playing_source')
      .registerRunListener(async (args: { source: string; device: Homey.Device }) => {
        const currentSource = args.device.getCapabilityValue('input_source');
        return currentSource === args.source;
      });

    // ── Action Cards ────────────────────────────────────────────────────────

    this.homey.flow.getActionCard('set_input_source')
      .registerRunListener(async (args: { source: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('input_source', args.source);
      });

    this.homey.flow.getActionCard('set_decode_mode')
      .registerRunListener(async (args: { mode: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('decode_mode', args.mode);
      });

    this.homey.flow.getActionCard('set_room_eq')
      .registerRunListener(async (args: { preset: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('room_eq', args.preset);
      });

    this.homey.flow.getActionCard('set_dolby_audio')
      .registerRunListener(async (args: { mode: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('dolby_audio', args.mode);
      });

    this.homey.flow.getActionCard('set_bass')
      .registerRunListener(async (args: { value: number; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('bass', args.value);
      });

    this.homey.flow.getActionCard('set_treble')
      .registerRunListener(async (args: { value: number; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('treble', args.value);
      });

    this.homey.flow.getActionCard('set_subwoofer_trim')
      .registerRunListener(async (args: { value: number; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('subwoofer_trim', args.value);
      });

    this.homey.flow.getActionCard('set_lipsync_delay')
      .registerRunListener(async (args: { value: number; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('lipsync_delay', args.value);
      });

    this.homey.flow.getActionCard('set_compression')
      .registerRunListener(async (args: { mode: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('compression', args.mode);
      });

    this.homey.flow.getActionCard('set_hdmi_output')
      .registerRunListener(async (args: { output: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('hdmi_output', args.output);
      });

    this.homey.flow.getActionCard('set_display_brightness')
      .registerRunListener(async (args: { level: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('display_brightness', args.level);
      });

    this.homey.flow.getActionCard('set_imax_enhanced')
      .registerRunListener(async (args: { mode: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('imax_enhanced', args.mode);
      });

    this.homey.flow.getActionCard('playback_control')
      .registerRunListener(async (args: { action: string; device: Homey.Device }) => {
        const dev = args.device as Homey.Device & { sendPlaybackCommand: (a: string) => Promise<void>; sendRC5Command: (s: number, c: number) => Promise<void> };
        await dev.sendPlaybackCommand(args.action);
      });

    this.homey.flow.getActionCard('send_rc5_command')
      .registerRunListener(async (args: { system: number; command: number; device: Homey.Device }) => {
        const dev = args.device as Homey.Device & { sendPlaybackCommand: (a: string) => Promise<void>; sendRC5Command: (s: number, c: number) => Promise<void> };
        await dev.sendRC5Command(args.system, args.command);
      });

    // Zone 2 actions
    this.homey.flow.getActionCard('zone2_set_source')
      .registerRunListener(async (args: { source: string; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('zone2_source', args.source);
      });

    this.homey.flow.getActionCard('zone2_set_volume')
      .registerRunListener(async (args: { volume: number; device: Homey.Device }) => {
        await args.device.triggerCapabilityListener('zone2_volume', args.volume);
      });
  }
}

module.exports = JblSynthesisDriver;
