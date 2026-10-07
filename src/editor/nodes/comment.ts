import { Mark } from '@tiptap/core';

/** Kommentar an einer Textstelle; der Text liegt im Dokument selbst (lokal, durchsuchbar, exportfest). */
export const Comment = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      id: { default: null, parseHTML: (e) => e.getAttribute('data-comment') },
      text: { default: '', parseHTML: (e) => e.getAttribute('data-comment-text') ?? '' },
      createdAt: { default: 0, parseHTML: (e) => Number(e.getAttribute('data-created')) || 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment]' }];
  },

  renderHTML({ mark }) {
    return [
      'span',
      { 'data-comment': mark.attrs.id, 'data-comment-text': mark.attrs.text, 'data-created': mark.attrs.createdAt, class: 'comment-mark' },
      0,
    ];
  },
});

export interface CommentInfo {
  id: string;
  text: string;
  createdAt: number;
  quote: string;
  from: number;
  to: number;
}
