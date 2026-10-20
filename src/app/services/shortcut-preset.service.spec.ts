import { SqliteService } from './sqlite.service';
import { ShortcutPresetService } from './shortcut-preset.service';
import { ShortcutPreset } from '../drawer/pos-sales/shortcut-preset.model';

describe('ShortcutPresetService', () => {
  let db: jasmine.SpyObj<SqliteService>;
  let service: ShortcutPresetService;

  beforeEach(() => {
    localStorage.removeItem('vpos_shortcut_presets');
    db = jasmine.createSpyObj<SqliteService>('SqliteService', [
      'query',
      'execute',
      'executeInTransaction',
    ]);
    db.execute.and.resolveTo();
    db.executeInTransaction.and.callFake(async (operation: any) =>
      operation()
    );
    service = new ShortcutPresetService(db);
  });

  afterEach(() => localStorage.removeItem('vpos_shortcut_presets'));

  it('migrates legacy local presets to SQLite on first read', async () => {
    const presets: ShortcutPreset[] = [
      { id: 'preset-1', codeName: 'Lunch', customer: {}, items: [] },
    ];
    localStorage.setItem('vpos_shortcut_presets', JSON.stringify(presets));
    db.query.and.resolveTo([]);

    expect(await service.getAll()).toEqual(presets);
    expect(db.execute).toHaveBeenCalledWith(
      'INSERT INTO shortcut_presets (preset_id, position, preset_json) VALUES (?, ?, ?)',
      ['preset-1', 0, JSON.stringify(presets[0])],
      false
    );
    expect(localStorage.getItem('vpos_shortcut_presets')).toBeNull();
  });
});
