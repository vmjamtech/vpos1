import { loadImage } from './load-image';

describe('loadImage', () => {
  let image: HTMLImageElement;

  beforeEach(() => {
    image = {
      onload: null,
      onerror: null,
      src: '',
    } as unknown as HTMLImageElement;
    spyOn(window, 'Image').and.returnValue(image);
  });

  it('resolves after the image loads', async () => {
    const result = loadImage('assets/logo.png');
    expect(image.src).toBe('assets/logo.png');

    image.onload?.(new Event('load'));

    await expectAsync(result).toBeResolvedTo(image);
  });

  it('rejects when the image cannot load', async () => {
    const result = loadImage('assets/missing-logo.png');

    image.onerror?.(new Event('error'));

    await expectAsync(result).toBeRejectedWithError(
      'Unable to load receipt image.'
    );
  });
});