import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="border-b border-border bg-panel/40 backdrop-blur sticky top-0 z-20">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-xl font-bold text-cyan glow-cyan">{title}</h1>
          {subtitle && (
            <p className="text-hud text-[10px] text-muted-foreground mt-0.5">// {subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
