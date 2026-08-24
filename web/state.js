// Store: notes, sessions[], tally, modelOff, lastGeneration{}. Storage is injected;
// defaults to localStorage when present (browser). Pure functions in, new state out.

const STORAGE_KEY = "margin:state:v1";

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

export function createInitialState() {
  return {
    v: 1,
    notes: "",
    notesSource: "sample",
    modelOff: false,
    reveal: false,
    activeTab: "explain",
    tally: { written: 0, grounded: 0, struck: 0, bySurface: {} },
    sessions: [],
    lastGeneration: { ask: {}, quiz: {} },
  };
}

export function loadState(storage = defaultStorage()) {
  if (!storage) return createInitialState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1) return { ...createInitialState(), ...parsed };
    return createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state, storage = defaultStorage()) {
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable or full — state still lives in memory for this session
    }
  }
  return state;
}

export function setNotes(state, notes, notesSource) {
  return { ...state, notes, notesSource };
}

export function setModelOff(state, modelOff) {
  return { ...state, modelOff };
}

export function setReveal(state, reveal) {
  return { ...state, reveal };
}

export function setActiveTab(state, activeTab) {
  return { ...state, activeTab };
}

export function setTally(state, tally) {
  return { ...state, tally };
}

export function recordSession(state, session) {
  return { ...state, sessions: [...state.sessions, session] };
}

export function setLastGeneration(state, action, generation) {
  return {
    ...state,
    lastGeneration: { ...state.lastGeneration, [action]: generation },
  };
}
