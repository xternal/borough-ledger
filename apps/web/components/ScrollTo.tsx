"use client";

import { useEffect } from "react";

/** Opens a shared link at its section, as a #fragment would. */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView();
  }, [id]);
  return null;
}
