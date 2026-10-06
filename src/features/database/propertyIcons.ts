import { AlignLeft, Calendar, CircleChevronDown, Hash, Link, SquareCheck, Tags, Type, type LucideIcon } from 'lucide-react';
import type { PropertyType } from '../../db/database';

export const PROPERTY_ICON: Record<PropertyType, LucideIcon> = {
  text: AlignLeft,
  number: Hash,
  select: CircleChevronDown,
  multi_select: Tags,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link,
};

export const TITLE_ICON = Type;

export const PROPERTY_TYPES: PropertyType[] = ['text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url'];
