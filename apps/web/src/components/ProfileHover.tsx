import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Profile } from '../hooks/useProfile';
import { Avatar } from './Avatar';

const OPEN_DELAY_MS = 200;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 200;
const GAP = 10;

interface ProfileHoverProps {
  profile: Profile;
  role?: string;
  className?: string;
  // Lets keyboard and touch users open the card when the content is not focusable itself.
  focusable?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

// The card is drawn in a portal with fixed coordinates so scrolling side panels do not clip it.
export function ProfileHover({
  profile,
  role,
  className,
  focusable = false,
  disabled = false,
  children,
}: ProfileHoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const cardId = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  function open() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const left = Math.min(
        Math.max(anchor.left + anchor.width / 2 - CARD_WIDTH / 2, GAP),
        window.innerWidth - CARD_WIDTH - GAP,
      );
      const below = anchor.bottom + GAP;
      const top = below + CARD_HEIGHT > window.innerHeight ? anchor.top - GAP - CARD_HEIGHT : below;
      setPosition({ top: Math.max(top, GAP), left });
    }, OPEN_DELAY_MS);
  }

  function close() {
    clearTimeout(timer.current);
    setPosition(null);
  }

  const shown = position !== null && !disabled;

  return (
    <span
      ref={anchorRef}
      className={['profile-hover', className].filter(Boolean).join(' ')}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={shown ? cardId : undefined}
      // Touch screens fire enter and leave around every tap, so they use focus instead.
      onPointerEnter={(event) => event.pointerType !== 'touch' && open()}
      onPointerLeave={(event) => event.pointerType !== 'touch' && close()}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {shown &&
        createPortal(
          <div
            id={cardId}
            role="tooltip"
            className="profile-card"
            style={{ top: position.top, left: position.left, width: CARD_WIDTH }}
          >
            <Avatar avatar={profile.avatar} size={96} />
            <p className="profile-card__name">{profile.name}</p>
            {role && <p className="profile-card__role">{role}</p>}
          </div>,
          document.body,
        )}
    </span>
  );
}
