import { useRef } from 'react';
import { CopyButton } from './CopyButton';
import { Icon } from './Icon';

export function LinkField({ link }: { link: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="link-field">
      <div className="link-field__input">
        <Icon name="link" size={18} />
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={link}
          aria-label="Link"
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <CopyButton text={link} onCopyFailed={() => inputRef.current?.select()} />
    </div>
  );
}
