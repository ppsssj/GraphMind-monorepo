const mediapipeTasksVisionPattern =
  /[\\/]@mediapipe[\\/]tasks-vision[\\/]/;

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const oneOfRule = webpackConfig.module.rules.find((rule) =>
        Array.isArray(rule.oneOf)
      );

      if (!oneOfRule) return webpackConfig;

      for (const rule of oneOfRule.oneOf) {
        if (!rule.enforce || rule.enforce !== "pre") continue;
        if (!Array.isArray(rule.use)) continue;

        const usesSourceMapLoader = rule.use.some((useEntry) => {
          const loaderName =
            typeof useEntry === "string" ? useEntry : useEntry?.loader;
          return typeof loaderName === "string" && loaderName.includes("source-map-loader");
        });

        if (!usesSourceMapLoader) continue;

        const currentExclude = rule.exclude;
        if (!currentExclude) {
          rule.exclude = [mediapipeTasksVisionPattern];
          continue;
        }

        rule.exclude = Array.isArray(currentExclude)
          ? [...currentExclude, mediapipeTasksVisionPattern]
          : [currentExclude, mediapipeTasksVisionPattern];
      }

      return webpackConfig;
    },
  },
};
