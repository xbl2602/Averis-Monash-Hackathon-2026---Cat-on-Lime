"use client";

import Link from "next/link";
import { CountUp } from "../../_components/motion/count-up";
import { spotlightProps } from "../../_components/motion/use-spotlight";
import { Icon, type IconName } from "../../_components/icon";

/** One headline number. The whole tile links to the filtered list behind it. */
export function KpiTile({
  href,
  icon,
  label,
  value,
  note,
  color,
  index,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: number;
  note: string;
  color: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      {...spotlightProps()}
      style={{ "--i": index } as React.CSSProperties}
      className="card card-hover spot animate-pop stagger group p-5"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ background: color }}>
          <Icon name={icon} size={24} />
        </span>
        <Icon name="arrowRight" size={18} className="text-fg-faint opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
      </div>
      <div className="mt-4 text-3xl font-extrabold sm:text-4xl">
        <CountUp value={value} />
      </div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-xs text-fg-faint">{note}</div>
    </Link>
  );
}
