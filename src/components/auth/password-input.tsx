"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Força da senha (0–4): tamanho, maiúscula+minúscula, número, símbolo. Só orienta; o mínimo exigido é 8 caracteres. */
export function passwordScore(p: string) {
  if (p.length < 8) return 0;
  return 1 + Number(/[a-z]/.test(p) && /[A-Z]/.test(p)) + Number(/\d/.test(p)) + Number(/[^A-Za-z0-9]/.test(p) || p.length >= 14);
}
const LABEL = ["Muito curta", "Fraca", "Razoável", "Boa", "Forte"];
const COLOR = ["bg-cz-error", "bg-cz-error", "bg-cz-warning", "bg-cz-success", "bg-cz-success"];

type Props = React.InputHTMLAttributes<HTMLInputElement> & { showStrength?: boolean };

/** Campo de senha com botão mostrar/ocultar (alvo de 44 px) e medidor de força opcional. */
export function PasswordInput({ showStrength, value, className, ...p }: Props) {
  const [show, setShow] = useState(false);
  const v = String(value ?? "");
  const score = passwordScore(v);
  return (
    <>
      <div className="relative">
        <Input {...p} value={value} type={show ? "text" : "password"} className={cn("pr-12", className)} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[10px] text-cz-muted hover:text-cz-text"
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {showStrength && v && (
        <div className="grid gap-1" aria-live="polite">
          <div className="grid grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 rounded-full", i <= score ? COLOR[score] : "bg-cz-border")} />
            ))}
          </div>
          <p className="text-xs text-cz-muted">Força da senha: {LABEL[score]}</p>
        </div>
      )}
    </>
  );
}
