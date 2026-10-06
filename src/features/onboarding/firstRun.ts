import { saveContent } from '../../db/content';
import { jsonText } from '../../lib/doc';
import { setSetting } from '../../db/settings';
import { commit } from '../../db/saveQueue';
import { usePages } from '../../store/pages';
import { welcomeDoc } from './welcome';

const KEY = 'app.initialized';

/** Legt beim allerersten Start eine Willkommensseite an. Liefert deren ID oder null. */
export async function runFirstStart(settings: Record<string, string>): Promise<string | null> {
  if (settings[KEY] === '1') return null;
  if (Object.keys(usePages.getState().pages).length > 0) {
    await commit([setSetting(KEY, '1')]);
    return null;
  }
  const doc = welcomeDoc();
  return usePages.getState().create({
    title: 'Willkommen',
    icon: '👋',
    extra: (page) => [...saveContent(page.id, doc, jsonText(doc), [], page.createdAt), setSetting(KEY, '1')],
  });
}
