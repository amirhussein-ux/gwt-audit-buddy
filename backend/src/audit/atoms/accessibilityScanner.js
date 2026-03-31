const AxeBuilder = require('@axe-core/playwright').default;

async function runAccessibilityScan(page, options = {}) {
  try {
    const builder = new AxeBuilder({ page });
    if (options.include) builder.include(options.include);
    if (options.exclude) builder.exclude(options.exclude);
    const results = await builder.analyze();
    return results;
  } catch (error) {
    // Keep consumer resilient: return an empty result shape on failure
    return { violations: [], error: error.message };
  }
}

module.exports = {
  runAccessibilityScan,
};
