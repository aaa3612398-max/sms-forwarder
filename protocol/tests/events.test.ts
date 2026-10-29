import {
  decryptEvent,
  encryptEvent,
  generatePairingSecret,
} from '../src/crypto.js';
import { smsToEvent } from '../src/events.js';

describe('toolkit events', () => {
  const secret = generatePairingSecret();

  it('roundtrips clipboard event', () => {
    const event = {
      type: 'clipboard' as const,
      id: 'c1',
      text: 'hello clipboard',
      timestamp: Date.now(),
    };
    const env = encryptEvent(secret, event);
    expect(decryptEvent(secret, env)).toEqual(event);
  });

  it('legacy sms without type normalizes', () => {
    const legacy = {
      id: '1',
      sender: '10086',
      body: 'test',
      timestamp: 1,
      simSlot: null,
    };
    const env = encryptEvent(secret, smsToEvent(legacy));
    const decoded = decryptEvent(secret, env);
    expect(decoded.type).toBe('sms');
  });

  it('sms_send event', () => {
    const event = {
      type: 'sms_send' as const,
      id: 's1',
      to: '+8613800138000',
      body: 'hi',
      simSlot: 0,
    };
    const env = encryptEvent(secret, event);
    expect(decryptEvent(secret, env)).toEqual(event);
  });
});
