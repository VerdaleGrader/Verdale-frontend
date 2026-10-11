'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** In-page tabs (Radix: arrow keys, Home and End, roving tabindex). For routes use TabNav. */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('vd-tabs', className)} {...props} />;
}

function TabsTrigger({
  count,
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger className={cn('vd-tab', className)} {...props}>
      {children}
      {count !== undefined && <span className="vd-tab__count">{count}</span>}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent(props: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
