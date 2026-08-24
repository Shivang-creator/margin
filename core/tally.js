const EMPTY_SURFACE = { written: 0, grounded: 0, struck: 0 };

function emptyTally() {
  return { written: 0, grounded: 0, struck: 0, bySurface: {} };
}

// Pure reducer: reduceTally(tally, counts, surface) -> new tally. Never mutates
// its inputs, so the same (tally, counts, surface) always yields the same result.
export function reduceTally(tally, counts, surface) {
  const base = tally ?? emptyTally();
  const prevSurface = base.bySurface[surface] ?? EMPTY_SURFACE;

  const nextSurface = {
    written: prevSurface.written + counts.written,
    grounded: prevSurface.grounded + counts.grounded,
    struck: prevSurface.struck + counts.struck,
  };

  return {
    written: base.written + counts.written,
    grounded: base.grounded + counts.grounded,
    struck: base.struck + counts.struck,
    bySurface: { ...base.bySurface, [surface]: nextSurface },
  };
}
