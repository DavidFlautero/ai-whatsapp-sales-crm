"use client";

import {
  useEffect,
  useState,
} from "react";

type ContactMetadata = {
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  address_reference?: string;
  customer_type?: string;
  notes?: string;
};

type Contact = {
  phone: string;
  name?: string;
  business_name?: string;
  status?: string;
  temperature?: string;
  name_confirmed?: boolean;
  metadata?: ContactMetadata;
};

type Props = {
  contact: Contact;

  onSaved:
    (
      contact: Contact,
    ) => void;
};

export function ContactEditor({
  contact,
  onSaved,
}: Props) {
  const [
    editing,
    setEditing,
  ] =
    useState(false);

  const [
    form,
    setForm,
  ] =
    useState({
      name:
        contact.name
        ?? "",

      business_name:
        contact.business_name
        ?? "",

      email:
        contact.metadata
          ?.email
        ?? "",

      country:
        contact.metadata
          ?.country
        ?? "",

      province:
        contact.metadata
          ?.province
        ?? "",

      city:
        contact.metadata
          ?.city
        ?? "",

      address:
        contact.metadata
          ?.address
        ?? "",

      postal_code:
        contact.metadata
          ?.postal_code
        ?? "",

      address_reference:
        contact.metadata
          ?.address_reference
        ?? "",

      customer_type:
        contact.metadata
          ?.customer_type
        ?? "wholesaler",

      notes:
        contact.metadata
          ?.notes
        ?? "",

      temperature:
        contact.temperature
        ?? "warm",

      status:
        contact.status
        ?? "lead",
    });

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(
    () => {
      if (editing) {
        return;
      }

      setForm({
        name:
          contact.name
          ?? "",

        business_name:
          contact.business_name
          ?? "",

        email:
          contact.metadata
            ?.email
          ?? "",

        country:
          contact.metadata
            ?.country
          ?? "",

        province:
          contact.metadata
            ?.province
          ?? "",

        city:
          contact.metadata
            ?.city
          ?? "",

        address:
          contact.metadata
            ?.address
          ?? "",

        postal_code:
          contact.metadata
            ?.postal_code
          ?? "",

        address_reference:
          contact.metadata
            ?.address_reference
          ?? "",

        customer_type:
          contact.metadata
            ?.customer_type
          ?? "wholesaler",

        notes:
          contact.metadata
            ?.notes
          ?? "",

        temperature:
          contact.temperature
          ?? "warm",

        status:
          contact.status
          ?? "lead",
      });
    },
    [
      editing,
      contact.phone,
      contact.name,
      contact.business_name,
      contact.status,
      contact.temperature,
      contact.metadata,
    ],
  );

  function field(
    name:
      keyof typeof form,
    value: string,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [name]:
          value,
      }),
    );
  }

  async function save() {
    const cleanName =
      form.name.trim();

    if (
      cleanName.length < 2
    ) {
      setError(
        "Ingresá un nombre válido.",
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const response =
        await fetch(
          `/dashboard-api/contacts/${encodeURIComponent(contact.phone)}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...form,

                name:
                  cleanName,

                name_confirmed:
                  true,
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
        || !payload.ok
      ) {
        throw new Error(
          payload.error
          ?? "No se pudo actualizar",
        );
      }

      onSaved(
        payload.contact,
      );

      setEditing(false);
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={
          () =>
            setEditing(true)
        }
        style={{
          minHeight:
            38,

          padding:
            "8px 12px",

          color:
            "#075985",

          background:
            "#f0f9ff",

          border:
            "1px solid #bae6fd",

          borderRadius:
            10,

          font:
            "inherit",

          fontSize:
            11,

          fontWeight:
            900,

          cursor:
            "pointer",
        }}
      >
        Editar cliente
      </button>
    );
  }

  const inputStyle = {
    width:
      "100%",

    minHeight:
      40,

    padding:
      "9px 11px",

    color:
      "#0f172a",

    background:
      "#ffffff",

    border:
      "1px solid #cbd5e1",

    borderRadius:
      9,

    font:
      "inherit",
  };

  return (
    <div
      style={{
        width:
          520,

        maxWidth:
          "calc(100vw - 48px)",

        maxHeight:
          "78vh",

        padding:
          16,

        display:
          "grid",

        gap:
          12,

        overflowY:
          "auto",

        background:
          "#ffffff",

        border:
          "1px solid #bae6fd",

        borderRadius:
          16,

        boxShadow:
          "0 22px 60px rgba(15,23,42,.18)",
      }}
    >
      <strong>
        Datos del cliente
      </strong>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1fr 1fr",

          gap:
            10,
        }}
      >
        <input
          style={inputStyle}
          value={form.name}
          placeholder="Nombre *"
          onChange={
            (
              event,
            ) =>
              field(
                "name",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={
            form.business_name
          }
          placeholder="Negocio"
          onChange={
            (
              event,
            ) =>
              field(
                "business_name",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={form.email}
          placeholder="Correo electrónico"
          onChange={
            (
              event,
            ) =>
              field(
                "email",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={form.country}
          placeholder="País"
          onChange={
            (
              event,
            ) =>
              field(
                "country",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={form.province}
          placeholder="Provincia o departamento"
          onChange={
            (
              event,
            ) =>
              field(
                "province",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={form.city}
          placeholder="Ciudad"
          onChange={
            (
              event,
            ) =>
              field(
                "city",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={form.address}
          placeholder="Dirección de entrega"
          onChange={
            (
              event,
            ) =>
              field(
                "address",
                event.target.value,
              )
          }
        />

        <input
          style={inputStyle}
          value={
            form.postal_code
          }
          placeholder="Código postal"
          onChange={
            (
              event,
            ) =>
              field(
                "postal_code",
                event.target.value,
              )
          }
        />

        <select
          style={inputStyle}
          value={
            form.customer_type
          }
          onChange={
            (
              event,
            ) =>
              field(
                "customer_type",
                event.target.value,
              )
          }
        >
          <option value="retail">
            Minorista
          </option>

          <option value="wholesaler">
            Mayorista
          </option>

          <option value="distributor">
            Distribuidor
          </option>

          <option value="reseller">
            Revendedor
          </option>

          <option value="vip">
            VIP
          </option>

          <option value="other">
            Otro
          </option>
        </select>

        <select
          style={inputStyle}
          value={
            form.temperature
          }
          onChange={
            (
              event,
            ) =>
              field(
                "temperature",
                event.target.value,
              )
          }
        >
          <option value="cold">
            Frío
          </option>

          <option value="warm">
            Interesado
          </option>

          <option value="hot">
            Listo para comprar
          </option>
        </select>

        <select
          style={inputStyle}
          value={form.status}
          onChange={
            (
              event,
            ) =>
              field(
                "status",
                event.target.value,
              )
          }
        >
          <option value="lead">
            Lead
          </option>

          <option value="customer">
            Cliente
          </option>

          <option value="inactive">
            Inactivo
          </option>

          <option value="blocked">
            Bloqueado
          </option>
        </select>
      </div>

      <textarea
        style={{
          ...inputStyle,
          minHeight:
            72,

          resize:
            "vertical",
        }}
        value={
          form.address_reference
        }
        placeholder="Referencia de entrega, piso, apartamento, barrio..."
        onChange={
          (
            event,
          ) =>
            field(
              "address_reference",
              event.target.value,
            )
        }
      />

      <textarea
        style={{
          ...inputStyle,
          minHeight:
            82,

          resize:
            "vertical",
        }}
        value={form.notes}
        placeholder="Notas internas"
        onChange={
          (
            event,
          ) =>
            field(
              "notes",
              event.target.value,
            )
        }
      />

      {error ? (
        <div
          style={{
            color:
              "#b91c1c",

            fontSize:
              11,

            fontWeight:
              750,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display:
            "flex",

          gap:
            8,

          justifyContent:
            "flex-end",
        }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={
            () => {
              setError("");
              setEditing(false);
            }
          }
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={
            () =>
              void save()
          }
        >
          {saving
            ? "Guardando..."
            : "Guardar cliente"}
        </button>
      </div>
    </div>
  );
}
