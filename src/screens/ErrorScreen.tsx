import { Button } from '@/components/Button';
import type { ContentError } from '@/lib/content/types';

interface Props {
  error: ContentError;
  onRetry: () => void;
}

export function ErrorScreen({ error, onRetry }: Props) {
  const headline = {
    network: "Couldn't reach content file",
    parse: 'Content file has a typo',
    schema: "Content file doesn't match the expected shape",
  }[error.kind];

  const hint = {
    network: 'Check your connection, then try again.',
    parse: 'Open public/content.json on GitHub and look for a stray comma or missing quote.',
    schema: 'Compare your public/content.json against the README example.',
  }[error.kind];

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">⚠︎</div>
        <h1 className="text-2xl font-black mb-2">{headline}</h1>
        <p className="text-slate-500 mb-4">{hint}</p>
        <pre className="text-left text-xs bg-slate-100 border border-slate-200 rounded-xl p-3 mb-6 overflow-x-auto">
          {error.message}
        </pre>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}
