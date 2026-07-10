"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";

// Shared by Invoices and Delivery Log's filter bars (issue #40) — both
// previously copy-pasted an identical pair of native <input type="date">
// (from/to) with the exact same field names and styling. `from`/`to` stay
// plain "YYYY-MM-DD" strings on the wire (matches useTableFilters'
// URLSearchParams shape and search-params.ts's parseDateStart/parseDateEnd,
// which both call sites already depend on) — this component only converts
// to/from dayjs at its own boundary, nothing upstream needs to know dayjs
// exists.
const DATE_FORMAT = "YYYY-MM-DD";

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const value: [Dayjs | null, Dayjs | null] = [from ? dayjs(from, DATE_FORMAT) : null, to ? dayjs(to, DATE_FORMAT) : null];

  return (
    <DatePicker.RangePicker
      value={value}
      onChange={(dates) => {
        onChange({
          from: dates?.[0] ? dates[0].format(DATE_FORMAT) : "",
          to: dates?.[1] ? dates[1].format(DATE_FORMAT) : "",
        });
      }}
      allowEmpty={[true, true]}
      className="rounded-md!"
    />
  );
}
