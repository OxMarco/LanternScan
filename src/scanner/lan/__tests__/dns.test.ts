import {
  DNS_TYPE_A,
  DNS_TYPE_PTR,
  DNS_TYPE_SRV,
  DNS_TYPE_TXT,
  decodeDnsRecords,
  encodeDnsQuery,
  ipFromReverseName,
  reverseLookupName,
} from '@/scanner/lan/dns';

function nameBytes(name: string): number[] {
  const bytes: number[] = [];
  for (const label of name.split('.')) {
    bytes.push(label.length);
    for (let i = 0; i < label.length; i += 1) bytes.push(label.charCodeAt(i));
  }
  bytes.push(0);
  return bytes;
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function record(name: number[], type: number, rdata: number[]): number[] {
  return [...name, ...u16(type), ...u16(1), 0, 0, 0, 0, ...u16(rdata.length), ...rdata];
}

function response(answers: number[][]): Uint8Array {
  return Uint8Array.from([
    ...u16(0), // id
    0x84,
    0x00, // response flags
    ...u16(0), // no questions
    ...u16(answers.length),
    ...u16(0),
    ...u16(0),
    ...answers.flat(),
  ]);
}

describe('encodeDnsQuery', () => {
  it('encodes a multi-question PTR query', () => {
    const packet = encodeDnsQuery(0x1234, [
      { name: '_services._dns-sd._udp.local', type: DNS_TYPE_PTR },
      { name: '_hue._tcp.local', type: DNS_TYPE_PTR },
    ]);
    expect(packet[0]).toBe(0x12);
    expect(packet[1]).toBe(0x34);
    expect(packet[2]).toBe(0); // query, not response
    expect((packet[4] << 8) | packet[5]).toBe(2); // question count
    const expectedFirst = nameBytes('_services._dns-sd._udp.local');
    expect(Array.from(packet.slice(12, 12 + expectedFirst.length))).toEqual(expectedFirst);
  });
});

describe('decodeDnsRecords', () => {
  it('decodes PTR, SRV, TXT and A records', () => {
    const packet = response([
      record(nameBytes('_services._dns-sd._udp.local'), DNS_TYPE_PTR, nameBytes('_hue._tcp.local')),
      record(nameBytes('_hue._tcp.local'), DNS_TYPE_PTR, nameBytes('Hue Bridge._hue._tcp.local')),
      record(nameBytes('Hue Bridge._hue._tcp.local'), DNS_TYPE_SRV, [
        ...u16(0),
        ...u16(0),
        ...u16(80),
        ...nameBytes('hueBridge.local'),
      ]),
      record(nameBytes('Hue Bridge._hue._tcp.local'), DNS_TYPE_TXT, [
        9,
        ...'md=BSB002'.split('').map((c) => c.charCodeAt(0)),
        5,
        ...'bf=on'.split('').map((c) => c.charCodeAt(0)),
      ]),
      record(nameBytes('hueBridge.local'), DNS_TYPE_A, [192, 168, 1, 42]),
    ]);

    const records = decodeDnsRecords(packet);
    expect(records).toHaveLength(5);
    expect(records[0]).toEqual({
      type: 'PTR',
      nameLabels: ['_services', '_dns-sd', '_udp', 'local'],
      targetLabels: ['_hue', '_tcp', 'local'],
    });
    expect(records[1]).toMatchObject({
      type: 'PTR',
      targetLabels: ['Hue Bridge', '_hue', '_tcp', 'local'],
    });
    expect(records[2]).toMatchObject({ type: 'SRV', targetLabels: ['hueBridge', 'local'] });
    expect(records[3]).toMatchObject({ type: 'TXT', txt: { md: 'BSB002', bf: 'on' } });
    expect(records[4]).toMatchObject({ type: 'A', address: '192.168.1.42' });
  });

  it('follows compression pointers', () => {
    // Answer name is a pointer to the type name embedded in the first record.
    const first = record(
      nameBytes('_raop._tcp.local'),
      DNS_TYPE_PTR,
      nameBytes('Speaker._raop._tcp.local')
    );
    const pointerToStart = [0xc0, 12]; // first record's name starts right after the header
    const second = record(pointerToStart, DNS_TYPE_PTR, nameBytes('Other._raop._tcp.local'));
    const records = decodeDnsRecords(response([first, second]));
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ nameLabels: ['_raop', '_tcp', 'local'] });
  });

  it('survives a pointer loop without hanging', () => {
    const looping = record([0xc0, 12], DNS_TYPE_PTR, [0xc0, 12]);
    expect(decodeDnsRecords(response([looping]))).toEqual([]);
  });

  it('ignores non-response packets', () => {
    const query = encodeDnsQuery(1, [{ name: '_hue._tcp.local', type: DNS_TYPE_PTR }]);
    expect(decodeDnsRecords(query)).toEqual([]);
  });
});

describe('reverse names', () => {
  it('builds and parses in-addr.arpa names', () => {
    expect(reverseLookupName('192.168.1.42')).toBe('42.1.168.192.in-addr.arpa');
    expect(ipFromReverseName(['42', '1', '168', '192', 'in-addr', 'arpa'])).toBe('192.168.1.42');
    expect(ipFromReverseName(['_hue', '_tcp', 'local'])).toBeUndefined();
    expect(ipFromReverseName(['999', '1', '168', '192', 'in-addr', 'arpa'])).toBeUndefined();
  });
});
