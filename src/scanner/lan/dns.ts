// Minimal DNS wire-format codec for one-shot mDNS (RFC 6762 legacy unicast)
// queries. Only what the querier needs: encoding multi-question PTR queries
// and decoding the PTR / SRV / TXT / A records that DNS-SD responders return.

export const DNS_TYPE_A = 1;
export const DNS_TYPE_PTR = 12;
export const DNS_TYPE_TXT = 16;
export const DNS_TYPE_SRV = 33;

export type DnsQuestion = { name: string; type: number };

// Names are kept as label arrays because DNS-SD instance labels may themselves
// contain dots ("Living Room 2.0._raop._tcp.local"); joining loses structure.
export type DnsRecord =
  | { type: 'PTR'; nameLabels: string[]; targetLabels: string[] }
  | { type: 'SRV'; nameLabels: string[]; targetLabels: string[] }
  | { type: 'TXT'; nameLabels: string[]; txt: Record<string, string> }
  | { type: 'A'; nameLabels: string[]; address: string };

const CLASS_IN = 0x0001;
const FLAG_RESPONSE = 0x8000;

function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    let codePoint = byte;
    let extra = 0;
    if (byte >= 0xf0) {
      codePoint = byte & 0x07;
      extra = 3;
    } else if (byte >= 0xe0) {
      codePoint = byte & 0x0f;
      extra = 2;
    } else if (byte >= 0xc0) {
      codePoint = byte & 0x1f;
      extra = 1;
    }
    if (i + extra >= bytes.length) return out; // truncated sequence
    for (let j = 1; j <= extra; j += 1) codePoint = (codePoint << 6) | (bytes[i + j] & 0x3f);
    i += extra + 1;
    try {
      out += String.fromCodePoint(codePoint);
    } catch {
      out += '�';
    }
  }
  return out;
}

// The names this codec encodes are ASCII (service types, in-addr.arpa), so a
// plain char-code write suffices.
function writeName(bytes: number[], name: string): void {
  for (const label of name.split('.')) {
    if (!label) continue;
    bytes.push(label.length);
    for (let i = 0; i < label.length; i += 1) bytes.push(label.charCodeAt(i) & 0xff);
  }
  bytes.push(0);
}

export function encodeDnsQuery(id: number, questions: DnsQuestion[]): Uint8Array {
  const bytes: number[] = [
    (id >> 8) & 0xff,
    id & 0xff,
    0x00, // standard query
    0x00,
    (questions.length >> 8) & 0xff,
    questions.length & 0xff,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  for (const question of questions) {
    writeName(bytes, question.name);
    bytes.push((question.type >> 8) & 0xff, question.type & 0xff);
    bytes.push((CLASS_IN >> 8) & 0xff, CLASS_IN & 0xff);
  }
  return Uint8Array.from(bytes);
}

type NameResult = { labels: string[]; next: number } | undefined;

// Reads a (possibly compression-pointer-chained) name. `next` is the offset
// after the name where it appears — pointer targets never advance it.
function readName(bytes: Uint8Array, offset: number): NameResult {
  const labels: string[] = [];
  let cursor = offset;
  let next: number | undefined;
  let jumps = 0;
  while (cursor < bytes.length) {
    const length = bytes[cursor];
    if (length === 0) {
      return { labels, next: next ?? cursor + 1 };
    }
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= bytes.length) return undefined;
      // A malicious/broken packet could chain pointers forever; bound the walk.
      if ((jumps += 1) > 32) return undefined;
      if (next === undefined) next = cursor + 2;
      cursor = ((length & 0x3f) << 8) | bytes[cursor + 1];
      continue;
    }
    if ((length & 0xc0) !== 0 || cursor + 1 + length > bytes.length) return undefined;
    labels.push(decodeUtf8(bytes.subarray(cursor + 1, cursor + 1 + length)));
    cursor += 1 + length;
    if (labels.length > 32) return undefined;
  }
  return undefined;
}

function parseTxt(rdata: Uint8Array): Record<string, string> {
  const txt: Record<string, string> = {};
  let offset = 0;
  while (offset < rdata.length) {
    const length = rdata[offset];
    const entry = decodeUtf8(rdata.subarray(offset + 1, offset + 1 + length));
    offset += 1 + length;
    if (!entry) continue;
    const eq = entry.indexOf('=');
    const key = eq === -1 ? entry : entry.slice(0, eq);
    if (key) txt[key] = eq === -1 ? '' : entry.slice(eq + 1);
  }
  return txt;
}

// Decodes every resource record (answers + authority + additionals) from a DNS
// response. Malformed packets yield whatever parsed cleanly before the damage;
// this never throws — the bytes come straight off the network.
export function decodeDnsRecords(bytes: Uint8Array): DnsRecord[] {
  if (bytes.length < 12) return [];
  const flags = (bytes[2] << 8) | bytes[3];
  if ((flags & FLAG_RESPONSE) === 0) return [];
  const questionCount = (bytes[4] << 8) | bytes[5];
  const recordCount =
    ((bytes[6] << 8) | bytes[7]) + ((bytes[8] << 8) | bytes[9]) + ((bytes[10] << 8) | bytes[11]);

  let offset = 12;
  for (let i = 0; i < questionCount; i += 1) {
    const name = readName(bytes, offset);
    if (!name) return [];
    offset = name.next + 4;
  }

  const records: DnsRecord[] = [];
  for (let i = 0; i < recordCount && offset < bytes.length; i += 1) {
    const name = readName(bytes, offset);
    if (!name) break;
    offset = name.next;
    if (offset + 10 > bytes.length) break;
    const type = (bytes[offset] << 8) | bytes[offset + 1];
    const rdLength = (bytes[offset + 8] << 8) | bytes[offset + 9];
    const rdStart = offset + 10;
    offset = rdStart + rdLength;
    if (offset > bytes.length) break;

    if (type === DNS_TYPE_PTR) {
      const target = readName(bytes, rdStart);
      if (target)
        records.push({ type: 'PTR', nameLabels: name.labels, targetLabels: target.labels });
    } else if (type === DNS_TYPE_SRV && rdLength >= 6) {
      const target = readName(bytes, rdStart + 6);
      if (target)
        records.push({ type: 'SRV', nameLabels: name.labels, targetLabels: target.labels });
    } else if (type === DNS_TYPE_TXT) {
      records.push({
        type: 'TXT',
        nameLabels: name.labels,
        txt: parseTxt(bytes.subarray(rdStart, rdStart + rdLength)),
      });
    } else if (type === DNS_TYPE_A && rdLength === 4) {
      records.push({
        type: 'A',
        nameLabels: name.labels,
        address: `${bytes[rdStart]}.${bytes[rdStart + 1]}.${bytes[rdStart + 2]}.${bytes[rdStart + 3]}`,
      });
    }
  }
  return records;
}

export function reverseLookupName(ip: string): string {
  return `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
}

// "4.3.2.1.in-addr.arpa" → "1.2.3.4"; undefined for anything else.
export function ipFromReverseName(labels: string[]): string | undefined {
  if (labels.length !== 6) return undefined;
  if (labels[4].toLowerCase() !== 'in-addr' || labels[5].toLowerCase() !== 'arpa') return undefined;
  const octets = labels.slice(0, 4).reverse();
  if (octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) return undefined;
  return octets.join('.');
}
