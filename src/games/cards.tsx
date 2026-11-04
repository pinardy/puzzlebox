import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SUITS, cardId, isRed, label } from "../lib/cards";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/** One playing card (or an empty slot) in the shared `kl-card` style. Card
 *  ids follow `lib/cards`. `card` null draws an empty slot, `faceDown` a
 *  card back — with `card` null too, that is a stock whose top card does
 *  not matter. `children` replace the default rank+suit label (a foundation
 *  showing its suit, or a stock's count). Any other button attribute
 *  passes through. */
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
} & ButtonProps) {
  const cls = ["kl-card"];
  if (faceDown) cls.push("kl-back");
  else if (card === null) cls.push("kl-empty");
  else if (isRed(card)) cls.push("red");
  if (selected) cls.push("selected");
  if (className) cls.push(className);
  return (
    <button type="button" className={cls.join(" ")} {...rest}>
      {children ?? (card !== null && !faceDown ? label(card) : "")}
    </button>
  );
}

/** A suit's foundation in the shared `kl-found` style: its top card, or the
 *  bare suit symbol while it is empty. `top` is the highest rank placed on
 *  it (0 = empty). Other props pass through to `PlayingCard`. */
export function Foundation({
  suit,
  top,
  className,
  ...rest
}: { suit: number; top: number; className?: string } & ButtonProps) {
  return (
    <PlayingCard
      card={top ? cardId(top, suit) : null}
      className={className ? `kl-found ${className}` : "kl-found"}
      {...rest}
    >
      {top ? undefined : SUITS[suit]}
    </PlayingCard>
  );
}
