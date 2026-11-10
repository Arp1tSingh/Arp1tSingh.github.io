declare global {
  interface Window {
    /** Set once the app has booted, so the inline fallback can stand down. */
    __local3dBooted?: boolean;
    /** Handle of the inline safety timer that restores the static page. */
    __local3dFallback?: number;
  }
}

export {};
