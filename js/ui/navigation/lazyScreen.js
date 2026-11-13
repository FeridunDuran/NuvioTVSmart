// Keep route identity stable while deferring a large screen's module setup.
// esbuild preserves one shared module graph even in the legacy IIFE package.
export function createLazyScreen(load, exportName) {
  let pending = null;
  let generation = 0;
  const screen = {
    async mount(...args) {
      const token = ++generation;
      if (!pending)
        pending = Promise.resolve()
          .then(load)
          .catch((error) => {
            pending = null;
            throw error;
          });
      const module = await pending;
      if (token !== generation) return;
      const implementation = module[exportName];
      if (!implementation || typeof implementation.mount !== "function")
        throw new Error(`Invalid lazy screen: ${exportName}`);
      Object.assign(screen, implementation);
      return implementation.mount.apply(screen, args);
    },
    cleanup() {
      generation++;
    }
  };
  return screen;
}
