import { Pipe, PipeTransform } from '@angular/core';

export function normalizeItemSize(
  size: string | null | undefined
): string {
  const clean = size?.trim() ?? '';
  return !clean || clean.toLowerCase() === 'select size' ? 'No Size' : clean;
}

@Pipe({
  name: 'itemSize',
  standalone: true,
})
export class ItemSizePipe implements PipeTransform {
  transform(size: string | null | undefined): string {
    return normalizeItemSize(size);
  }
}
