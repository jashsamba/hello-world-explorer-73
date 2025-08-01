-- Security fix: Replace dangerous RLS policies with secure ones
-- Drop the insecure policies
DROP POLICY IF EXISTS "allow_public_insert" ON public.ticket_purchases;
DROP POLICY IF EXISTS "select_own_purchases" ON public.ticket_purchases;

-- Add session tracking table for rate limiting
CREATE TABLE IF NOT EXISTS public.purchase_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  ip_address INET,
  last_purchase_attempt TIMESTAMPTZ,
  purchase_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Enable RLS on purchase_sessions
ALTER TABLE public.purchase_sessions ENABLE ROW LEVEL SECURITY;

-- Create secure policies for ticket_purchases
-- Only allow inserts through authenticated edge functions
CREATE POLICY "secure_insert_only" ON public.ticket_purchases
FOR INSERT
WITH CHECK (
  -- Only allow inserts from edge functions (service role)
  current_setting('role') = 'service_role'
);

-- Only allow reads with valid session token
CREATE POLICY "secure_select_with_session" ON public.ticket_purchases
FOR SELECT
USING (
  -- Allow service role full access
  current_setting('role') = 'service_role' OR
  -- Allow reads only with valid session token within 24 hours
  EXISTS (
    SELECT 1 FROM public.purchase_sessions ps 
    WHERE ps.session_token = current_setting('app.session_token', true)
    AND ps.created_at > now() - interval '24 hours'
    AND ps.expires_at > now()
  )
);

-- Create audit log table for security monitoring
CREATE TABLE IF NOT EXISTS public.purchase_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'attempt', 'success', 'failure', 'suspicious'
  ip_address INET,
  user_agent TEXT,
  session_token TEXT,
  purchase_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.purchase_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can write to audit log
CREATE POLICY "service_role_audit_only" ON public.purchase_audit_log
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Add input validation constraints
ALTER TABLE public.ticket_purchases 
ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT valid_totals CHECK (
  subtotal >= 0 AND 
  tax >= 0 AND 
  service_fee >= 0 AND 
  total >= 0 AND
  total = subtotal + tax + service_fee
),
ADD CONSTRAINT valid_names CHECK (
  length(first_name) BETWEEN 1 AND 100 AND
  length(last_name) BETWEEN 1 AND 100 AND
  first_name !~ '[<>"\''&]' AND
  last_name !~ '[<>"\''&]'
);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.purchase_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_purchase_sessions_token ON public.purchase_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_purchase_sessions_expires ON public.purchase_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.purchase_audit_log(created_at);