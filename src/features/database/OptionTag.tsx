import type { SelectOption, TagColor } from '../../db/database';
import { cx } from '../../lib/cx';

/** Ausgeschriebene Klassen, damit Tailwind sie beim Scannen findet. */
export const TAG_CLASS: Record<TagColor, string> = {
  gray: 'tag-gray',
  brown: 'tag-brown',
  orange: 'tag-orange',
  yellow: 'tag-yellow',
  green: 'tag-green',
  blue: 'tag-blue',
  purple: 'tag-purple',
  pink: 'tag-pink',
  red: 'tag-red',
};

export function OptionTag({ option, className }: { option: SelectOption; className?: string }) {
  return (
    <span className={cx('inline-flex h-5 max-w-full items-center truncate rounded-sm px-1.5 text-xs', TAG_CLASS[option.color], className)}>
      {option.name}
    </span>
  );
}
