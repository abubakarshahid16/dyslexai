export type Student = {
  id: number;
  name: string;
  grade_level?: string | null;
  notes?: string | null;
  created_at: string;
};

export type DashboardOverview = {
  total_students: number;
  total_uploads: number;
  total_runs: number;
  avg_confidence: number;
  avg_correction_ratio: number;
};

export type StudentProgress = {
  student_id: number;
  student_name: string;
  total_runs: number;
  avg_confidence: number;
  avg_correction_ratio: number;
};

export type HistoryItem = {
  run_id: number;
  student_id?: number | null;
  student_name?: string | null;
  created_at: string;
  corrected_text: string;
  avg_confidence: number;
  suspicious_lines: number;
  review_status?: string | null;
  reviewed_text?: string | null;
  original_image_path?: string | null;
  original_image_url?: string | null;
};

export type OCRLine = {
  bbox: number[];
  raw_text: string;
  merged_text?: string | null;
  corrected_text?: string | null;
  confidence: number;
  source: string;
  difficulty_tier?: string | null;
  difficulty_score?: number | null;
  fallback_used: boolean;
  suspicious: boolean;
  chosen_variant?: string | null;
  uncertainty_score: number;
  candidate_scores: Array<Record<string, unknown>>;
  edit_ops: Array<Record<string, unknown>>;
};

/** Exercise from dyslexia-backend (word_typing, sentence_typing, handwriting, tracing). */
export type Exercise = {
  id: string;
  type: "word_typing" | "sentence_typing" | "handwriting" | "tracing";
  content: string;
  expected: string;
  target_words: string[];
  difficulty: number;
  age_group: string;
  source: string;
};

/** Student from dyslexia-backend (UUID id). */
export type ExerciseStudent = {
  id: string;
  name: string;
  age?: number | null;
  difficulty_level: number;
  total_sessions: number;
  streak_days: number;
};

/** Handwriting submit response from dyslexia-backend. */
export type HandwritingSubmitResponse = {
  session_id: string;
  score: number;
  feedback: string;
  ocr_text: string;
  ocr_confidence: number;
  corrected_text?: string;
  char_errors?: unknown[];
  phonetic_score?: number;
  new_difficulty_level: number;
  words_updated: string[];
};

export type OCRRun = {
  run_id: number;
  upload_id: number;
  student_id?: number | null;
  corrected_text: string;
  metadata: Record<string, unknown>;
  original_image_path?: string | null;
  original_image_url?: string | null;
  annotated_image_path?: string | null;
  preprocessed_image_path?: string | null;
  correction_layer1?: string | null;
  correction_layer2?: string | null;
  correction_layer3?: string | null;
  correction_layer4?: string | null;
  lines: OCRLine[];
  triage?: Record<string, unknown>;
};
