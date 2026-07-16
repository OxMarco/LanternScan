import { SANITIZED_DEVICE_FIXTURES } from '@/scanner/fingerprint/fixtures/sanitizedDevices';
import { presentDevice } from '@/scanner/present';

describe('sanitized device detection corpus', () => {
  const results = SANITIZED_DEVICE_FIXTURES.map((fixture) => {
    const presentation = presentDevice(
      {
        id: `fixture:${fixture.id}`,
        transport: fixture.transport,
        signals: fixture.signals,
        firstSeenAt: 1,
        lastSeenAt: 2,
      },
      { whitelist: [], blacklist: [] },
      false
    );
    return { fixture, presentation };
  });

  it.each(results)('$fixture.id selects the verified category', ({ fixture, presentation }) => {
    expect(presentation.category).toBe(fixture.expected.category);
  });

  it('meets independent category, family, and model accuracy gates', () => {
    const categoryAccuracy =
      results.filter(
        ({ fixture, presentation }) => presentation.category === fixture.expected.category
      ).length / results.length;

    const labeled = results.filter(({ fixture }) => fixture.expected.label);
    const labelAccuracy =
      labeled.filter(({ fixture, presentation }) =>
        presentation.guesses.some((guess) => guess.label === fixture.expected.label)
      ).length / labeled.length;

    const familyFixtures = results.filter(({ fixture }) => fixture.expected.family);
    const familyAccuracy =
      familyFixtures.filter(({ fixture, presentation }) =>
        presentation.guesses.some((guess) => guess.family === fixture.expected.family)
      ).length / familyFixtures.length;

    const modelFixtures = results.filter(({ fixture }) => fixture.expected.model);
    const modelAccuracy =
      modelFixtures.filter(({ fixture, presentation }) =>
        presentation.guesses.some((guess) => guess.model === fixture.expected.model)
      ).length / modelFixtures.length;

    expect(categoryAccuracy).toBe(1);
    expect(labelAccuracy).toBe(1);
    expect(familyAccuracy).toBe(1);
    expect(modelAccuracy).toBe(1);
  });
});
