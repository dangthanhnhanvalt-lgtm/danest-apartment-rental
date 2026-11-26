export type Lang = "en" | "vi";

/** Flat dictionary: dotted keys → string. `{name}` placeholders are interpolated. */
export type Dict = Record<string, string>;
