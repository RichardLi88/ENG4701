import type { JsonRootType } from "../../_helpers/json";
import type { jsonFileUploadContent } from "../content";

export type IdleState = { status: "idle" };

export type LoadedState = {
  status: "loaded";
  fileName: string;
  size: number;
  topLevelType: JsonRootType;
};

export type ErrorState = {
  status: "error";
  code: keyof typeof jsonFileUploadContent.errors;
};

export type UploadState = IdleState | LoadedState | ErrorState;
