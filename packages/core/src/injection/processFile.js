import path from "path";

import readFile from "../utils/readFile";

const debug = require("debug")("phenomic:core:injection");

const defaultTransformPlugin: PhenomicPlugin = {
  name: "@phenomic/plugin-default-transform",
  supportedFileTypes: [],
  transform({ contents }) {
    return {
      partial: {},
      data: {
        body: contents
      }
    };
  }
};

async function processFile({
  db,
  file,
  transformers,
  collectors
}: {|
  db: PhenomicDB,
  file: PhenomicContentFile,
  transformers: PhenomicPlugins,
  collectors: PhenomicPlugins,
  isProduction?: boolean
|}) {
  debug(`processing ${file.name}`);
  const contents = await readFile(file.fullpath);
  const transformPlugin = transformers.find(
    (plugin: PhenomicPlugin) =>
      Array.isArray(plugin.supportedFileTypes) &&
      plugin.supportedFileTypes.indexOf(path.extname(file.name).slice(1)) !== -1
  );
  const plugin = transformPlugin || defaultTransformPlugin;
  if (typeof plugin.transform !== "function") {
    throw new Error("transform plugin must implement a transform() method");
  }
  const parsed: PhenomicTransformResult = await plugin.transform({
    file,
    contents
  });

  debug(`${file.name} processed`);
  // Don't show drafts in production
  if (process.env.NODE_ENV === "production" && parsed.data.draft) {
    debug(`${file.name} skipped because it's a draft`);
    return;
  }

  return collectors.forEach((plugin: PhenomicPlugin) => {
    if (typeof plugin.collectFile === "function")
      plugin.collectFile({ db, fileName: file.name, parsed });
  });
}

export default processFile;
