import type { AuditFields, Paginated, UUID } from '../common.js';
import type {
  ExpenseStatus,
  PaymentMode,
  RentBasis,
  RentPaymentSource,
  RentPaymentStatus,
  RentalStatus,
} from '../enums.js';
import type { DateOnlyString, MoneyString, NamedRef, PersonRef } from './petty-cash.dto.js';

/**
 * Transport contracts — vehicles hired for a site and the rent paid for them.
 *
 *   rent due = (PER_DAY: rate × days · FIXED: rate) + extra charges
 *   pending  = rent due − payments counted
 *
 * A payment from petty cash is counted unless its expense was rejected.
 */

export interface RentPaymentDto extends AuditFields {
  id: UUID;
  paymentDate: DateOnlyString;
  amount: MoneyString;
  paymentMode: PaymentMode;
  source: RentPaymentSource;
  paidBy: PersonRef;
  referenceNo: string | null;
  notes: string | null;
  /** The petty cash expense behind a PETTY_CASH payment. */
  expense: { id: UUID; expenseNo: string; status: ExpenseStatus } | null;
  /** False when its petty cash expense was rejected. */
  counted: boolean;
  canEdit: boolean;
}

export interface VehicleRentalDto extends AuditFields {
  id: UUID;
  rentalNo: string;
  employee: PersonRef;
  site: NamedRef | null;
  vehicleType: string;
  vehicleNumber: string | null;
  vendorName: string;
  vendorMobile: string | null;
  driverName: string | null;
  driverMobile: string | null;
  fromDate: DateOnlyString;
  toDate: DateOnlyString | null;
  rentBasis: RentBasis;
  rate: MoneyString;
  extraCharges: MoneyString;
  notes: string | null;
  /** Days on rent — counted to today while the vehicle is still out. */
  days: number;
  rentDue: MoneyString;
  paidAmount: MoneyString;
  /** Negative when more has been paid than is due (an advance). */
  pendingAmount: MoneyString;
  paymentStatus: RentPaymentStatus;
  rentalStatus: RentalStatus;
  paymentCount: number;
  canEdit: boolean;
  /** Populated on the detail endpoint only. */
  payments?: RentPaymentDto[];
}

export interface VehicleRentalSummaryDto {
  count: number;
  onRent: number;
  rentDue: MoneyString;
  paid: MoneyString;
  /** Sum of what is still owed; advances do not offset other rentals' dues. */
  pending: MoneyString;
}

export interface VehicleRentalListDto extends Paginated<VehicleRentalDto> {
  /** Totals for the whole filtered set, not just the page. */
  summary: VehicleRentalSummaryDto;
}

export interface VehicleRentalRequest {
  /** Only honoured for callers with `transport:manage`; otherwise the caller. */
  employeeId?: UUID | null;
  siteId?: UUID | null;
  vehicleType: string;
  vehicleNumber?: string | null;
  vendorName: string;
  vendorMobile?: string | null;
  driverName?: string | null;
  driverMobile?: string | null;
  fromDate: DateOnlyString;
  toDate?: DateOnlyString | null;
  rentBasis: RentBasis;
  rate: MoneyString | number;
  extraCharges?: MoneyString | number | null;
  notes?: string | null;
}

export interface RentPaymentRequest {
  paymentDate: DateOnlyString;
  amount: MoneyString | number;
  paymentMode: PaymentMode;
  source: RentPaymentSource;
  /** Only honoured for callers with `transport:manage`; otherwise the caller. */
  paidById?: UUID | null;
  referenceNo?: string | null;
  notes?: string | null;
}

/** Earlier values, offered as suggestions while typing. */
export interface VehicleRentalSuggestionsDto {
  vehicleTypes: string[];
  vendors: { name: string; mobile: string | null }[];
}
