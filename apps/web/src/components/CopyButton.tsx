import { useEffect, useState } from 'react';
import { Button } from './Button';

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
    <Button
      variant={copied ? 'secondary' : 'primary'}
      icon={copied ? 'check' : 'copy'}
      onClick={() => void copy()}
    >
      {copied ? 'Link copiado' : 'Copiar link'}
    </Button>
  );
}
