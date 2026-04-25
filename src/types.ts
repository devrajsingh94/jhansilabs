export type BookingType = 'home' | 'lab';
export type BookingStatus = 'pending' | 'sample-collected' | 'in-lab' | 'completed' | 'cancelled';

export interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  description: string;
  preparation?: string;
  duration?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  specialization: string;
  experience: string;
  image: string;
}

export interface LabLocation {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMain?: boolean;
  image: string;
  mapUrl?: string;
}

export interface HealthPackage {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  testsIncluded: string[];
  image: string;
  tag?: string;
  label?: string;
  color?: string;
}

export interface PatientTest {
  id: string;
  patientId: string;
  testName: string;
  date: string;
  status: 'Pending' | 'Completed';
  reportUrl?: string;
  progress?: 'Sample Collected' | 'In Lab' | 'Result Pending';
}

export interface Booking {
  id: string;
  userId: string;
  tests: LabTest[];
  type: BookingType;
  date: string;
  time: string;
  address?: string;
  status: BookingStatus;
  createdAt: number;
  totalAmount: number;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  location: string;
  doctorReference?: string;
  referralCode?: string;
  reportUrl?: string;
  prescriptionUrl?: string;
  collectionTime?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  address?: string;
}
