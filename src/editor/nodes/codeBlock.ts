import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { el } from '../dom';

const lowlight = createLowlight(common);

const CODE_LANGUAGES: [string, string][] = [
  ['', 'Text'],
  ['bash', 'Bash'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['css', 'CSS'],
  ['diff', 'Diff'],
  ['go', 'Go'],
  ['graphql', 'GraphQL'],
  ['xml', 'HTML/XML'],
  ['ini', 'INI'],
  ['java', 'Java'],
  ['javascript', 'JavaScript'],
  ['json', 'JSON'],
  ['kotlin', 'Kotlin'],
  ['lua', 'Lua'],
  ['makefile', 'Makefile'],
  ['markdown', 'Markdown'],
  ['objectivec', 'Objective-C'],
  ['perl', 'Perl'],
  ['php', 'PHP'],
  ['python', 'Python'],
  ['r', 'R'],
  ['ruby', 'Ruby'],
  ['rust', 'Rust'],
  ['scss', 'SCSS'],
  ['shell', 'Shell'],
  ['sql', 'SQL'],
  ['swift', 'Swift'],
  ['typescript', 'TypeScript'],
  ['yaml', 'YAML'],
];

/** Codeblock mit Syntax-Highlighting (lowlight) und Sprachauswahl. */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = el('div', 'code-block');
      const select = el('select', 'code-language');
      select.contentEditable = 'false';
      for (const [value, label] of CODE_LANGUAGES) {
        const option = el('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = node.attrs.language ?? '';
      select.addEventListener('change', () => {
        const pos = getPos();
        if (typeof pos === 'number') editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'language', select.value || null));
      });
      const pre = el('pre');
      const code = el('code', 'hljs');
      pre.append(code);
      dom.append(select, pre);
      return {
        dom,
        contentDOM: code,
        update: (updated) => {
          if (updated.type.name !== 'codeBlock') return false;
          select.value = updated.attrs.language ?? '';
          return true;
        },
        stopEvent: (event) => event.target === select,
        ignoreMutation: (mutation) => select.contains(mutation.target),
      };
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: ({ editor }) => editor.isActive('codeBlock') && editor.commands.insertContent('  '),
    };
  },
}).configure({ lowlight, defaultLanguage: null });
