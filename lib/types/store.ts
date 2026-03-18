export type Store = {
  id: string;
  name: string;
  // 기존 대시보드용 필드 (주소/매출 등)
  address?: string;
  revenue?: number | null;
  category?: string | null;
  // 지점장 연락처
  managerPhone?: string | null;
  // 공통 위치 정보
  lat: number;
  lng: number;
  // 지역 기반 대시보드용 필드
  region?: string;
  created_at: string;
};

export type StoreSalesSummary = {
  store: Store;
  totalQuantity: number;
};
