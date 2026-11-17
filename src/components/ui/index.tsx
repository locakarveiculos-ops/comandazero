"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Loader2, X } from "lucide-react";
import { forwardRef, type CSSProperties, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useDb } from "@/lib/repositories/store";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand" | "outline";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  brand: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "bg-ui-surface-2 text-ui-text hover:brightness-95",
  outline: "border border-ui-border bg-transparent hover:bg-ui-surface-2",
  ghost: "bg-transparent hover:bg-ui-surface-2",
  danger: "bg-ui-error text-white hover:brightness-90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" | "sm"; loading?: boolean }>(
  function Button({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--ui-radius)] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          size === "lg" ? "px-6 text-base min-h-12" : size === "sm" ? "px-3 text-sm" : "px-5 text-sm",
          VARIANT[variant],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs opacity-75">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-ui-error">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "min-h-11 w-full rounded-[10px] border border-ui-border bg-ui-surface px-3.5 text-base text-ui-text placeholder:text-ui-muted aria-[invalid=true]:border-ui-error";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputBase, className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "min-h-20 py-2.5", className)} {...p} />;
});

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, "pr-8", className)} {...p} />;
}

export function Switch({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-[#8a94a6] transition data-[state=checked]:bg-[#16845b] before:absolute before:-inset-2 before:content-['']"
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "center",
  className,
  hideTitle,
  themeStyle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: "center" | "right" | "bottom";
  className?: string;
  hideTitle?: boolean;
  /** Variáveis de tema do estabelecimento: o portal fica fora do wrapper da loja. */
  themeStyle?: CSSProperties;
}) {
  const saasTheme = useDb((s) => s.saasTheme);
  const pos =
    side === "right"
      ? "inset-y-0 right-0 h-full w-full max-w-md rounded-l-3xl"
      : side === "bottom"
        ? "inset-x-0 bottom-0 max-h-[92vh] w-full rounded-t-3xl sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        : "left-1/2 top-1/2 max-h-[92vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
        <Dialog.Content
          style={themeStyle}
          data-saas-theme={themeStyle ? undefined : saasTheme}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden shadow-2xl outline-none",
            // Portal fica fora do layout: reaplica a camada certa (loja = tokens da loja; resto = ComandaZero).
            themeStyle ? "tenant bg-surface text-ink" : "cz-saas-ui bg-ui-surface text-ui-text",
            pos,
            className,
          )}
        >
          <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", hideTitle && "sr-only")}>
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description && <Dialog.Description className="text-sm opacity-75">{description}</Dialog.Description>}
            </div>
          </div>
          {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-white/95 text-[#0b1f40] shadow-md hover:bg-white"
          >
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue"; className?: string }) {
  const tones = {
    neutral: "bg-ui-surface-2 text-ui-text ring-1 ring-ui-border",
    green: "bg-[#e3f3ec] text-[#0f6646]",
    amber: "bg-[#f8ecdc] text-[#7d4710]",
    red: "bg-[#f8e4e4] text-[#8f2a2a]",
    blue: "bg-[#e2ecf7] text-[#1d4f85]",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[14px] border border-ui-border bg-ui-surface p-5 text-ui-text shadow-[0_1px_2px_rgb(11_31_64/0.04)]", className)}>{children}</div>;
}

export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-ui-border" role="group" aria-label={label}>
      <button type="button" className="grid size-11 place-items-center rounded-full text-lg font-bold disabled:opacity-40" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`}>
        −
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="grid size-11 place-items-center rounded-full text-lg font-bold disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`}>
        +
      </button>
    </div>
  );
}

/** Estado vazio acionável: 1 frase do para quê serve a tela + ação principal (nunca uma tela morta). */
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-[14px] border border-dashed border-ui-border bg-ui-surface p-8 text-center sm:p-10">
      {icon && <span className="grid size-14 place-items-center rounded-full bg-ui-surface-2">{icon}</span>}
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-md text-sm text-ui-muted">{children}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ui-surface-2", className)} aria-hidden />;
}
