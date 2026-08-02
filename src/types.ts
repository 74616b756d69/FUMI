/**
 * ハガキデータ型定義
 */

export interface PostcardData {
  id: string;
  companyName: string;
  personName?: string;
  furigana?: string;
  address: string;
  postalCode?: string;
  phone?: string;
  memo?: string;
  createdAt: number;
  geocodingStatus?: 'pending' | 'verified' | 'failed';
}

export interface PostcardTemplate {
  id: string;
  name: string;
  layout: 'vertical' | 'horizontal';
  backgroundColor: string;
  textColor: string;
}

export interface SenderInfo {
  companyName: string;
  personName: string;
  postalCode: string;
  address: string;
  phone: string;
}

export interface CalibrationSettings {
  offsetX: number;
  offsetY: number;
}

export interface AppState {
  postcards: PostcardData[];
  template: PostcardTemplate;
  selectedIds: Set<string>;
  isLoading: boolean;
  currentPage: number;
  pageSize: number;
  filterQuery: string;
  showForm: boolean;
  editingId?: string;
  currentView: 'list' | 'preview';
  showSenderForm: boolean;
  senderInfo: SenderInfo;
  showCalibration: boolean;
  calibration: CalibrationSettings;
}
