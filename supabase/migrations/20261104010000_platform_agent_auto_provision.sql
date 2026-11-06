BEGIN;

CREATE OR REPLACE FUNCTION public.platform_seed_company_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_description text;
BEGIN
  SELECT name
  INTO STRICT v_name
  FROM public.commerce_companies
  WHERE id = NEW.company_id;

  v_description := CASE NEW.sector
    WHEN 'restaurant' THEN
      'Empresa del sector gastronómico y restauración.'
    WHEN 'events' THEN
      'Empresa dedicada a eventos y servicios relacionados.'
    WHEN 'services' THEN
      'Empresa dedicada a la prestación de servicios.'
    WHEN 'retail' THEN
      'Empresa dedicada a la venta de productos.'
    ELSE
      'Empresa que utiliza asistencia comercial inteligente.'
  END;

  INSERT INTO public.ai_prompts (
    company_id,
    type,
    title,
    prompt,
    version,
    active,
    metadata
  )
  VALUES
  (
    NEW.company_id,
    'company_agent',
    'Agente empresarial avanzado',
    'Sos el asistente comercial de esta empresa. '
    || 'Atendé consultas, utilizá información verificada, '
    || 'mantené el contexto de conversación y derivá '
    || 'al operador cuando corresponda. '
    || 'No inventes precios, stock ni disponibilidad. '
    || 'No confirmes pedidos ni pagos sin verificar '
    || 'el resultado de las herramientas autorizadas. '
    || 'Nunca utilices información de otras empresas.',
    1,
    true,
    jsonb_build_object(
      'businessName', v_name,
      'businessDescription', v_description,
      'verifiedContext', '',
      'sector', NEW.sector,
      'templateVersion', 1
    )
  ),
  (
    NEW.company_id,
    'sales',
    'Agente de ventas',
    'Atendé al cliente de manera profesional. '
    || 'Detectá necesidades e intención de compra. '
    || 'Consultá el catálogo autorizado antes de informar '
    || 'precios, disponibilidad o condiciones. '
    || 'No inventes productos ni confirmes operaciones '
    || 'que no hayan sido verificadas.',
    1,
    true,
    jsonb_build_object('templateVersion', 1)
  ),
  (
    NEW.company_id,
    'followup',
    'Seguimiento comercial',
    'Prepará seguimientos comerciales relevantes '
    || 'utilizando el historial autorizado del cliente. '
    || 'Respetá sus preferencias de contacto. '
    || 'No envíes mensajes sin autorización del sistema.',
    1,
    true,
    jsonb_build_object('templateVersion', 1)
  ),
  (
    NEW.company_id,
    'recovery',
    'Recuperación comercial',
    'Prepará propuestas de recuperación para clientes '
    || 'inactivos utilizando información verificada. '
    || 'No inventes descuentos, beneficios ni promociones. '
    || 'Respetá las preferencias de contacto.',
    1,
    true,
    jsonb_build_object('templateVersion', 1)
  )
  ON CONFLICT (company_id, type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  platform_company_agent_auto_provision
ON public.platform_company_onboarding;

CREATE TRIGGER platform_company_agent_auto_provision
AFTER INSERT
ON public.platform_company_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.platform_seed_company_agent();

REVOKE ALL
ON FUNCTION public.platform_seed_company_agent()
FROM PUBLIC, anon, authenticated;

COMMIT;
