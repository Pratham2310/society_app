export interface VehicleData {
  id: string;
  type: 'car' | 'bike';
  number: string;
  slot: string;
  model?: string;
}

export interface Member {
  id: string;
  name: string;
  unit: string;
  role: string;
  status: string;
  avatar: string;
  mobile: string;
  email: string;
  memberSince: string;
  verified: boolean;
  occupancyType: string;
  totalMembers: number;
  parkingSlots: string[];
  vehicles: {
    type: 'car' | 'bike';
    model: string;
    slot: string;
    number: string;
  }[];
}
