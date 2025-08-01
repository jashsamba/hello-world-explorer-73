-- Create table to store ticket purchases
CREATE TABLE public.ticket_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  postal_code TEXT,
  
  -- Ticket Information
  tickets JSONB NOT NULL, -- Store ticket selections with quantities
  add_ons JSONB, -- Store add-on selections
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  
  -- Purchase Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method TEXT DEFAULT 'card',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public inserts (for kiosk purchases)
CREATE POLICY "allow_public_insert" ON public.ticket_purchases
FOR INSERT
WITH CHECK (true);

-- Create policy to allow reading your own purchases (if we add user auth later)
CREATE POLICY "select_own_purchases" ON public.ticket_purchases
FOR SELECT
USING (true); -- For now allow all reads, can be restricted later

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ticket_purchases_updated_at
    BEFORE UPDATE ON public.ticket_purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();