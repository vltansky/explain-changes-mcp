export type Action = {
  label: string;
  prompt: string;
};

export type Annotation = {
  file: string;
  line?: number;
  explanation: string;
  actions?: Action[];
};

export type DiffExplanation = {
  title: string;
  summary?: string;
  diff: string;
  annotations: Annotation[];
  editor?: "vscode" | "cursor";
  workspacePath?: string;
  timestamp: number;
};
