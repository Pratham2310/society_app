import React, { createContext, useContext, useState } from 'react';

export interface VehicleEntry {
  type: 'car' | 'bike';
  number: string;
  parkingSlot: string;
}

interface RegistrationData {
  // Step 1 – identity
  name: string;
  email: string;
  password: string;
  phone: string;

  // Society key
  societyId: string;
  societyName: string;

  // Step 2 – onboarding
  wingId: string;
  flatNumber: string;
  occupancyType: 'owner' | 'tenant';
  livingType: 'family' | 'bachelor' | 'commercial';
  familySize: number;

  // Step 3 – vehicle
  vehicles: VehicleEntry[];

  // Step 4 – finalize
  agreedToTerms: boolean;
  consentAlerts: boolean;
}

type PartialReg = Partial<RegistrationData>;

interface RegContextType {
  data: PartialReg;
  update: (patch: PartialReg) => void;
  reset: () => void;
}

const RegistrationContext = createContext<RegContextType | null>(null);

export function RegistrationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PartialReg>({});

  const update = (patch: PartialReg) => setData(prev => ({ ...prev, ...patch }));
  const reset  = () => setData({});

  return (
    <RegistrationContext.Provider value={{ data, update, reset }}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error('useRegistration must be used inside RegistrationProvider');
  return ctx;
}
