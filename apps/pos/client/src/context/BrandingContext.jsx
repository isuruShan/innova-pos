import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const DEFAULT_BRANDING = {
  businessName: 'InnovaPOS',
  logoUrl: '',
  primaryColor: '#1a1a2e',
  accentColor: '#e94560',
  sidebarColor: '#16213e',
  textColor: '#ffffff',
  paymentMethods: ['cash', 'card'],
  currency: 'LKR',
  currencySymbol: 'Rs.',
  receiptFooter: 'Thank you for your visit!',
  printReceiptByDefault: false,
};

const BrandingContext = createContext(DEFAULT_BRANDING);

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const { data } = await axios.get('/api/tenant-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBranding({ ...DEFAULT_BRANDING, ...data });
      } catch {
        // Use defaults silently
      }
    };
    fetchBranding();
  }, []);

  // Apply CSS variables whenever branding changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primaryColor);
    root.style.setProperty('--color-accent', branding.accentColor);
    root.style.setProperty('--color-sidebar', branding.sidebarColor);
    root.style.setProperty('--color-text', branding.textColor);
    if (branding.businessName) document.title = branding.businessName + ' — POS';
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
