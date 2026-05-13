import * as React from "react";
import { Input } from "@/components/ui/input";

// Safely evaluates simple math expressions: +, -, *, /, parens, decimals.
// Returns null if invalid.
export function evalMathExpression(expr: string): number | null {
  if (!expr) return null;
  // Normalize comma decimal to dot
  const normalized = expr.replace(/,/g, ".").trim();
  // Allow only digits, dot, whitespace, parens and + - * /
  if (!/^[\d\s.+\-*/()]+$/.test(normalized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${normalized});`)();
    if (typeof result === "number" && isFinite(result)) {
      return Math.round(result * 1e6) / 1e6;
    }
    return null;
  } catch {
    return null;
  }
}

type Props = Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "type"> & {
  value: number | string;
  onChange: (value: string) => void;
  /** Called with the evaluated number when the user confirms the expression */
  onCommit?: (value: number) => void;
};

/**
 * Numeric input that accepts plain numbers OR simple math expressions like
 * "10+5", "20-3", "4*6", "12/4". The expression is evaluated on Enter, Tab or blur,
 * and the field is replaced with the numeric result.
 */
export const CalcInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, onCommit, onKeyDown, onBlur, ...rest }, ref) => {
    const [raw, setRaw] = React.useState<string>(String(value ?? ""));
    const lastExternal = React.useRef<string>(String(value ?? ""));

    // Sync external numeric value -> input when it changes outside (and the user
    // is not currently editing an expression).
    React.useEffect(() => {
      const ext = String(value ?? "");
      if (ext !== lastExternal.current) {
        lastExternal.current = ext;
        // Only override if current raw doesn't contain an operator (user typing math)
        if (!/[+\-*/()]/.test(raw)) setRaw(ext);
      }
    }, [value, raw]);

    const commit = () => {
      if (!/[+\-*/()]/.test(raw)) return; // nothing to evaluate
      const result = evalMathExpression(raw);
      if (result !== null) {
        const str = String(result);
        setRaw(str);
        lastExternal.current = str;
        onChange(str);
        onCommit?.(result);
      }
    };

    return (
      <Input
        ref={ref}
        {...rest}
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          // If it's a plain number, propagate immediately
          if (!/[+\-*/()]/.test(e.target.value)) onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") commit();
          onKeyDown?.(e);
        }}
        onBlur={(e) => {
          commit();
          onBlur?.(e);
        }}
      />
    );
  }
);
CalcInput.displayName = "CalcInput";
