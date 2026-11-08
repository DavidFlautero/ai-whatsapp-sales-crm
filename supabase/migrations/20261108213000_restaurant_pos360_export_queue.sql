-- Delibocados QR -> POS360. Durable intent only; NO network / printing.
-- This depends on the QR foundation migration.
BEGIN;
CREATE FUNCTION public.restaurant_ops_pos360_enqueue_qr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.company_id='delibocados' AND NEW.source='qr'
    AND NEW.fulfillment_mode='dine_in' AND NEW.qr_table_id IS NOT NULL THEN
    INSERT INTO public.restaurant_ops_pos_exports(
      company_id,order_id,provider,external_reference,status,reason
    ) VALUES(
      NEW.company_id,NEW.id,'pos360','delibocados-qr-'||NEW.id::text,
      CASE WHEN NEW.status='confirmed'
        AND NEW.payment_status IN ('verified','cash_on_delivery')
        THEN 'pending' ELSE 'blocked' END,
      CASE WHEN NEW.status='confirmed'
        AND NEW.payment_status IN ('verified','cash_on_delivery')
        THEN '' ELSE 'QR_PAYMENT_REVIEW_REQUIRED' END
    ) ON CONFLICT(company_id,order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurant_ops_pos360_enqueue_dine_in
 AFTER UPDATE OF fulfillment_mode,qr_table_id ON public.restaurant_ops_orders
 FOR EACH ROW WHEN(NEW.fulfillment_mode='dine_in')
 EXECUTE FUNCTION public.restaurant_ops_pos360_enqueue_qr();

CREATE FUNCTION public.restaurant_ops_pos360_sync_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.company_id='delibocados' AND NEW.source='qr'
    AND NEW.fulfillment_mode='dine_in'
    AND (NEW.status IS DISTINCT FROM OLD.status
         OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN
    UPDATE public.restaurant_ops_pos_exports e SET
      status=CASE
        WHEN NEW.status IN ('completed','cancelled') THEN 'suppressed'
        WHEN NEW.status<>'confirmed' THEN 'blocked'
        WHEN NEW.payment_status IN ('verified','cash_on_delivery') THEN 'pending'
        ELSE 'blocked' END,
      reason=CASE
        WHEN NEW.status IN ('completed','cancelled') THEN 'QR_ORDER_FINISHED'
        WHEN NEW.status<>'confirmed' THEN 'QR_ORDER_NOT_CONFIRMABLE'
        WHEN NEW.payment_status IN ('verified','cash_on_delivery') THEN ''
        ELSE 'QR_PAYMENT_REVIEW_REQUIRED' END,
      updated_at=now()
    WHERE e.company_id=NEW.company_id AND e.order_id=NEW.id
      AND e.provider='pos360' AND e.status IN ('blocked','pending')
      AND e.attempts=0;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurant_ops_pos360_sync_payment
 AFTER UPDATE OF status,payment_status ON public.restaurant_ops_orders
 FOR EACH ROW WHEN(NEW.source='qr' AND NEW.fulfillment_mode='dine_in')
 EXECUTE FUNCTION public.restaurant_ops_pos360_sync_hold();

REVOKE ALL ON FUNCTION public.restaurant_ops_pos360_enqueue_qr() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_pos360_sync_hold() FROM PUBLIC,anon,authenticated;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261108213000','Delibocados QR POS360 pending export ledger; transport disabled')
ON CONFLICT(version) DO NOTHING;
COMMIT;
