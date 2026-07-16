import { theengsDeviceLabels } from '@/scanner/fingerprint/theengs';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('Theengs BLE fingerprints', () => {
  it('matches a Govee model using its name and manufacturer payload together', () => {
    const labels = theengsDeviceLabels({
      name: 'GVH5075_6C11',
      manufacturerData: b64([0x88, 0xec, 0x00, 0x03, 0x32, 0x9c, 0x64, 0x00]),
    });
    expect(labels).toContain('Govee Thermo-Hygrometer');
    expect(theengsDeviceLabels({ name: 'GVH5075_6C11' })).not.toContain('Govee Thermo-Hygrometer');
  });

  it('keeps service data paired with its service UUID', () => {
    const labels = theengsDeviceLabels({
      name: 'asensor_1234',
      serviceData: { fcd2: b64([0x40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
    });
    expect(labels).toContain('April Brother N07');
  });
});
