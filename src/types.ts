/**
 * ハガキデータ型定義
 */

export interface PostcardData {
  id: string;
  name: string;
  address: string;
  message: string;
  postalCode?: string;
  phone?: string;
}

export interface PostcardTemplate {
  id: string;
  name: string;
  layout: 'vertical' | 'horizontal';
  backgroundColor: string;
  textColor: string;
}

export interface AppState {
  postcards: PostcardData[];
  template: PostcardTemplate;
  selectedIds: Set<string>;
  isLoading: boolean;
}
