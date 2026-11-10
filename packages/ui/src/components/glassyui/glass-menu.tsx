'use client';

import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { GlassPanel } from './glass-panel';

/** A menu button: Radix handles focus, arrow keys, typeahead and Escape. */
export const GlassMenu = MenuPrimitive.Root;

export const GlassMenuTrigger = MenuPrimitive.Trigger;

/** The open menu, on a glass panel, aligned to the end of its trigger. */
export function GlassMenuContent({
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content align="end" sideOffset={6} asChild {...rest}>
        <GlassPanel className={clsx('z-50 flex min-w-60 flex-col p-1.5', className)}>
          {children}
        </GlassPanel>
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

export interface GlassMenuItemProps extends React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.Item
> {
  /** Why the item is unavailable, shown under its label. */
  readonly reason?: string | null | undefined;
  readonly children: ReactNode;
}

/** The look shared by dropdown and context menu items. */
export const MENU_ITEM_CLASS = clsx(
  'flex cursor-pointer flex-col rounded-lg px-3 py-2 text-sm outline-none select-none',
  'data-[highlighted]:bg-indigo-500/20 data-[disabled]:cursor-not-allowed',
);

/** A menu item's label, and under it the reason it is unavailable, if any. */
export function MenuItemBody({
  disabled,
  reason,
  children,
}: {
  readonly disabled?: boolean | undefined;
  readonly reason?: string | null | undefined;
  readonly children: ReactNode;
}) {
  return (
    <>
      <span className={disabled ? 'opacity-60' : undefined}>{children}</span>
      {reason && <span className="text-xs opacity-80">{reason}</span>}
    </>
  );
}

/** A menu item; a disabled one shows its reason, since it cannot take focus to describe it. */
export function GlassMenuItem({ className, reason, children, ...rest }: GlassMenuItemProps) {
  return (
    <MenuPrimitive.Item className={clsx(MENU_ITEM_CLASS, className)} {...rest}>
      <MenuItemBody disabled={rest.disabled} reason={reason}>
        {children}
      </MenuItemBody>
    </MenuPrimitive.Item>
  );
}

/** A line between groups of menu items. */
export function GlassMenuSeparator({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={clsx('my-1 h-px bg-black/15 dark:bg-white/20', className)}
      {...rest}
    />
  );
}
