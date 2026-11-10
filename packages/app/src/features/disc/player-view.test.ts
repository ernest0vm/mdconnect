import type { DeviceStatus } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { playerBlocker, playerView, trackPlayState } from './player-view';

const titles = ['Intro', '', 'Outro'];
const at = (state: DeviceStatus['state'], track: number | null, second = 0): DeviceStatus => ({
  discPresent: true,
  state,
  track,
  time: track === null ? null : { minute: 1, second, frame: 0 },
});

describe('playerView', () => {
  it('shows the track number, title, time and state while playing (playback: "Playing")', () => {
    expect(playerView(at('playing', 0, 23), titles)).toEqual({
      track: '001',
      title: 'Intro',
      time: '1:23',
      state: 'Playing',
      announcement: 'Playing track 1, Intro',
      playing: true,
    });
  });

  it('shows Untitled for a track without a title', () => {
    expect(playerView(at('paused', 1), titles)).toMatchObject({
      title: 'Untitled',
      state: 'Paused',
      playing: false,
    });
  });

  it('shows a stopped device and the track it would play (playback: "Stopped")', () => {
    expect(playerView(at('ready', 2), titles)).toMatchObject({ track: '003', state: 'Stopped' });
  });

  it('shows no disc and no track (playback: "No disc")', () => {
    const view = playerView({ discPresent: false, state: 'noDisc', track: null, time: null }, []);
    expect(view).toMatchObject({ track: null, title: null, time: null, state: 'No disc' });
  });

  it('keeps the announcement free of the time, so it changes only with the track or state', () => {
    expect(playerView(at('playing', 0, 1), titles).announcement).toBe(
      playerView(at('playing', 0, 2), titles).announcement,
    );
  });

  it('shows nothing before the first status read', () => {
    expect(playerView(null, titles)).toMatchObject({
      track: null,
      state: 'Waiting for the device',
    });
  });
});

describe('playerBlocker (playback: "No disc")', () => {
  it('explains why the controls are unavailable', () => {
    expect(playerBlocker({ status: at('ready', 0), reading: false, saving: false })).toBeNull();
    expect(
      playerBlocker({
        status: { discPresent: false, state: 'noDisc', track: null, time: null },
        reading: false,
        saving: false,
      }),
    ).toBe('Insert a disc to play it.');
    expect(playerBlocker({ status: at('ready', 0), reading: true, saving: false })).toBe(
      'Wait until the disc is read.',
    );
    expect(playerBlocker({ status: at('ready', 0), reading: false, saving: true })).toBe(
      'Wait for the current change to finish.',
    );
  });
});

describe('trackPlayState (playback: "Play a chosen track")', () => {
  it('marks the playing or paused track and nothing else', () => {
    expect(trackPlayState(at('playing', 2), 2)).toBe('playing');
    expect(trackPlayState(at('paused', 2), 2)).toBe('paused');
    expect(trackPlayState(at('playing', 2), 1)).toBe('none');
    expect(trackPlayState(at('ready', 2), 2)).toBe('none');
    expect(trackPlayState(null, 2)).toBe('none');
  });
});
