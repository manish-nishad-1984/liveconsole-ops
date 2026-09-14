import type {
  RentPaymentRequest,
  VehicleRentalDto,
  VehicleRentalListDto,
  VehicleRentalRequest,
  VehicleRentalSuggestionsDto,
} from '@liveconsole-ops/types';

import { api, type QueryParams } from '@/lib/api-client';

/** Payment writes return the whole rental, with its totals recomputed. */
export const vehicleRentalsService = {
  list: (params: QueryParams) => api.get<VehicleRentalListDto>('/vehicle-rentals', params),
  getById: (id: string) => api.get<VehicleRentalDto>(`/vehicle-rentals/${id}`),
  suggestions: () => api.get<VehicleRentalSuggestionsDto>('/vehicle-rentals/suggestions'),
  create: (payload: VehicleRentalRequest) =>
    api.post<VehicleRentalDto>('/vehicle-rentals', payload),
  update: (id: string, payload: Partial<VehicleRentalRequest>) =>
    api.patch<VehicleRentalDto>(`/vehicle-rentals/${id}`, payload),
  remove: (id: string) => api.delete<VehicleRentalDto>(`/vehicle-rentals/${id}`),

  addPayment: (id: string, payload: RentPaymentRequest) =>
    api.post<VehicleRentalDto>(`/vehicle-rentals/${id}/payments`, payload),
  updatePayment: (id: string, paymentId: string, payload: Partial<RentPaymentRequest>) =>
    api.patch<VehicleRentalDto>(`/vehicle-rentals/${id}/payments/${paymentId}`, payload),
  removePayment: (id: string, paymentId: string) =>
    api.delete<VehicleRentalDto>(`/vehicle-rentals/${id}/payments/${paymentId}`),

  exportCsv: (params: QueryParams) => api.download('/vehicle-rentals/export', params),
};
