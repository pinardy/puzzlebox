import type { ButtonHTMLAttributes, ReactNode } from "react";
import { isRed, label } from "../lib/cards";

/** One playing card (or an empty slot) in the shared `kl-card` style. Card
 *  ids follow `lib/cards`. `card` null draws an empty slot, `faceDown` a
 *  card back; `children` replace the default rank+suit label (a foundation
 *  showing its suit, say). Any other button attribute passes through. */
export function PlayingCard({
  card,
  faceDown,
  selected,
  className,
  children,
  ...rest
}: {
  card: number | null;
  faceDown?: boolean;
  selected?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const cls = ["kl-card"];
  if (card === null) cls.push("kl-empty");
  else if (faceDown) cls.push("kl-back");
  else if (isRed(card)) cls.push("red");
  if (selected) cls.push("selected");
  if (className) cls.push(className);
  return (
    <button type="button" className={cls.join(" ")} {...rest}>
      {children ?? (card !== null && !faceDown ? label(card) : "")}
    </button>
  );
}
