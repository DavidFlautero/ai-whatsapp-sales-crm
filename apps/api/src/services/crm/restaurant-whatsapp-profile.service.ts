import { getContactByPhone, upsertContact } from "../crm/crm.repository.js";

const COMPANY = "delibocados";

// Whapi from_name is an unverified display name, not a confirmed legal name.
export async function captureRestaurantWhatsappName(input: {
  companyId: string;
  phone: string;
  profileName: unknown;
}): Promise<boolean> {
  if (input.companyId !== COMPANY || !/^[0-9]{8,15}$/.test(input.phone)) {
    return false;
  }
  const value = typeof input.profileName === "string" ? input.profileName.trim() : "";
  if (value.length < 2 || value.length > 120 ||
      /[\x00-\x1f\x7f]/.test(value) ||
      /^\+?[0-9 ()-]+$/.test(value)) {
    return false;
  }
  const existing = await getContactByPhone(input.phone, COMPANY);
  // Never override a customer-confirmed name or a name entered by an operator.
  if (existing?.name?.trim()) return false;
  await upsertContact({
    phone: input.phone,
    name: value,
    ...(existing?.status ? { status: existing.status } : {}),
    metadata: {
      ...(existing?.metadata ?? {}),
      name_source: "whatsapp_profile",
      name_confirmed: false,
      whatsapp_profile_name: value
    }
  }, COMPANY);
  return true;
}
