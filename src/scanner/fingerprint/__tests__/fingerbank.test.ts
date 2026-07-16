import { AppError } from '@/lib/appError';
import {
  buildInterrogateRequest,
  describeFingerbankError,
  queryFingerbank,
  requestSignature,
  toGuess,
} from '@/scanner/fingerprint/fingerbank';

const SIGNALS = { mdnsServices: ['_ipp._tcp'], hostname: 'office-printer' };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

describe('buildInterrogateRequest', () => {
  it('qualifies mDNS services and includes mac + hostname', () => {
    const request = buildInterrogateRequest({
      mdnsServices: ['_ipp._tcp', '_printer._tcp.local'],
      mac: 'AA:BB:CC:DD:EE:FF',
      hostname: 'office-printer',
    });
    expect(request).toEqual({
      mdns_services: ['_ipp._tcp.local', '_printer._tcp.local'],
      mac: 'AA:BB:CC:DD:EE:FF',
      hostname: 'office-printer',
    });
  });

  it('caps mDNS services at five', () => {
    const request = buildInterrogateRequest({
      mdnsServices: ['_a._tcp', '_b._tcp', '_c._tcp', '_d._tcp', '_e._tcp', '_f._tcp'],
    });
    expect(request?.mdns_services).toHaveLength(5);
  });

  it('falls back to name when hostname is absent', () => {
    const request = buildInterrogateRequest({ mdnsServices: ['_ipp._tcp'], name: 'Kitchen' });
    expect(request?.hostname).toBe('Kitchen');
  });

  it('returns undefined without mDNS services (avoids leaking a bare MAC)', () => {
    expect(buildInterrogateRequest({ mac: 'AA:BB:CC:DD:EE:FF' })).toBeUndefined();
    expect(buildInterrogateRequest({})).toBeUndefined();
  });
});

describe('requestSignature', () => {
  it('is stable regardless of service order', () => {
    const a = requestSignature({ mdns_services: ['_a._tcp.local', '_b._tcp.local'] });
    const b = requestSignature({ mdns_services: ['_b._tcp.local', '_a._tcp.local'] });
    expect(a).toBe(b);
  });

  it('distinguishes different combinations', () => {
    const a = requestSignature({ mdns_services: ['_a._tcp.local'], mac: '1' });
    const b = requestSignature({ mdns_services: ['_a._tcp.local'], mac: '2' });
    expect(a).not.toBe(b);
  });
});

describe('toGuess', () => {
  it('combines manufacturer and device names and scales the score', () => {
    const guess = toGuess({
      device: { name: 'Chromecast' },
      manufacturer: { name: 'Google' },
      score: 100,
    });
    expect(guess?.label).toBe('Google Chromecast');
    expect(guess?.reason).toBe('Fingerbank match');
    expect(guess?.confidence).toBeCloseTo(0.9);
  });

  it('does not double up when the device name already names the manufacturer', () => {
    const guess = toGuess({
      device: { name: 'Apple TV 4K' },
      manufacturer: { name: 'Apple' },
      score: 50,
    });
    expect(guess?.label).toBe('Apple TV 4K');
  });

  it('returns undefined when there is no usable label', () => {
    expect(toGuess({ score: 80 })).toBeUndefined();
  });
});

describe('queryFingerbank', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reports a match', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { device: { name: 'Chromecast' }, manufacturer: { name: 'Google' } })
    );
    const outcome = await queryFingerbank(SIGNALS, { apiKey: 'k' });
    expect(outcome).toEqual({
      status: 'matched',
      guess: { label: 'Google Chromecast', confidence: 0.5, reason: 'Fingerbank match' },
    });
  });

  it('skips when there is nothing worth asking about', async () => {
    const outcome = await queryFingerbank({ mac: 'AA:BB:CC:DD:EE:FF' }, { apiKey: 'k' });
    expect(outcome).toEqual({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a 404 as an answer, not a failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, {}));
    await expect(queryFingerbank(SIGNALS, { apiKey: 'k' })).resolves.toEqual({
      status: 'no-match',
    });
  });

  it('treats a 200 with no usable label as no match', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { score: 80 }));
    await expect(queryFingerbank(SIGNALS, { apiKey: 'k' })).resolves.toEqual({
      status: 'no-match',
    });
  });

  it('reports an unreachable Fingerbank as a failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const outcome = await queryFingerbank(SIGNALS, { apiKey: 'k' });
    expect(outcome.status).toBe('failed');
    if (outcome.status !== 'failed') throw new Error('expected failure');
    expect(outcome.error.kind).toBe('network');
  });

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [500, 'server'],
  ])('reports HTTP %i as a failure', async (status, kind) => {
    fetchMock.mockResolvedValue(jsonResponse(status, {}));
    const outcome = await queryFingerbank(SIGNALS, { apiKey: 'k' });
    expect(outcome.status).toBe('failed');
    if (outcome.status !== 'failed') throw new Error('expected failure');
    expect(outcome.error.kind).toBe(kind);
  });

  it('stays quiet when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockImplementation(() => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });
    await expect(
      queryFingerbank(SIGNALS, { apiKey: 'k', signal: controller.signal })
    ).resolves.toEqual({ status: 'skipped' });
  });
});

describe('describeFingerbankError', () => {
  it('blames the key on an auth failure rather than a session', () => {
    const message = describeFingerbankError(
      new AppError({ kind: 'auth', message: '401', userMessage: '', retryable: false })
    );
    expect(message).toContain('API key');
  });

  it('describes an unreachable service as a reachability problem', () => {
    const message = describeFingerbankError(
      new AppError({ kind: 'network', message: 'offline', userMessage: '', retryable: true })
    );
    expect(message).toContain('Could not reach Fingerbank');
  });
});
