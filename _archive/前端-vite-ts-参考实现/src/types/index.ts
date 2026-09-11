// 太初 H5 · 类型定义（与 docs/standards/03-接口与数据字典.md 对齐）

export interface UserInfo {
  userId: number;
  username: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CaseInput {
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour?: number;
  gender: 'male' | 'female';
  birthplace?: string;
  longitude?: number;
  latitude?: number;
  true_solar_time?: boolean;
  question: string;
}

export interface CaseInfo {
  caseId: string;
  status: string;
  currentStage: number;
}

export interface ChartSummary {
  caseId: string;
  degradedMethods: string[];
}

export interface JobInfo {
  jobId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  completed: number;
  total: number;
  result?: any;
  error?: string;
}

export interface CalibrationProposition {
  method: string;
  domain: string;
  claim: string;
  year_range?: string;
  confidence_level: 'high' | 'medium' | 'low' | 'speculative';
}

export interface CalibrationFeedback {
  method: string;
  domain: string;
  claim: string;
  feedback: 'confirmed' | 'denied' | 'corrected';
  user_note?: string;
}

export interface PredictionResult {
  report: {
    summary: string;
    trend: '吉' | '凶' | '平';
    details: TrendCard[];
    disclaimer: string;
  };
}

export interface TrendCard {
  title: string;
  direction: '吉' | '凶' | '平';
  description: string;
  confidence: string;
}

export interface ArchiveData {
  caseId: string;
  input: CaseInput;
  chart: any;
  calibrations: any;
  report: any;
  conversations: ConversationTurn[];
}

export interface ConversationTurn {
  turn: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
