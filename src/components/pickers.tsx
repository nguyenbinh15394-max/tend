import { Small, Chip, Row } from '@/components/kit';
import { isoDay, nextDays, shortDay } from '@/lib/dates';
import type { Member } from '@/lib/types';

/** Pick one of the next `count` days (yyyy-mm-dd). */
export function DayPicker({
  value,
  onChange,
  count = 14,
}: {
  value: string | null;
  onChange: (day: string) => void;
  count?: number;
}) {
  return (
    <Row>
      {nextDays(count).map((d) => {
        const day = isoDay(d);
        return <Chip key={day} label={shortDay(d)} selected={value === day} onPress={() => onChange(day)} />;
      })}
    </Row>
  );
}

/** Pick a member, e.g. who owns a supply or who drives. */
export function MemberPicker({
  members,
  value,
  onChange,
  emptyLabel,
  note,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  emptyLabel?: string;
  note?: string;
}) {
  return (
    <>
      <Row>
        {emptyLabel ? <Chip label={emptyLabel} selected={value === null} onPress={() => onChange(null)} /> : null}
        {members.map((m) => (
          <Chip key={m.id} label={m.display_name} selected={value === m.id} onPress={() => onChange(m.id)} />
        ))}
      </Row>
      {note ? <Small>{note}</Small> : null}
    </>
  );
}

/** Pick a number from a fixed list, e.g. a delivery cycle in days. */
export function NumberPicker({
  options,
  value,
  onChange,
  suffix,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <Row>
      {options.map((n) => (
        <Chip key={n} label={`${n} ${suffix}`} selected={value === n} onPress={() => onChange(n)} />
      ))}
    </Row>
  );
}
