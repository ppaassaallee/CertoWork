/** Session undo stack for cell edits (last 20). */
export type CellEdit = {
  recordId: string;
  columnId: string;
  from: unknown;
  to: unknown;
};

export class UndoStack {
  private stack: CellEdit[] = [];
  private max = 20;

  push(edit: CellEdit) {
    this.stack.push(edit);
    if (this.stack.length > this.max) this.stack.shift();
  }

  pop(): CellEdit | null {
    return this.stack.pop() || null;
  }

  get size() {
    return this.stack.length;
  }
}

export const TABLES_LIMITS = {
  clientFilterMax: 5000,
  pagePerGroup: 500,
  computeFanOut: 500,
  aiEvalsPerTableDay: 500,
  formRatePerMinIp: 60,
  importMaxRows: 50000,
  importChunk: 400,
  trashDays: 30,
  undoDepth: 20,
} as const;
