export interface Visitor {
  id: string;
  name: string;
  image: string;
  status: 'at-gate' | 'entered' | 'expected';
  type: 'delivery' | 'guest' | 'staff';
  time?: string;
  vehicle?: string;
  purpose?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  status: 'entered' | 'expected';
  time: string;
  icon: string;
  houses?: string;
  leaves?: string;
}

export type SecurityStatus = 'home' | 'dnd' | 'away';
export type FeedbackType = 'status-updated' | 'entry-approved' | 'entry-rejected' | 'fraud-reported';