import { describePort, describePorts } from '@/scanner/lan/portNames';

describe('describePort', () => {
  it('names well-known device ports', () => {
    expect(describePort(9100)).toBe('9100 (Raw printing (JetDirect))');
    expect(describePort(62078)).toBe('62078 (iPhone / iPad sync)');
    expect(describePort(445)).toBe('445 (SMB file sharing)');
  });

  it('falls back to the bare number for unknown ports', () => {
    expect(describePort(12345)).toBe('12345');
  });
});

describe('describePorts', () => {
  it('joins a list, naming what it can', () => {
    expect(describePorts([80, 62078, 4444])).toBe(
      '80 (HTTP (web)), 62078 (iPhone / iPad sync), 4444'
    );
  });
});
