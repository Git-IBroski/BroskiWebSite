/**
 * Example & edge-case unit tests for the Tier_List_Site render branches
 * (task 6.7).
 *
 * These exercise the three site branches called out by the design's "Example &
 * Edge-Case Unit Tests" section:
 *   - No-demons empty state (Req 9.2)
 *   - Per-demon no-records state (Req 9.4)
 *   - Indicator-fallback omission (Req 9.7)
 *
 * @testing-library/react + jsdom are NOT part of this repo's toolchain, so
 * rather than pull in heavy rendering deps these tests assert the exact branch
 * logic the presentational component uses, via the pure helpers it exports
 * (`isHundredPercent`, `displayableRecords`, `defaultCanRenderIndicator`) plus
 * the `groups.length === 0` / per-demon `displayableRecords(...).length === 0`
 * decisions that select each rendered branch. Testing the helpers the component
 * actually calls keeps these tests faithful to the rendered output without a
 * DOM.
 *
 * _Requirements: 9.2, 9.4, 9.7_
 */
import { describe, it, expect } from 'vitest';
import {
  isHundredPercent,
  displayableRecords,
  defaultCanRenderIndicator,
  type CanRenderIndicator,
} from './DemonTierListView';
import { groupByTier, type GroupedTierList, type PlayerRecord } from './ordering';

/** A record below 100% (always displayable). */
const partial = (username: string, percentage: number): PlayerRecord => ({
  username,
  percentage,
  updated_at: '2024-01-01T00:00:00.000Z',
});

/** A full (100%) completion record. */
const full = (username: string): PlayerRecord => ({
  username,
  percentage: 100,
  updated_at: '2024-01-01T00:00:00.000Z',
});

/**
 * The no-demons branch is selected by `groups.length === 0`; this mirrors the
 * component's guard that renders the `data-testid="no-demons"` empty state.
 */
function showsNoDemonsEmptyState(groups: GroupedTierList): boolean {
  return groups.length === 0;
}

/**
 * The per-demon no-records branch is selected when a demon has no displayable
 * records; this mirrors the component's `records.length === 0` guard that
 * renders the `data-testid="demon-no-records"` indication.
 */
function showsDemonNoRecords(
  records: readonly PlayerRecord[],
  canRenderIndicator: CanRenderIndicator,
): boolean {
  return displayableRecords(records, canRenderIndicator).length === 0;
}

describe('Tier list — no-demons empty state (Req 9.2)', () => {
  it('selects the no-demons empty state when there are no demons', () => {
    const groups = groupByTier([]);
    expect(groups).toEqual([]);
    expect(showsNoDemonsEmptyState(groups)).toBe(true);
  });

  it('does NOT select the empty state when at least one demon exists', () => {
    const groups = groupByTier([
      {
        level_id: '128',
        demon_name: 'Theory of Everything 2',
        difficulty_tier: 'hard',
        username: 'alice',
        percentage: 87,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ]);
    expect(groups.length).toBeGreaterThan(0);
    expect(showsNoDemonsEmptyState(groups)).toBe(false);
  });
});

describe('Tier list — per-demon no-records state (Req 9.4)', () => {
  it('selects the no-records indication when a demon has zero records', () => {
    expect(showsDemonNoRecords([], defaultCanRenderIndicator)).toBe(true);
  });

  it('does NOT select the no-records indication when a demon has at least one displayable record', () => {
    expect(
      showsDemonNoRecords([partial('alice', 42)], defaultCanRenderIndicator),
    ).toBe(false);
  });

  it('selects the no-records indication when the only record is a 100% one whose indicator cannot render', () => {
    // The single 100% record is omitted by the fallback (Req 9.7), leaving the
    // demon with no displayable records, so the no-records branch is selected.
    const indicatorUnavailable: CanRenderIndicator = () => false;
    expect(showsDemonNoRecords([full('alice')], indicatorUnavailable)).toBe(true);
  });
});

describe('Tier list — indicator-fallback omission (Req 9.7)', () => {
  it('omits a 100% record when the indicator cannot be applied', () => {
    const indicatorUnavailable: CanRenderIndicator = () => false;
    const records = [partial('alice', 99), full('bob')];

    const shown = displayableRecords(records, indicatorUnavailable);

    // The 100% record (bob) is dropped; the sub-100% record (alice) remains.
    expect(shown).toEqual([partial('alice', 99)]);
    expect(shown.some((r) => isHundredPercent(r))).toBe(false);
  });

  it('keeps a 100% record when the indicator can be applied (default)', () => {
    const records = [partial('alice', 99), full('bob')];

    const shown = displayableRecords(records, defaultCanRenderIndicator);

    // With the default (always-applicable) indicator, nothing is omitted and
    // input order is preserved.
    expect(shown).toEqual(records);
    expect(shown.filter((r) => isHundredPercent(r))).toEqual([full('bob')]);
  });

  it('never omits sub-100% records regardless of indicator availability', () => {
    const indicatorUnavailable: CanRenderIndicator = () => false;
    const records = [partial('alice', 0), partial('bob', 50), partial('cara', 99)];

    expect(displayableRecords(records, indicatorUnavailable)).toEqual(records);
  });

  it('omits only the un-renderable 100% records, selectively', () => {
    // canRenderIndicator can depend on the record; only "bob" can render.
    const onlyBob: CanRenderIndicator = (r) => r.username === 'bob';
    const records = [full('alice'), full('bob'), partial('cara', 73)];

    const shown = displayableRecords(records, onlyBob);

    expect(shown).toEqual([full('bob'), partial('cara', 73)]);
  });
});
