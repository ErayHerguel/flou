import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import type { ReactNode } from 'react';
import { SuggestionList, type SuggestionListHandle } from './SuggestionList';

interface ListConfig<T> {
  renderItem: (item: T, active: boolean) => ReactNode;
  itemKey: (item: T) => string;
  /** Gruppenüberschrift; erhält die aktuelle Anfrage, um beim Filtern Gruppen auszublenden. */
  group?: (item: T, query: string) => string | undefined;
  empty: string;
}

/** Verbindet das Suggestion-Plugin mit der React-Liste; Positionierung übernimmt TipTap (mount). */
export function listRenderer<T>(config: ListConfig<T>): SuggestionOptions<T, T>['render'] {
  return () => {
    let component: ReactRenderer<SuggestionListHandle> | null = null;
    let unmount: (() => void) | null = null;

    const propsFor = (props: SuggestionProps<T, T>) => ({
      ...config,
      group: config.group ? (item: T) => config.group!(item, props.query) : undefined,
      items: props.items,
      command: props.command,
    });

    return {
      onStart(props) {
        component = new ReactRenderer(SuggestionList, { props: propsFor(props), editor: props.editor });
        (component.element as HTMLElement).style.zIndex = '50';
        unmount = props.mount(component.element as HTMLElement);
      },
      onUpdate(props) {
        component?.updateProps(propsFor(props));
      },
      onKeyDown({ event }) {
        return component?.ref?.onKeyDown(event) ?? false;
      },
      onExit() {
        unmount?.();
        component?.destroy();
        component = null;
        unmount = null;
      },
    };
  };
}
