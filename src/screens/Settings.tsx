import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContentStore } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { exportToBlob, parseImportedText } from '@/lib/storage/portability';

export function Settings() {
  const content = useContentStore((s) => s.content);
  const refetchContent = useContentStore((s) => s.refetch);
  const progress = useProgressStore((s) => s.progress);
  const corrupted = useProgressStore((s) => s.corrupted);
  const replace = useProgressStore((s) => s.replace);
  const merge = useProgressStore((s) => s.merge);
  const reset = useProgressStore((s) => s.reset);

  const [confirmReset, setConfirmReset] = useState(false);
  const [importDialog, setImportDialog] = useState<{ text: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const { blob, filename } = exportToBlob(progress);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleFilePicked(file: File) {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const r = parseImportedText(text);
      if (!r.ok) { setImportError(r.error); return; }
      setImportDialog({ text });
    };
    reader.onerror = () => setImportError('Could not read the file.');
    reader.readAsText(file);
  }

  function commitImport(kind: 'replace' | 'merge') {
    if (!importDialog) return;
    const r = parseImportedText(importDialog.text);
    if (!r.ok) { setImportError(r.error); setImportDialog(null); return; }
    if (kind === 'replace') replace(r.progress);
    else merge(r.progress, content?.settings.maxFreezesHeld ?? 1);
    setImportDialog(null);
  }

  return (
    <div className="min-h-dvh max-w-xl mx-auto p-5 pt-8 w-full">
      <header className="mb-6">
        <Link to="/" className="text-white/60 text-sm">← Home</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">Settings</h1>
      </header>

      {corrupted && (
        <div className="rounded-2xl p-4 mb-4 bg-red-500/10 border border-red-500/40 text-red-200 text-sm">
          Your saved progress couldn't be read. Import a backup below to restore it, or reset to start fresh.
        </div>
      )}

      <Section title="Content settings (from content.json)">
        {content ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <SettingRow label="Session target" value={`${content.settings.sessionTargetMinutes} min`} />
            <SettingRow label="Points / extra minute" value={content.settings.pointsPerExtraMinute} />
            <SettingRow label="Freeze cost" value={`${content.settings.freezeCostPoints} pts`} />
            <SettingRow label="Max freezes held" value={content.settings.maxFreezesHeld} />
            <SettingRow label="Recycle library" value={String(content.settings.recycleWhenLibraryExhausted)} />
          </dl>
        ) : (
          <p className="text-white/60 text-sm">Content not loaded.</p>
        )}
        <p className="text-white/50 text-xs mt-3">
          Edit these by opening <code className="rounded bg-black/40 px-1">public/content.json</code> on GitHub.
        </p>
        <div className="mt-3">
          <Button variant="ghost" size="md" onClick={() => void refetchContent()}>Re-fetch content.json</Button>
        </div>
      </Section>

      <Section title="Progress backup">
        <div className="flex flex-col gap-3">
          <Button variant="secondary" size="lg" onClick={handleExport}>Export progress (.json)</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ''; }}
          />
          <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>Import progress…</Button>
          {importError && <div className="text-sm text-red-300">{importError}</div>}
        </div>
        <p className="text-white/50 text-xs mt-3">
          This is your only cross-device sync. Export on one phone, import on another.
        </p>
      </Section>

      <Section title="Danger zone">
        <Button variant="danger" size="lg" onClick={() => setConfirmReset(true)}>Reset progress…</Button>
      </Section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { reset(); setConfirmReset(false); }}>Reset everything</Button>
          </>
        }
      >
        This wipes your streak, points, freezes, and history. Consider exporting first.
      </Modal>

      <Modal
        open={!!importDialog}
        onClose={() => setImportDialog(null)}
        title="Import progress"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportDialog(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => commitImport('merge')}>Merge</Button>
            <Button variant="primary" onClick={() => commitImport('replace')}>Replace</Button>
          </>
        }
      >
        <p><strong>Merge</strong> keeps the higher streak, points, and longest streak from either side and unions your seen-videos.</p>
        <p className="mt-2"><strong>Replace</strong> overwrites the current progress with the imported file exactly.</p>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-ink-800 border border-ink-700 p-5 mb-4">
      <h2 className="text-sm uppercase tracking-widest text-white/60 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function SettingRow({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <dt className="text-white/60">{label}</dt>
      <dd className="text-right tabular font-semibold">{value}</dd>
    </>
  );
}
