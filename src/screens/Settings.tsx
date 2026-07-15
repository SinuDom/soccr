import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContentStore, getUser } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { exportToBlob, parseImportedText } from '@/lib/storage/portability';

export function Settings() {
  const content = useContentStore((s) => s.content);
  const refetchContent = useContentStore((s) => s.refetch);
  const vault = useProgressStore((s) => s.vault);
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const corrupted = useProgressStore((s) => s.corrupted);
  const replaceVault = useProgressStore((s) => s.replaceVault);
  const mergeVault = useProgressStore((s) => s.mergeVault);
  const resetActiveUser = useProgressStore((s) => s.resetActiveUser);

  const activeUser = getUser(content, activeUserId);

  const [confirmReset, setConfirmReset] = useState(false);
  const [importDialog, setImportDialog] = useState<{ text: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const { blob, filename } = exportToBlob(vault);
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
    if (kind === 'replace') replaceVault(r.vault);
    else mergeVault(r.vault, content?.settings.maxFreezesHeld ?? 1);
    setImportDialog(null);
  }

  return (
    <div className="min-h-dvh max-w-xl lg:max-w-3xl mx-auto p-5 pt-8 w-full">
      <header className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          aria-label="Back home"
          className="grid place-items-center h-10 w-10 rounded-2xl text-white/70 hover:text-white hover:bg-ink-800 transition-colors"
        >
          <Icon name="arrow-left" size={20} />
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
      </header>

      {corrupted && (
        <div className="rounded-2xl p-4 mb-4 bg-red-500/10 border border-red-500/40 text-red-200 text-sm">
          Your saved progress couldn't be read. Import a backup below to restore it, or reset to start fresh.
        </div>
      )}

      <Section title="Users (from content.json)">
        {content && content.users.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {content.users.map((u) => {
              const p = vault.users[u.id];
              return (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  <span className={u.id === activeUserId ? 'font-bold text-white' : 'text-white/80'}>
                    {u.name}{u.id === activeUserId ? ' (active)' : ''}
                  </span>
                  <span className="text-white/50 tabular text-xs">
                    {u.videos.length} videos · streak {p?.currentStreak ?? 0} · {p?.points ?? 0} pts
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-white/60 text-sm">No users defined.</p>
        )}
        <p className="text-white/50 text-xs mt-3">
          Add or remove users under <code className="rounded bg-black/40 px-1">users</code> in
          <code className="mx-1 rounded bg-black/40 px-1">public/content.json</code>. Each user's progress is separate.
        </p>
      </Section>

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
        <div className="mt-3">
          <Button variant="ghost" size="md" icon="refresh" onClick={() => void refetchContent()}>Re-fetch content.json</Button>
        </div>
      </Section>

      <Section title="Backup (all users)">
        <div className="flex flex-col gap-3">
          <Button variant="secondary" size="lg" icon="download" onClick={handleExport}>Export vault (.json)</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ''; }}
          />
          <Button variant="secondary" size="lg" icon="upload" onClick={() => fileRef.current?.click()}>Import vault…</Button>
          {importError && <div className="text-sm text-red-300">{importError}</div>}
        </div>
        <p className="text-white/50 text-xs mt-3">
          One backup covers every user in the vault. Export on one device, import on another.
        </p>
      </Section>

      <Section title="Danger zone">
        <Button variant="danger" size="lg" icon="trash" onClick={() => setConfirmReset(true)}>
          Reset {activeUser?.name ?? 'active user'}'s progress…
        </Button>
      </Section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={`Reset ${activeUser?.name ?? 'active user'}'s progress?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { resetActiveUser(); setConfirmReset(false); }}>Reset</Button>
          </>
        }
      >
        This wipes the streak, points, freezes, and history for {activeUser?.name ?? 'this user'} only. Other users are untouched.
      </Modal>

      <Modal
        open={!!importDialog}
        onClose={() => setImportDialog(null)}
        title="Import backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportDialog(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => commitImport('merge')}>Merge</Button>
            <Button variant="primary" onClick={() => commitImport('replace')}>Replace</Button>
          </>
        }
      >
        <p><strong>Merge</strong> keeps, per user, the higher streak / points / longest streak and unions seen-videos + history.</p>
        <p className="mt-2"><strong>Replace</strong> overwrites the entire vault with the imported file.</p>
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
