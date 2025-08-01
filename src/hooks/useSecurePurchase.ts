import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PurchaseData {
  first_name: string;
  last_name: string;
  email: string;
  contact_number?: string;
  postal_code?: string;
  tickets: Record<string, number>;
  add_ons: Record<string, number>;
  totals: {
    subtotal: number;
    tax: number;
    service_fee: number;
    total: number;
  };
}

interface PurchaseResult {
  success: boolean;
  purchase_id?: string;
  error?: string;
  details?: string[];
}

export const useSecurePurchase = () => {
  const [processing, setProcessing] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>(() => {
    // Generate a secure session token for this browser session
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  const processPurchase = async (purchaseData: PurchaseData): Promise<PurchaseResult> => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('secure-purchase', {
        body: {
          ...purchaseData,
          session_token: sessionToken,
        },
      });

      if (error) {
        console.error('Purchase processing error:', error);
        return {
          success: false,
          error: error.message || 'Failed to process purchase',
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Purchase failed',
          details: data.details,
        };
      }

      return {
        success: true,
        purchase_id: data.purchase_id,
      };

    } catch (error) {
      console.error('Network error during purchase:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    } finally {
      setProcessing(false);
    }
  };

  return {
    processPurchase,
    processing,
    sessionToken,
  };
};