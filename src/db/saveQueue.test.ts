import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from '../test/setup';
import { commit, discard, flush, schedule, useSaveStatus } from './saveQueue';
import { setSetting } from './settings';

describe('Speicher-Warteschlange', () => {
  it('bündelt Änderungen pro Schlüssel und schreibt nur den letzten Stand', async () => {
    const driver = await freshDatabase();
    const tx = vi.spyOn(driver, 'tx');
    schedule('setting:a', () => [setSetting('a', '1')]);
    schedule('setting:a', () => [setSetting('a', '2')]);
    schedule('setting:b', () => [setSetting('b', 'x')]);
    await flush();
    expect(tx).toHaveBeenCalledTimes(1);
    expect(await driver.select('SELECT key, value FROM settings ORDER BY key')).toEqual([
      { key: 'a', value: '2' },
      { key: 'b', value: 'x' },
    ]);
  });

  it('behält Änderungen bei einem Fehler und schreibt sie beim nächsten Versuch', async () => {
    const driver = await freshDatabase();
    vi.spyOn(driver, 'tx').mockRejectedValueOnce(new Error('gesperrt'));
    schedule('setting:x', () => [setSetting('x', 'wichtig')]);
    await flush();
    expect(useSaveStatus.getState().status).toBe('error');
    expect(await driver.select('SELECT * FROM settings WHERE key = ?', ['x'])).toEqual([]);
    await flush();
    expect(useSaveStatus.getState().status).toBe('idle');
    expect(await driver.select('SELECT value FROM settings WHERE key = ?', ['x'])).toEqual([{ value: 'wichtig' }]);
  });

  it('schreibt sofortige Änderungen nach den ausstehenden', async () => {
    const driver = await freshDatabase();
    schedule('setting:order', () => [setSetting('order', 'debounced')]);
    await commit([setSetting('order', 'commit')]);
    expect(await driver.select('SELECT value FROM settings WHERE key = ?', ['order'])).toEqual([{ value: 'commit' }]);
  });

  it('verwirft ausstehende Änderungen gezielt', async () => {
    const driver = await freshDatabase();
    schedule('setting:drop', () => [setSetting('drop', '1')]);
    discard((key) => key === 'setting:drop');
    await flush();
    expect(await driver.select('SELECT * FROM settings WHERE key = ?', ['drop'])).toEqual([]);
  });

  it('rollt eine fehlgeschlagene Transaktion vollständig zurück', async () => {
    const driver = await freshDatabase();
    await expect(
      commit([setSetting('t', '1'), { sql: 'INSERT INTO nicht_da VALUES (1)' }]),
    ).rejects.toThrow();
    expect(await driver.select('SELECT * FROM settings WHERE key = ?', ['t'])).toEqual([]);
  });
});
