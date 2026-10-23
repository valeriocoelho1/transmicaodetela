import { useEffect, useState } from 'react';

interface CopyButtonProps {
  text: string;
  onCopyFailed: () => void;
}

export function CopyButton({ text, onCopyFailed }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      onCopyFailed();
    }
  }

  return (
    <button type="button" onClick={() => void copy()}>
      {copied ? 'Link copiado' : 'Copiar link'}
    </button>
  );
}
