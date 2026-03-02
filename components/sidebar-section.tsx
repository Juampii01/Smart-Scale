import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function SidebarSection({ title, icon: Icon, items, activePath, onClose }) {
  // Determinar si alguna ruta hija está activa
  const hasActive = useMemo(() => items.some(item => activePath === item.href), [activePath, items]);
  const [open, setOpen] = useState(hasActive);

  return (
    <div className="mb-2">
      <button
        className={cn(
          "w-full justify-start gap-3 transition-all duration-200 flex items-center rounded-md px-2 py-2",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          open ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" : ""
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 text-[#ffde21]" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="pl-6 flex flex-col gap-1 mt-2">
          {items.map((item) => (
            <Link key={item.name} href={item.href} onClick={onClose}>
              <Button
                variant={activePath === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-all duration-200",
                  activePath === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4 text-[#ffde21]" />
                {item.name}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
