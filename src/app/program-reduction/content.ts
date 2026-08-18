import { type JsonRootType } from "../_helpers/json";

export const programReductionContent = {
  eyebrow: "Program Reduction",
  heading: "Upload a reduction input",
  description:
    "Choose a local JSON file to prepare it for the program reduction workflow.",
} as const;

export const jsonFileUploadContent = {
  uploadButton: "Upload JSON file",
  idleMessage: "No file selected.",
  labels: {
    file: "File",
    size: "Size",
    jsonRoot: "JSON root",
  },
  errors: {
    invalidFileType: "Select a JSON file.",
    invalidJson: "The selected file is not valid JSON.",
  },
} as const;

export const units = {
  bytes: "bytes",
} as const;

export const jsonRootTypeLabels = {
  array: "array",
  null: "null",
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
} as const satisfies Record<JsonRootType, string>;
