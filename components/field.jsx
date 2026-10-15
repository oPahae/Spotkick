import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

const Field = forwardRef(function Field({ id, label, error, hint, icon: Icon, right, className = "", ...rest }, ref) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-chalk/80">
        {label}
      </label>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-chalk/40" aria-hidden="true" /> : null}
        <input
          id={id}
          ref={ref}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-xl bg-ink-950/60 text-base text-chalk placeholder:text-chalk/30 outline-none ring-1 ring-inset transition focus:bg-ink-950/80 focus:ring-2 ${Icon ? "pl-11" : "pl-4"} ${right ? "pr-12" : "pr-4"} ${error ? "ring-siren-500 focus:ring-siren-400" : "ring-white/15 focus:ring-flare-500"}`}
          {...rest}
        />
        {right ? <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</div> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-siren-400">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-chalk/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Field;
