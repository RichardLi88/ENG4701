import type { jsonFileUploadContent } from "../content";

export type IdleState = { status: "idle" };

export type ErrorState = {
  status: "error";
  code: keyof typeof jsonFileUploadContent.errors;
  detail?: string;
};

export type UploadState = IdleState | ErrorState;
