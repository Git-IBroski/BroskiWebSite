/**
 * Demon Tier Tracker — presentational tier list view (React).
 *
 * A pure, data-in/markup-out component: it takes an already grouped and ordered
 * {@link GroupedTierList} (produced by {@link groupByTier}) and renders it. It
 * performs NO data fetching — that is the container's job ({@link DemonTierListPage}) —
 * which keeps the render branches (empty states, the 100% indicator, the
 * indicator-fallback omission) directly testable from props (task 6.7).
 *
 * Rendering behavior (per design "Tier List Display"):
 * - Tier groups are rendered in the order they appear in the input, which
 *   {@link groupByTier} guarantees is highest difficulty → lowest (Req 9.1).
 * - Each demon lists its player records in the given order — percentage desc,
 *   ties by username asc — showing each player with an integer percentage 0..100
 *   (Req 9.3, 9.5).
 * - A completion at exactly 100% renders a distinct visual indicator that is not
 *   applied to sub-100% completions (Req 9.6).
 * - If the 100% indicator cannot be applied to a record, that record is omitted
 *   rather than shown without its indicator (Req 9.7).
 * - When there are no demons at all, an empty-state message is shown (Req 9.2).
 * - When a demon has no displayable records, a per-demon "no records" indication
 *   is shown instead of an empty list (Req 9.4).
 *
 * _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
 */
import React from 'react';
import type {
  DifficultyTier,
  DemonGroup,
  GroupedTierList,
  PlayerRecord,
} from './ordering';

/** The percentage value that qualifies for the 100% completion indicator. */
const HUNDRED_PERCENT = 100;

/**
 * Predicate deciding whether the 100% visual indicator can be applied to a
 * record. Defaults to always-applicable: the indicator is a static badge that
 * can always be rendered in practice. It is injectable so the indicator-fallback
 * branch (Req 9.7) is testable, and so a future runtime capability check can be
 * supplied without changing the component.
 */
export type CanRenderIndicator = (record: PlayerRecord) => boolean;

/** Default indicator capability: the badge can always be rendered. */
export const defaultCanRenderIndicator: CanRenderIndicator = () => true;

/**
 * Human-readable label for each difficulty tier, shown as the group heading.
 */
const TIER_LABELS: Record<DifficultyTier, string> = {
  extreme: 'Extreme',
  insane: 'Insane',
  hard: 'Hard',
  medium: 'Medium',
  easy: 'Easy',
};

/**
 * Accent color classes per tier so higher tiers read as more intense. Used for
 * the tier heading badge.
 */
const TIER_ACCENT: Record<DifficultyTier, string> = {
  extreme: 'bg-red-500/20 text-red-300',
  insane: 'bg-orange-500/20 text-orange-300',
  hard: 'bg-amber-500/20 text-amber-300',
  medium: 'bg-sky-500/20 text-sky-300',
  easy: 'bg-emerald-500/20 text-emerald-300',
};

/**
 * Whether a record is a full (100%) completion.
 */
export function isHundredPercent(record: PlayerRecord): boolean {
  return record.percentage === HUNDRED_PERCENT;
}

/**
 * Filter a demon's records to those that are displayable.
 *
 * Records below 100% are always displayable. A 100% record is displayable only
 * if the 100% indicator can be applied to it; otherwise it is omitted so it is
 * never shown without its indicator (Req 9.7). The input order is preserved.
 */
export function displayableRecords(
  records: readonly PlayerRecord[],
  canRenderIndicator: CanRenderIndicator,
): PlayerRecord[] {
  return records.filter(
    (record) => !isHundredPercent(record) || canRenderIndicator(record),
  );
}

/**
 * Props for {@link DemonTierListView}.
 */
export interface DemonTierListViewProps {
  /** The grouped, ordered tier list to render (from {@link groupByTier}). */
  groups: GroupedTierList;
  /**
   * Predicate controlling whether the 100% indicator can be applied to a given
   * record. Defaults to {@link defaultCanRenderIndicator} (always applicable).
   */
  canRenderIndicator?: CanRenderIndicator;
}

/**
 * The 100% completion indicator badge (Req 9.6). Rendered only for full
 * completions; sub-100% records render a plain percentage instead.
 */
const HundredPercentBadge: React.FC = () => (
  <span
    data-testid="hundred-indicator"
    aria-label="100% completion"
    title="Full completion (100%)"
    className="inline-flex items-center gap-1 rounded-md border-[2px] border-black bg-tertiary px-2 py-0.5 font-label-caps text-[10px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
  >
    <span className="material-symbols-outlined text-[14px]">verified</span>
    100%
  </span>
);

/**
 * Renders a single demon with its ordered records, or a per-demon "no records"
 * indication when it has no displayable records (Req 9.4).
 */
const DemonCard: React.FC<{
  demon: DemonGroup;
  canRenderIndicator: CanRenderIndicator;
}> = ({ demon, canRenderIndicator }) => {
  const records = displayableRecords(demon.records, canRenderIndicator);

  return (
    <div className="rounded-2xl border-[3px] border-black bg-surface-container p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="truncate font-headline-md text-[18px] text-white">
          {demon.demon_name}
        </h3>
        <span className="shrink-0 font-body-sm text-[12px] text-on-surface-variant">
          #{demon.level_id}
        </span>
      </div>

      {records.length === 0 ? (
        <p
          data-testid="demon-no-records"
          className="flex items-center gap-2 font-body-sm text-[14px] text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[18px]">do_not_disturb_on</span>
          No records yet
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {records.map((record, index) => (
            <li
              key={`${record.username}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-high px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-right font-label-caps text-[11px] text-on-surface-variant">
                  {index + 1}
                </span>
                <span className="truncate font-body-sm text-[14px] text-white">
                  {record.username}
                </span>
              </span>
              {isHundredPercent(record) ? (
                <HundredPercentBadge />
              ) : (
                <span className="shrink-0 font-headline-md text-[14px] text-on-surface-variant">
                  {record.percentage}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Presentational tier list. Renders the no-demons empty state (Req 9.2) when
 * `groups` is empty, otherwise renders each tier group highest→lowest with its
 * demons and records.
 */
const DemonTierListView: React.FC<DemonTierListViewProps> = ({
  groups,
  canRenderIndicator = defaultCanRenderIndicator,
}) => {
  if (groups.length === 0) {
    return (
      <div
        data-testid="no-demons"
        className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 text-center shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]"
      >
        <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">
          inbox
        </span>
        <p className="font-headline-md text-[18px] text-white">No demons available</p>
        <p className="font-body-sm text-on-surface-variant">
          There are no demons to display yet. Check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.difficulty_tier}>
          <div className="mb-4 flex items-center gap-3">
            <span
              className={`rounded-lg border-[2px] border-black px-3 py-1 font-label-caps text-[12px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                TIER_ACCENT[group.difficulty_tier]
              }`}
            >
              {TIER_LABELS[group.difficulty_tier]}
            </span>
            <span className="font-body-sm text-[13px] text-on-surface-variant">
              {group.demons.length} demon{group.demons.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.demons.map((demon) => (
              <DemonCard
                key={demon.level_id}
                demon={demon}
                canRenderIndicator={canRenderIndicator}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DemonTierListView;
