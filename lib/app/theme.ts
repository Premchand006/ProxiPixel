/**
 * Color theme preference. With nothing stored, <html> gets no data-theme and
 * globals.css follows prefers-color-scheme. Once the user toggles, "light" or
 * "dark" is stored and pinned via <html data-theme>.
 */
export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

/**
 * Runs in <head> before first paint (app/layout.tsx) so a stored theme never
 * flashes the OS default. Only known values are applied.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
