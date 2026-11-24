"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows a spinner and blocks a second tap while its form is being sent. */
export default function CnSubmit({
  children,
  pendingLabel,
  className = "btn gold",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending}>
      {pending ? <><span className="cn-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  );
}
