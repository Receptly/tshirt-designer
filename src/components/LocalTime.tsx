"use client";

import { startTransition, useEffect, useState } from "react";

const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Formats in the viewer's timezone after mount so server and client markup never disagree.
export default function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => { startTransition(() => setText(format.format(new Date(iso)))); }, [iso]);
  return <time dateTime={iso}>{text || "\u00a0"}</time>;
}
