/**
 * The product's measured accuracy, in one place so the landing page and the dashboard always agree.
 *
 * Where these come from: `npm run evaluate -- --no-write`, which runs all 520 of the organisers' sample emails
 * through the real pipeline and scores the result against their answer key. Re-measured on 2026-09-22 (see the
 * report below). When the engine changes, re-run it and update the numbers here. Do not round them up.
 *
 *   classification macro-F1 ......... 100.00%   (220 + 125 + 75 + 60 + 40 emails, no errors in any category)
 *   end to end exactly right ........ 520 / 520
 *   real discrepancies .............. TP=72  FP=0  FN=0   (P = R = F1 = 100%)
 *   uncertain cases, reason right ... 20 / 20   (NEEDS_REVIEW reason matched)
 *
 * The scope matters and is stated wherever these are shown: it is the sample set, not unseen mail.
 */
export const ACCURACY = {
  measuredOn: "22 Sep 2026",
  scope: "the organisers' 520 sample emails",
  emails: { right: 520, of: 520 },
  category: { percent: 100 },
  discrepancies: { found: 72, of: 72 },
  falseAlarms: 0,
  uncertain: { rightlyHandedOver: 20, of: 20 },
} as const;

export interface AccuracyStat {
  key: string;
  /** Number that counts up */
  value: number;
  /** Text after the number, e.g. "%" or " / 520" */
  suffix?: string;
  label: string;
  detail: string;
}

export const ACCURACY_STATS: AccuracyStat[] = [
  {
    key: "emails",
    value: ACCURACY.emails.right,
    suffix: ` / ${ACCURACY.emails.of}`,
    label: "emails judged exactly right",
    detail: "Category, outcome and mismatching fields all agree with the answer key.",
  },
  {
    key: "category",
    value: ACCURACY.category.percent,
    suffix: "%",
    label: "of emails put in the right category",
    detail: "Across all five: document check, SI request, invoice query, general and spam.",
  },
  {
    key: "found",
    value: ACCURACY.discrepancies.found,
    suffix: ` / ${ACCURACY.discrepancies.of}`,
    label: "real discrepancies found",
    detail: "Every genuine SI and BL mismatch was caught. None slipped through.",
  },
  {
    key: "false",
    value: ACCURACY.falseAlarms,
    label: "false alarms",
    detail: "Formatting quirks like case, commas and spacing were not flagged as errors.",
  },
];

/** The one sentence that keeps the numbers honest. */
export const ACCURACY_SCOPE_NOTE = `Scored against the answer key on ${ACCURACY.scope}, measured ${ACCURACY.measuredOn}. New mail can behave differently, which is exactly why anything uncertain goes to a person.`;

export const ACCURACY_HANDOVER = `${ACCURACY.uncertain.rightlyHandedOver} of ${ACCURACY.uncertain.of} uncertain cases were handed to a person for the right reason.`;
