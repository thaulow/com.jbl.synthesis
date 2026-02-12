'use strict';

// ── RS232 Protocol Constants ──────────────────────────────────────────────────
// Based on RS232_SDR35_38_SDP55_58_SH289E_E_2Jun21.pdf (Issue E.0)
// Baud: 38400, Data: 8, Stop: 1, Parity: None, Flow: None

export const STX = 0x21; // '!' Start transmission
export const ETX = 0x0D; // CR End transmission
export const REQUEST = 0xF0; // Request current value

// ── Zones ─────────────────────────────────────────────────────────────────────

export enum Zone {
  MASTER = 0x01,
  ZONE2 = 0x02,
}

// ── Command Codes ─────────────────────────────────────────────────────────────

export enum Cmd {
  POWER = 0x00,
  DISPLAY_BRIGHTNESS = 0x01,
  HEADPHONES = 0x02,
  FM_GENRE = 0x03,
  SOFTWARE_VERSION = 0x04,
  FACTORY_RESET = 0x05,
  SAVE_RESTORE = 0x06,
  SIMULATE_RC5 = 0x08,
  DISPLAY_INFO_TYPE = 0x09,
  SELECT_ANALOG_DIGITAL = 0x0B,
  IMAX_ENHANCED = 0x0C,
  VOLUME = 0x0D,
  MUTE = 0x0E,
  DIRECT_MODE = 0x0F,
  DECODE_MODE_2CH = 0x10,
  DECODE_MODE_MCH = 0x11,
  RDS_INFO = 0x12,
  VIDEO_OUTPUT_RES = 0x13,
  MENU_STATUS = 0x14,
  TUNER_PRESET = 0x15,
  TUNE = 0x16,
  DAB_STATION = 0x18,
  PROG_TYPE = 0x19,
  DLS_PDT_INFO = 0x1A,
  PRESET_DETAILS = 0x1B,
  NETWORK_PLAYBACK = 0x1C,
  CURRENT_SOURCE = 0x1D,
  HEADPHONE_OVERRIDE = 0x1F,
  INPUT_NAME = 0x20,
  FM_SCAN = 0x23,
  DAB_SCAN = 0x24,
  HEARTBEAT = 0x25,
  REBOOT = 0x26,
  SETUP = 0x27,
  INPUT_CONFIG = 0x28,
  GENERAL_SETUP = 0x29,
  SPEAKER_TYPES = 0x2A,
  SPEAKER_DISTANCES = 0x2B,
  SPEAKER_LEVELS = 0x2C,
  VIDEO_INPUTS = 0x2D,
  HDMI_SETTINGS = 0x2E,
  ZONE_SETTINGS = 0x2F,
  NETWORK_SETTINGS = 0x30,
  BLUETOOTH_SETTINGS = 0x32,
  ENGINEERING = 0x33,
  ROOM_EQ_NAMES = 0x34,
  TREBLE = 0x35,
  BASS = 0x36,
  ROOM_EQ = 0x37,
  DOLBY_AUDIO = 0x38,
  BALANCE = 0x3B,
  SUBWOOFER_TRIM = 0x3F,
  LIPSYNC_DELAY = 0x40,
  COMPRESSION = 0x41,
  INCOMING_VIDEO = 0x42,
  INCOMING_AUDIO = 0x43,
  INCOMING_SAMPLE_RATE = 0x44,
  SUB_STEREO_TRIM = 0x45,
  ZONE1_OSD = 0x4E,
  VIDEO_OUTPUT_SWITCH = 0x4F,
  BLUETOOTH_STATUS = 0x50,
  NOW_PLAYING = 0x64,
}

// ── Answer Codes ──────────────────────────────────────────────────────────────

export enum AnswerCode {
  STATUS_UPDATE = 0x00,
  ZONE_INVALID = 0x82,
  COMMAND_NOT_RECOGNISED = 0x83,
  PARAMETER_NOT_RECOGNISED = 0x84,
  COMMAND_INVALID = 0x85,
  INVALID_DATA_LENGTH = 0x86,
}

// ── Input Source IDs ──────────────────────────────────────────────────────────

export enum InputSourceId {
  FOLLOW_ZONE1 = 0x00,
  CD = 0x01,
  BD = 0x02,
  AV = 0x03,
  SAT = 0x04,
  PVR = 0x05,
  UHD = 0x06,
  AUX = 0x08,
  DISPLAY = 0x09,
  TUNER_FM = 0x0B,
  TUNER_DAB = 0x0C,
  NET = 0x0E,
  STB = 0x10,
  GAME = 0x11,
  BT = 0x12,
}

export const INPUT_SOURCE_NAMES: Record<number, string> = {
  [InputSourceId.CD]: 'CD',
  [InputSourceId.BD]: 'Blu-ray',
  [InputSourceId.AV]: 'AV',
  [InputSourceId.SAT]: 'SAT',
  [InputSourceId.PVR]: 'PVR',
  [InputSourceId.UHD]: 'UHD',
  [InputSourceId.AUX]: 'AUX',
  [InputSourceId.DISPLAY]: 'Display',
  [InputSourceId.TUNER_FM]: 'FM Tuner',
  [InputSourceId.TUNER_DAB]: 'DAB Tuner',
  [InputSourceId.NET]: 'Network',
  [InputSourceId.STB]: 'STB',
  [InputSourceId.GAME]: 'Game',
  [InputSourceId.BT]: 'Bluetooth',
};

// Mapping from Homey enum ID to protocol byte
export const INPUT_SOURCE_MAP: Record<string, number> = {
  cd: InputSourceId.CD,
  bd: InputSourceId.BD,
  av: InputSourceId.AV,
  sat: InputSourceId.SAT,
  pvr: InputSourceId.PVR,
  uhd: InputSourceId.UHD,
  aux: InputSourceId.AUX,
  display: InputSourceId.DISPLAY,
  fm: InputSourceId.TUNER_FM,
  dab: InputSourceId.TUNER_DAB,
  net: InputSourceId.NET,
  stb: InputSourceId.STB,
  game: InputSourceId.GAME,
  bt: InputSourceId.BT,
};

export const INPUT_SOURCE_REVERSE: Record<number, string> = Object.fromEntries(
  Object.entries(INPUT_SOURCE_MAP).map(([k, v]) => [v, k]),
);

// ── Audio Formats ─────────────────────────────────────────────────────────────

export const AUDIO_FORMAT_NAMES: Record<number, string> = {
  0x00: 'PCM',
  0x01: 'Analog Direct',
  0x02: 'Dolby Digital',
  0x03: 'Dolby Digital EX',
  0x04: 'Dolby Digital Surround',
  0x05: 'Dolby Digital Plus',
  0x06: 'Dolby TrueHD',
  0x07: 'DTS',
  0x08: 'DTS 96/24',
  0x09: 'DTS ES Matrix',
  0x0A: 'DTS ES Discrete',
  0x0B: 'DTS ES Matrix 96/24',
  0x0C: 'DTS ES Discrete 96/24',
  0x0D: 'DTS-HD Master Audio',
  0x0E: 'DTS-HD High Res',
  0x0F: 'DTS Low Bit Rate',
  0x10: 'DTS Core',
  0x13: 'PCM (Silent)',
  0x14: 'Unsupported',
  0x15: 'Undetected',
  0x16: 'Dolby Atmos',
  0x17: 'DTS:X',
  0x18: 'IMAX Enhanced',
  0x19: 'Auro-3D',
};

// ── Decode Modes ──────────────────────────────────────────────────────────────

export const DECODE_MODE_2CH: Record<number, string> = {
  0x01: 'Stereo',
  0x04: 'Dolby Surround',
  0x07: 'Neo:6 Cinema',
  0x08: 'Neo:6 Music',
  0x09: '5/7ch Stereo',
  0x0A: 'DTS Neural:X',
  0x0C: 'DTS Virtual:X',
  0x0D: 'Dolby Virtual Height',
  0x0E: 'Auro Native',
  0x0F: 'Auro-Matic 3D',
  0x10: 'Auro-2D',
};

export const DECODE_MODE_MCH: Record<number, string> = {
  0x01: 'Stereo Downmix',
  0x02: 'Multi-Channel',
  0x03: 'DTS Neural:X',
  0x06: 'Dolby Surround',
  0x0C: 'DTS Virtual:X',
  0x0D: 'Dolby Virtual Height',
  0x0E: 'Auro Native',
  0x0F: 'Auro-Matic 3D',
  0x10: 'Auro-2D',
};

export const DECODE_MODE_MAP: Record<string, { is2ch: boolean; value: number }> = {
  stereo: { is2ch: true, value: 0x01 },
  dolby_surround: { is2ch: true, value: 0x04 },
  neo6_cinema: { is2ch: true, value: 0x07 },
  neo6_music: { is2ch: true, value: 0x08 },
  multi_stereo: { is2ch: true, value: 0x09 },
  neural_x: { is2ch: true, value: 0x0A },
  virtual_x: { is2ch: true, value: 0x0C },
  dolby_virtual_height: { is2ch: true, value: 0x0D },
  auro_native: { is2ch: true, value: 0x0E },
  auro_matic: { is2ch: true, value: 0x0F },
  auro_2d: { is2ch: true, value: 0x10 },
  stereo_downmix: { is2ch: false, value: 0x01 },
  multi_channel: { is2ch: false, value: 0x02 },
  mch_neural_x: { is2ch: false, value: 0x03 },
  mch_dolby_surround: { is2ch: false, value: 0x06 },
  mch_virtual_x: { is2ch: false, value: 0x0C },
  mch_dolby_virtual_height: { is2ch: false, value: 0x0D },
  mch_auro_native: { is2ch: false, value: 0x0E },
  mch_auro_matic: { is2ch: false, value: 0x0F },
  mch_auro_2d: { is2ch: false, value: 0x10 },
};

export const DECODE_MODE_2CH_REVERSE: Record<number, string> = {
  0x01: 'stereo',
  0x04: 'dolby_surround',
  0x07: 'neo6_cinema',
  0x08: 'neo6_music',
  0x09: 'multi_stereo',
  0x0A: 'neural_x',
  0x0C: 'virtual_x',
  0x0D: 'dolby_virtual_height',
  0x0E: 'auro_native',
  0x0F: 'auro_matic',
  0x10: 'auro_2d',
};

export const DECODE_MODE_MCH_REVERSE: Record<number, string> = {
  0x01: 'stereo_downmix',
  0x02: 'multi_channel',
  0x03: 'mch_neural_x',
  0x06: 'mch_dolby_surround',
  0x0C: 'mch_virtual_x',
  0x0D: 'mch_dolby_virtual_height',
  0x0E: 'mch_auro_native',
  0x0F: 'mch_auro_matic',
  0x10: 'mch_auro_2d',
};

// ── Sample Rates ──────────────────────────────────────────────────────────────

export const SAMPLE_RATE_NAMES: Record<number, string> = {
  0x00: '32 kHz',
  0x01: '44.1 kHz',
  0x02: '48 kHz',
  0x03: '88.2 kHz',
  0x04: '96 kHz',
  0x05: '176.4 kHz',
  0x06: '192 kHz',
  0x07: 'Unknown',
  0x08: 'Undetected',
};

// ── HDR Formats ───────────────────────────────────────────────────────────────

export const HDR_FORMAT_NAMES: Record<number, string> = {
  0x00: 'SDR',
  0x01: 'HDR10',
  0x02: 'Dolby Vision',
  0x03: 'HLG',
  0x04: 'HDR10+',
};

// ── RC5 IR Command Codes ──────────────────────────────────────────────────────

export const RC5 = {
  SYSTEM_MAIN: 0x10,
  SYSTEM_ZONE2: 0x17,
  // Power
  STANDBY: 0x0C,
  POWER_ON: 0x7B,
  POWER_OFF: 0x7C,
  // Numbers
  NUM_0: 0x00,
  NUM_1: 0x01,
  NUM_2: 0x02,
  NUM_3: 0x03,
  NUM_4: 0x04,
  NUM_5: 0x05,
  NUM_6: 0x06,
  NUM_7: 0x07,
  NUM_8: 0x08,
  NUM_9: 0x09,
  // Volume
  VOL_UP: 0x10,
  VOL_DOWN: 0x11,
  MUTE: 0x0D,
  MUTE_ON: 0x1A,
  MUTE_OFF: 0x78,
  // Navigation
  UP: 0x56,
  DOWN: 0x55,
  LEFT: 0x51,
  RIGHT: 0x50,
  OK: 0x57,
  MENU: 0x52,
  HOME: 0x2B,
  MODE: 0x20,
  // Playback
  PLAY: 0x35,
  PAUSE: 0x30,
  STOP: 0x36,
  REWIND: 0x79,
  FAST_FORWARD: 0x34,
  SKIP_BACK: 0x21,
  SKIP_FORWARD: 0x0B,
  RANDOM: 0x4C,
  REPEAT: 0x31,
  // Inputs
  INPUT_CD: 0x76,
  INPUT_BD: 0x62,
  INPUT_STB: 0x64,
  INPUT_UHD: 0x7D,
  INPUT_BT: 0x7A,
  INPUT_FM: 0x5B,
  INPUT_DAB: 0x48,
  INPUT_NET: 0x5C,
  INPUT_AV: 0x5E,
  INPUT_SAT: 0x1B,
  INPUT_PVR: 0x60,
  INPUT_GAME: 0x61,
  INPUT_AUX: 0x63,
  // Display
  DISPLAY_BRIGHTNESS: 0x3B,
  DISPLAY_OFF: 0x3A,
  DISPLAY_L1: 0x22,
  DISPLAY_L2: 0x23,
  // Audio modes
  DIRECT_ON: 0x4E,
  DIRECT_OFF: 0x4F,
  MULTI_CHANNEL: 0x6A,
  STEREO: 0x6B,
  DOLBY_SURROUND: 0x6E,
  NEO6_CINEMA: 0x6F,
  NEO6_MUSIC: 0x70,
  NEURAL_X: 0x71,
  VIRTUAL_HEIGHT: 0x73,
  MULTI_STEREO: 0x45,
  AURO_MATIC: 0x47,
  AURO_NATIVE: 0x67,
  AURO_2D: 0x68,
  // Adjustments
  BASS_UP: 0x2C,
  BASS_DOWN: 0x38,
  TREBLE_UP: 0x2E,
  TREBLE_DOWN: 0x66,
  BALANCE_LEFT: 0x26,
  BALANCE_RIGHT: 0x28,
  SUB_TRIM_UP: 0x69,
  SUB_TRIM_DOWN: 0x6C,
  LIPSYNC_UP: 0x0F,
  LIPSYNC_DOWN: 0x65,
  // HDMI output
  HDMI_OUT1: 0x49,
  HDMI_OUT2: 0x4A,
  HDMI_OUT_BOTH: 0x4B,
  // Zone 2 (using SYSTEM_ZONE2)
  Z2_POWER_ON: 0x7B,
  Z2_POWER_OFF: 0x7C,
  Z2_VOL_UP: 0x01,
  Z2_VOL_DOWN: 0x02,
  Z2_MUTE: 0x03,
};

// ── Signed value encoding/decoding ────────────────────────────────────────────
// Protocol uses 0x00-0x0C for +0 to +12 and 0x81-0x8C for -1 to -12

export function encodeSignedValue(value: number): number {
  if (value >= 0) return value;
  return 0x80 + Math.abs(value);
}

export function decodeSignedValue(byte: number): number {
  if (byte <= 0x7F) return byte;
  return -(byte - 0x80);
}

// ── Sub trim encoding (0.5dB steps) ───────────────────────────────────────────
// 0x00=0dB, 0x01=+0.5, 0x02=+1.0, ... 0x14=+10.0
// 0x81=-0.5, 0x82=-1.0, ... 0x94=-10.0

export function encodeSubTrim(db: number): number {
  const steps = Math.round(db * 2);
  if (steps >= 0) return steps;
  return 0x80 + Math.abs(steps);
}

export function decodeSubTrim(byte: number): number {
  if (byte <= 0x7F) return byte / 2;
  return -(byte - 0x80) / 2;
}

// ── Lipsync encoding (5ms steps, 0-250ms) ─────────────────────────────────────

export function encodeLipsync(ms: number): number {
  return Math.round(ms / 5);
}

export function decodeLipsync(byte: number): number {
  return byte * 5;
}

// ── Command Builder ───────────────────────────────────────────────────────────

export function buildCommand(zone: Zone, cmd: Cmd, data: number[]): Buffer {
  return Buffer.from([STX, zone, cmd, data.length, ...data, ETX]);
}

export function buildQuery(zone: Zone, cmd: Cmd): Buffer {
  return buildCommand(zone, cmd, [REQUEST]);
}

export function buildRC5(zone: Zone, system: number, command: number): Buffer {
  return buildCommand(zone, Cmd.SIMULATE_RC5, [system, command]);
}

// ── Response Parser ───────────────────────────────────────────────────────────

export interface JblResponse {
  zone: number;
  command: number;
  answer: number;
  data: Buffer;
}

/**
 * Attempts to parse one complete response from the buffer.
 * Returns the parsed response and the number of bytes consumed,
 * or null if the buffer doesn't contain a complete response.
 */
export function parseResponse(buffer: Buffer): { response: JblResponse; bytesConsumed: number } | null {
  // Find start byte
  const startIdx = buffer.indexOf(STX);
  if (startIdx === -1) return null;

  // Need at least: STX(1) + Zone(1) + Cmd(1) + Answer(1) + DL(1) + ETX(1) = 6 bytes
  if (buffer.length - startIdx < 6) return null;

  const zone = buffer[startIdx + 1];
  const command = buffer[startIdx + 2];
  const answer = buffer[startIdx + 3];
  const dataLength = buffer[startIdx + 4];

  // Total message length: STX + Zone + Cmd + Answer + DL + Data[DL] + ETX
  const totalLength = 5 + dataLength + 1;
  if (buffer.length - startIdx < totalLength) return null;

  // Verify ETX
  if (buffer[startIdx + totalLength - 1] !== ETX) {
    // Corrupted frame - skip past this STX and try again
    return parseResponse(buffer.subarray(startIdx + 1));
  }

  const data = Buffer.from(buffer.subarray(startIdx + 5, startIdx + 5 + dataLength));

  return {
    response: {
      zone, command, answer, data,
    },
    bytesConsumed: startIdx + totalLength,
  };
}

/**
 * Check if a response indicates an error.
 */
export function isError(response: JblResponse): boolean {
  return response.answer >= 0x82;
}

export function errorMessage(answer: number): string {
  switch (answer) {
    case AnswerCode.ZONE_INVALID: return 'Zone invalid';
    case AnswerCode.COMMAND_NOT_RECOGNISED: return 'Command not recognised';
    case AnswerCode.PARAMETER_NOT_RECOGNISED: return 'Parameter not recognised';
    case AnswerCode.COMMAND_INVALID: return 'Command invalid at this time';
    case AnswerCode.INVALID_DATA_LENGTH: return 'Invalid data length';
    default: return `Unknown error (0x${answer.toString(16)})`;
  }
}

// ── Video Resolution Parser ───────────────────────────────────────────────────

export interface VideoInfo {
  width: number;
  height: number;
  refreshRate: number;
  interlaced: boolean;
  aspectRatio: string;
  hdrFormat: string;
}

function getAspectRatio(value: number): string {
  if (value === 0x01) return '4:3';
  if (value === 0x02) return '16:9';
  return 'Unknown';
}

export function parseVideoInfo(data: Buffer): VideoInfo {
  return {
    width: (data[0] << 8) | data[1],
    height: (data[2] << 8) | data[3],
    refreshRate: data[4],
    interlaced: data[5] === 0x01,
    aspectRatio: getAspectRatio(data[6]),
    hdrFormat: HDR_FORMAT_NAMES[data[7]] || 'Unknown',
  };
}

export function formatVideoResolution(info: VideoInfo): string {
  if (info.width === 0 && info.height === 0) return 'No Signal';
  const scan = info.interlaced ? 'i' : 'p';
  return `${info.width}x${info.height}${scan}${info.refreshRate}`;
}

// ── Audio Info Parser ─────────────────────────────────────────────────────────

export interface AudioInfo {
  format: string;
  formatId: number;
  channelConfig: number;
}

export function parseAudioInfo(data: Buffer): AudioInfo {
  return {
    formatId: data[0],
    format: AUDIO_FORMAT_NAMES[data[0]] || `Unknown (0x${data[0].toString(16)})`,
    channelConfig: data.length > 1 ? data[1] : 0,
  };
}
