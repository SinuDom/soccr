import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { DrillTimers } from '@/components/DrillTimer';

afterEach(cleanup);

/**
 * Repeating a drill must keep ADDING practice time: each completed run stays
 * credited and a rerun contributes again (this was the bug — the contribution
 * froze at one duration after the first finish).
 */
describe('DrillTimers — repeated runs', () => {
  function mount(props: { seconds: number; finishedIndices?: number[] }) {
    const elapsed: number[] = [];
    render(
      <DrillTimers
        seconds={props.seconds}
        finishedIndices={props.finishedIndices}
        onElapsedChange={(ms) => elapsed.push(ms)}
      />,
    );
    return { last: () => elapsed[elapsed.length - 1] ?? 0 };
  }

  it('a rerun after finishing adds a second full duration', async () => {
    const { last } = mount({ seconds: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Start drill' }));
    await waitFor(() => expect(last()).toBe(1000), { timeout: 3000 });

    // First run credited; now run it again — the credit must GROW past 1000.
    fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    await waitFor(() => expect(last()).toBe(2000), { timeout: 3000 });
  });

  it('a preCounted timer (finished earlier today) contributes its rerun on top of the baseline', async () => {
    const { last } = mount({ seconds: 1, finishedIndices: [0] });

    // Starts done and contributes 0 (its first run is in the session baseline).
    expect(last()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    await waitFor(() => expect(last()).toBe(1000), { timeout: 3000 });
  });

  it('resetting a paused rerun keeps completed runs credited', async () => {
    const { last } = mount({ seconds: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Start drill' }));
    await waitFor(() => expect(last()).toBe(1000), { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    await waitFor(() => expect(last()).toBeGreaterThan(1000), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    // The partial rerun is subtracted; the completed first run stays.
    await waitFor(() => expect(last()).toBe(1000), { timeout: 3000 });
  });
});
