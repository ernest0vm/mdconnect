'use client';

import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { MENU_ITEM_CLASS, MenuItemBody } from './glass-menu';
import { GlassPanel } from './glass-panel';

/**
 * A menu opened by right-click, or by the context-menu key or Shift+F10 on a focused trigger.
 * Radix handles focus, arrow keys, typeahead and Escape, as in GlassMenu.
 */
export const GlassContextMenu = ContextMenuPrimitive.Root;

export const GlassContextMenuTrigger = ContextMenuPrimitive.Trigger;

/** The open menu, on the same glass panel as GlassMenu. */
export function GlassContextMenuContent({
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content asChild {...rest}>
        <GlassPanel className={clsx('z-50 flex min-w-52 flex-col p-1.5', className)}>
          {children}
        </GlassPanel>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
}

/** A context menu item, styled like GlassMenuItem, with the reason when it is unavailable. */
export function GlassContextMenuItem({
  className,
  reason,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  readonly reason?: string | null | undefined;
  readonly children: ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Item className={clsx(MENU_ITEM_CLASS, className)} {...rest}>
      <MenuItemBody disabled={rest.disabled} reason={reason}>
        {children}
      </MenuItemBody>
    </ContextMenuPrimitive.Item>
  );
}
