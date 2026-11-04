import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { SUITS, SUIT_NAMES, cardId, cardName, isRed, label, spoken } from "../lib/cards";
import "./cards.css";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/** One playing card (or an empty slot) in the shared `kl-card` style. Card
 *  ids follow `lib/cards`. `card` null draws an empty slot, `faceDown` a
 *  card back — with `card` null too, that is a stock whose top card does
 *  not matter. `children` replace the default rank+suit label (a foundation
 *  showing its suit, or a stock's count). Any other button attribute
 *  passes through. Screen readers hear the card by name ("queen of
 *  hearts", "face-down card", "empty space") unless `aria-label` says
 *  otherwise, and a selected card is announced as pressed (as selected,
 *  for a `role="gridcell"` card in a keyboard grid). `place` puts
 *  where the card sits in front of that name ("column 3, queen of hearts"). */
export function PlayingCard({
  card,
  faceDown,
  selected,
  place,
  className,
  children,
  ...rest
}: {
  card: number | null;
  faceDown?: boolean;
  selected?: boolean;
  place?: string;
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
    <button
      type="button"
      className={cls.join(" ")}
      aria-label={place ? `${place}, ${cardName(card, faceDown)}` : cardName(card, faceDown)}
      // A grid cell has no pressed state; it is selected instead.
      aria-pressed={rest.role === "gridcell" ? undefined : selected || undefined}
      aria-selected={rest.role === "gridcell" ? !!selected : undefined}
      {...rest}
    >
      {children ?? (card !== null && !faceDown ? label(card) : "")}
    </button>
  );
}

/** A suit's foundation in the shared `kl-found` style: its top card, or the
 *  bare suit symbol while it is empty. `top` is the highest rank placed on
 *  it (0 = empty). `name` overrides the spoken "spades foundation" (a
 *  two-pack game has two of each). Other props pass through to
 *  `PlayingCard`. */
export function Foundation({
  suit,
  top,
  name,
  className,
  ...rest
}: { suit: number; top: number; name?: string; className?: string } & ButtonProps) {
  return (
    <PlayingCard
      card={top ? cardId(top, suit) : null}
      className={className ? `kl-found ${className}` : "kl-found"}
      aria-label={`${name ?? `${SUIT_NAMES[suit]} foundation`}${
        top ? `, ${spoken(cardId(top, suit))}` : ", empty"
      }`}
      {...rest}
    >
      {top ? undefined : SUITS[suit]}
    </PlayingCard>
  );
}

/** A tableau pile: the `kl-pile` box its cards stack in. Tapping the bare
 *  box (not a card in it) calls `onTap`. It is a group named `name`
 *  ("Column 3"); while `empty` is set it is itself a keyboard button
 *  ("Column 3, empty") so a card can be moved into it without a pointer —
 *  for piles that draw no empty-slot card of their own. */
export function Pile({
  name,
  empty,
  onTap,
  className = "kl-pile",
  children,
  ...rest
}: {
  name: string;
  empty?: boolean;
  onTap: () => void;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "onClick" | "children">) {
  return (
    <div
      className={className}
      role={empty ? "button" : "group"}
      aria-label={empty ? `${name}, empty` : name}
      tabIndex={empty ? 0 : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onTap();
      }}
      onKeyDown={
        empty
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTap();
              }
            }
          : undefined
      }
      {...rest}
    >
      {children}
    </div>
  );
}
