import fs from "node:fs";
import path from "node:path";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";


type DbRow =
  Record<string, any>;


type VerifiedSeed = {
  key: string;

  aliases: string[];

  canonicalName?: string;

  providerType: string;

  serviceCategories: string[];

  replaceCategories?: boolean;

  contactName?: string;

  phone?: string;

  whatsapp?: string;

  email?: string;

  city?: string;

  province?: string;

  address?: string;

  postalCode?: string;

  website?: string;

  factualNotes: string[];

  commercialRelationship?: string;

  commercialConditions?: DbRow;

  sourceFolderId?: string;

  sourceFileIds: string[];
};


const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID
  || "eventos-mediterraneo";


const APPLY =
  process.argv.includes(
    "--apply",
  );


const verified:
  VerifiedSeed[] = [

  /* ========================================================
     CATERING
     ======================================================== */

  {
    key:
      "bandana",

    aliases: [
      "Bandana Catering",
      "Bandana",
    ],

    canonicalName:
      "Bandana Catering",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
    ],

    replaceCategories:
      true,

    contactName:
      "Bandana Catering",

    phone:
      "961059942",

    email:
      "info@bardanacateringvalencia.com",

    city:
      "València",

    province:
      "Valencia",

    address:
      "C/ d'Alcàsser, 26, bajo",

    postalCode:
      "46014",

    factualNotes: [
      "Contacto y dirección verificados directamente en documentación de Google Drive.",
    ],

    sourceFolderId:
      "1KLP32wtb35cigHQteFbUuKS9_-c_MSEm",

    sourceFileIds: [
      "1IEuJY5l6ixmH3zhVjvwnLRDN91etHHpSbiRzP36Fxcw",
    ],
  },


  {
    key:
      "cris-catering",

    aliases: [
      "Cris Catering",
      "Cris",
    ],

    canonicalName:
      "Cris Catering",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
    ],

    replaceCategories:
      true,

    email:
      "cristinamartina8823@gmail.com",

    factualNotes: [
      "Drive indica pendiente/intercambio de información de coches.",
      "Drive menciona información relacionada con chalet.",
      "Drive menciona fotos y vídeos de servicios de catering.",
    ],

    commercialRelationship:
      "Acuerdo comercial documentado del 10%.",

    commercialConditions: {
      commission_percent:
        10,
    },

    sourceFolderId:
      "1trcUGTyfEs8PQ8MibvqlgbjFcriqa8SP",

    sourceFileIds: [
      "1KBwKTFCBHXhgbK5JpeCapvRiateixwiVyQzcVLi_T4g",
    ],
  },


  {
    key:
      "paula-catering",

    aliases: [
      "Paula",
      "Paula Catering",
    ],

    canonicalName:
      "Paula Catering",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
      "weddings",
      "birthdays",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Paula figura como colaboradora para encargarse de la comida en bodas y cumpleaños.",
    ],

    commercialRelationship:
      "Colaboración planteada; porcentaje pendiente de cerrar.",

    sourceFolderId:
      "14NPP9ljgwxPyGFFfqDVJP_E96p06JVTi",

    sourceFileIds: [
      "1Acu8e5221mTYhmSr0ayAz9dwL_34Wpe-55DstjfNEss",
    ],
  },


  {
    key:
      "triana-catering-rd",

    aliases: [
      "Triana Catering RD",
    ],

    canonicalName:
      "Triana Catering RD",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
    ],

    replaceCategories:
      true,

    phone:
      "688365625",

    email:
      "bonmenjar8@gmail.com",

    factualNotes: [
      "Menú documentado a 18 €/pax; total con IVA indicado 19,80 €/pax.",
      "Incluye montaje, mantelería, cristalería, cubertería y centros de mesa.",
      "Punto de vino documentado como extra de 5 €/pax.",
    ],

    commercialConditions: {
      menu_price_per_person:
        18,

      menu_price_with_vat_per_person:
        19.80,

      wine_service_extra_per_person:
        5,
    },

    sourceFolderId:
      "1EvY45XwbvoLwREIvUPYVItLl7GEwa_AG",

    sourceFileIds: [
      "1f0Ugh6kc6LIqa58ulbwPugE2fCuZ8PaW",
    ],
  },


  {
    key:
      "diego-catering",

    aliases: [
      "Diego",
      "Diego Catering",
    ],

    canonicalName:
      "Diego Catering",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Oferta documentada para 50 comensales.",
      "Incluye transporte, menaje premium de un solo uso y montaje/emplatado.",
      "Servicio de camareros y mobiliario se presupuestan aparte.",
    ],

    commercialConditions: {
      documented_price_per_person:
        34,

      three_waiters_12_to_14:
        240,

      drinks_open_bar_extra_per_person:
        8,

      chairs_tables_extra_per_person:
        15,

      alcoholic_drink_per_glass:
        6,

      alcoholic_open_bar_per_person:
        25,
    },

    sourceFolderId:
      "1bVFyAwzu7F9bNoJvSL40CkIeidGuf8O3",

    sourceFileIds: [
      "1knD5dlRpsYhHzO4C_DFQdwYuQHFLB4Hl",
    ],
  },


  {
    key:
      "devoradores",

    aliases: [
      "Catering Devoradora",
      "Catering devoradora",
      "Devoradores Catering",
      "Devoradora",
    ],

    canonicalName:
      "Devoradores Catering",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
      "bocadillos",
      "coffee_break",
    ],

    replaceCategories:
      true,

    contactName:
      "Ana",

    phone:
      "+34960610249",

    email:
      "comercial@devoradorescatering.com",

    city:
      "Mislata",

    province:
      "Valencia",

    address:
      "Calle San Antonio, 30",

    postalCode:
      "46920",

    factualNotes: [
      "Proveedor de comida, bebida fría y menaje desechable.",
      "No incluye camareros ni menaje reutilizable.",
      "Transporte se calcula aparte según ubicación.",
      "Pedido mínimo de bocadillos documentado: 50 unidades por referencia.",
    ],

    commercialConditions: {
      gourmet_sandwich_unit:
        4.70,

      basic_sandwich_unit:
        3.80,

      payment:
        "Pago antes del servicio y envío obligatorio del justificante.",

      vat:
        "Precios documentados no incluyen IVA del 10%.",
    },

    sourceFolderId:
      "1kMtvlV67kdsCfWhU1brt6T1NBucH81Oq",

    sourceFileIds: [
      "1G4DdIPRVpFYb3fQe0JNXZFayEvyRwFdHQBgf_8j0YWw",
      "1WZyn6-dr5x1mwb3iWg0HsI8Vlk45dL_N",
    ],
  },


  {
    key:
      "finisterre",

    aliases: [
      "Luis Catering Roberto",
      "Luis catering Roberto",
      "Catering Finisterre",
      "Luis Dueño Catering Finisterre",
    ],

    canonicalName:
      "Catering Finisterre",

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
      "weddings",
    ],

    replaceCategories:
      true,

    contactName:
      "Luis",

    factualNotes: [
      "Menú personalizado.",
      "Menús documentados desde 40 €/persona.",
      "Ejemplo completo documentado a 55 €/persona.",
      "Opciones superiores documentadas hasta 100 €/persona para marisco.",
      "Mesas y sillas no incluidas.",
    ],

    commercialRelationship:
      "10% de cada catering para Gala Valencia.",

    commercialConditions: {
      commission_percent:
        10,

      reservation_deposit_percent:
        15,

      final_meeting_days_before_event:
        15,

      menu_from:
        40,

      documented_menu_example:
        55,

      premium_seafood_up_to:
        100,

      standard_liquor_bottle_service:
        35,
    },

    sourceFolderId:
      "1K0Yz_ey-7lvs8-vzIN9FBBS8P9LYUL_8",

    sourceFileIds: [
      "1esSI5XnoKq4Zzhj3h4dBry1d_0IWqQfZqXKpmo5hGDI",
    ],
  },


  {
    key:
      "triana",

    aliases: [
      "Triana",
    ],

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Colaboración prevista para futuros eventos.",
      "Documento histórico registra catering de boda a 55 €/persona.",
      "Fundas de silla documentadas a 2,50 €/unidad.",
      "Mesas documentadas a 10 € por mesa para 8 personas.",
      "Transporte documentado a 50 €.",
      "Necesidad comercial registrada: trabajo de marketing/Instagram.",
    ],

    commercialRelationship:
      "Colaboración para futuros servicios de catering.",

    sourceFolderId:
      "1sIkrsjuVjfCXqhxaqMgMtllx9PIfgzyu",

    sourceFileIds: [
      "140yiHkMKRm2hGCVcFh5Z7Cow7RpwoiLcjfN_iNHTw94",
      "1eUPkymP-dpGt7SgJOQo8cQSr7ZRV_3lmS86tczTmYXM",
    ],
  },


  {
    key:
      "javi-benimaclet",

    aliases: [
      "Javi Benimaclet",
      "Javi Benimaclet Ultramarino",
    ],

    providerType:
      "catering_provider",

    serviceCategories: [
      "catering",
      "bandejas",
    ],

    replaceCategories:
      true,

    contactName:
      "Javi",

    factualNotes: [
      "Bandejas documentadas para aproximadamente 10 personas.",
      "Referencia aproximada de 10 bandejas para 100 personas.",
      "Bandeja de quesos documentada a 25 €.",
      "Bandeja de embutidos documentada a 25 €.",
    ],

    sourceFolderId:
      "1Qd1Ine4dMcWYv16f2d7g3ykY0_kkaStS",

    sourceFileIds: [
      "1IzPzBYNoMMQUCpycqx-fApIQfB6IP22CobKD9vqC6Fk",
    ],
  },


  {
    key:
      "maite",

    aliases: [
      "Maite",
      "Maite Catering",
      "Maite catering y organización de eventos",
    ],

    canonicalName:
      "Maite",

    providerType:
      "event_organizer",

    serviceCategories: [
      "event_organization",
      "collaboration",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Drive documenta conversación para colaborar conjuntamente en organización de eventos.",
      "Reunión de colaboración quedó pendiente.",
    ],

    sourceFolderId:
      "1-pRlow3jhz5EC3mvp6drBT7iAAGE-GPb",

    sourceFileIds: [
      "1Sf0KfYU66FEwi1LgusxFxj4nSKbJGscO9vrLNJZSTVM",
    ],
  },


  {
    key:
      "soriano-ruben",

    aliases: [
      "Soriano",
      "Soriano menú",
    ],

    providerType:
      "service_provider",

    serviceCategories: [
      "catering",
      "property_contact",
    ],

    factualNotes: [
      "Documento indica 'Servicio de Rubén'.",
      "Web documentada: www.tornem.pro.",
      "Rubén indicó disponer además de otro chalet por Valencia y un local para posible alquiler; pendiente de organizar.",
    ],

    website:
      "https://www.tornem.pro",

    sourceFolderId:
      "1yUJO8x_HfzQ7qmQ8gwYiq7R2dpVf8atL",

    sourceFileIds: [
      "1MyljlGP5L2woD_Xz1XS580PZhmdxHweCbUc6ScA_TZM",
    ],
  },


  /* ========================================================
     PERSONAL / COCINA
     ======================================================== */

  {
    key:
      "nathaly-cruz",

    aliases: [
      "Nathaly Cruz",
      "Nathaly Cruz Catering",
      "Nathaly",
    ],

    canonicalName:
      "Nathaly Cruz",

    providerType:
      "staff_provider",

    serviceCategories: [
      "event_staff",
      "kitchen_staff",
      "customer_service",
    ],

    replaceCategories:
      true,

    contactName:
      "Nathaly Lizeth Cruz Tipantiza",

    phone:
      "+34614207578",

    whatsapp:
      "+34614207578",

    email:
      "nlct.cruz.5@gmail.com",

    city:
      "Valencia",

    province:
      "Valencia",

    address:
      "Carrer del Consolat del Mar, L'Eixample",

    postalCode:
      "46006",

    factualNotes: [
      "Disponibilidad documentada: tardes/noches, fines de semana y festivos.",
      "Experiencia documentada como ayudante de cocina, friegaplatos y atención al cliente.",
    ],

    sourceFolderId:
      "1wf8w9XZpi3IJAZ-omL7HPsf1BrpgBJfA",

    sourceFileIds: [
      "1wmMhmevHo6iAIDszbB271xAu8PxSCJ_9",
      "1vDWHEQpzWccmedF4zz-6Oj7yv4Q9t_e0HSznYlysAoI",
    ],
  },


  {
    key:
      "valentina",

    aliases: [
      "Valentina",
      "Valentina Catering",
      "Valentina Diaz",
    ],

    canonicalName:
      "Valentina Diaz",

    providerType:
      "staff_provider",

    serviceCategories: [
      "event_staff",
      "kitchen_staff",
      "dishwashing",
    ],

    replaceCategories:
      true,

    contactName:
      "Valentina Diaz",

    phone:
      "641605522",

    email:
      "valentinadiaz705@gmail.com",

    city:
      "Benetússer",

    province:
      "Valencia",

    postalCode:
      "46910",

    factualNotes: [
      "Datos verificados visualmente en CV almacenado en Drive.",
      "Experiencia documentada en trabajo de cocina/lavaplatos y atención al cliente.",
    ],

    sourceFolderId:
      "1wcAujaH0o3u5xX7JIOs23MwLAxr8Yhgn",

    sourceFileIds: [
      "1weFmoYKRRKcKmyMEiuuKOWlXeK6vQ1Xn",
    ],
  },


  {
    key:
      "alejandro-martinez",

    aliases: [
      "Alejandro Martinez",
      "Alejandro Martínez",
    ],

    canonicalName:
      "Alejandro Martínez",

    providerType:
      "staff_provider",

    serviceCategories: [
      "event_staff",
      "waiter",
      "staff_supervisor",
    ],

    replaceCategories:
      true,

    contactName:
      "Alejandro Martínez",

    phone:
      "641763191",

    city:
      "Torrent",

    province:
      "Valencia",

    factualNotes: [
      "Experiencia documentada en montaje de salón de eventos.",
      "Experiencia como camarero y encargado de personal.",
      "Experiencia en ventas y atención al cliente.",
    ],

    sourceFolderId:
      "1koFR7L0F9ViXjNwjR0umgHodcNZugsDx",

    sourceFileIds: [
      "1shuaqBfqRLP5OjJPOWVW-H7RovFmDGdL",
      "1F529oECUSoIjK6n8JTPn8vvJQ0qf5b4-cab2Tc5S2JQ",
    ],
  },


  {
    key:
      "leidy-tatiana",

    aliases: [
      "Leidy Tatiana",
      "Leidy Tatiana Tangarife Agudelo",
    ],

    canonicalName:
      "Leidy Tatiana",

    providerType:
      "staff_provider",

    serviceCategories: [
      "event_staff",
      "waiter",
    ],

    replaceCategories:
      true,

    contactName:
      "Leidy Tatiana Tangarife Agudelo",

    phone:
      "631804925",

    email:
      "tatiana_46600@outlook.es",

    city:
      "Catarroja",

    province:
      "Valencia",

    address:
      "Calle Albal",

    postalCode:
      "46470",

    factualNotes: [
      "Experiencia documentada como camarera en bodas, bautizos y comuniones.",
      "Experiencia en organización de mesas y cócteles.",
    ],

    sourceFolderId:
      "1RUjo8mDZyp9NaKt1ev2Wuz_hkEEgkpwd",

    sourceFileIds: [
      "1r4Cizpb7_OG9nrUCO6CCz7ZoVjKe2Sfd",
    ],
  },


  {
    key:
      "addu-habibi",

    aliases: [
      "Adda Habibi",
      "Addu Habibi",
      "Abdessamad Chaerradi",
    ],

    canonicalName:
      "Abdessamad Chaerradi",

    providerType:
      "staff_provider",

    serviceCategories: [
      "chef",
      "kitchen_staff",
    ],

    replaceCategories:
      true,

    contactName:
      "Abdessamad Chaerradi",

    phone:
      "697994475",

    email:
      "abdessamadchaerradi1@gmail.com",

    city:
      "Vilanova i la Geltrú",

    postalCode:
      "08800",

    factualNotes: [
      "Identidad y contacto verificados visualmente en CV almacenado en Drive.",
      "Experiencia profesional documentada como chef/sous-chef.",
    ],

    sourceFolderId:
      "10IwaZz-EP0AON1IRk_HbfBNXuHXgUUsP",

    sourceFileIds: [
      "10NrQnYN2J2xA-wALKMt3j8cJhkxG4a0T",
    ],
  },


  /* ========================================================
     MOBILIARIO
     ======================================================== */

  {
    key:
      "ceibo",

    aliases: [
      "Cerbo",
      "Cerbo Probedor",
      "Ceibo",
      "Ceibo Mobiliario",
    ],

    canonicalName:
      "Ceibo",

    providerType:
      "furniture_provider",

    serviceCategories: [
      "furniture",
      "chairs",
      "tables",
      "event_equipment",
    ],

    replaceCategories:
      true,

    contactName:
      "Marcela",

    phone:
      "627475771",

    email:
      "info@ceibo.es",

    website:
      "https://www.ceibo.es/catalogo",

    factualNotes: [
      "Contacto urgente documentado: Marcela.",
      "Emails adicionales: marketing@ceibo.es y marcela@ceibo.es.",
      "Horario documentado: lunes a viernes 08:30–14:00 y 15:00–17:30.",
      "Silla de madera documentada a 2 €/unidad.",
      "Portes calculados según operación, con mínimo documentado de 140 €.",
    ],

    commercialConditions: {
      wooden_chair_unit:
        2,

      transport_minimum:
        140,
    },

    sourceFolderId:
      "1W9ksyDOaso4yFwdHl_CvioHOW-CXVjJy",

    sourceFileIds: [
      "1EOVlzXiwq2d22FUmVlc1vo6Oim4uUCSX6hfzlPT60G4",
    ],
  },


  {
    key:
      "quico-manises",

    aliases: [
      "Quico Manises",
      "Quico / Manises",
      "Quico Mobiliario Manises",
    ],

    canonicalName:
      "Quico Manises",

    providerType:
      "furniture_provider",

    serviceCategories: [
      "furniture",
      "chairs",
    ],

    replaceCategories:
      true,

    phone:
      "960615173",

    city:
      "Manises",

    province:
      "Valencia",

    factualNotes: [
      "Número verificado en documento de Drive de Sillas Quico / Manises.",
    ],

    sourceFolderId:
      "103sljEHkLz2YCofUpSQFpc4KWc673NaE",

    sourceFileIds: [
      "1pG-HWe_uj_ymCvmmqflqeuy7eq_8uom2",
    ],
  },


  {
    key:
      "ruben-sillas",

    aliases: [
      "Ruben Castellon",
      "Rubén Castellón",
      "Silla Ruben Castellon",
      "Silla Ruben - Castellòn",
    ],

    providerType:
      "furniture_provider",

    serviceCategories: [
      "chairs",
      "furniture",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Silla plástica blanca: 1 €.",
      "Silla plegable: 2,50 €.",
      "Transporte día laborable: 80 €.",
      "Transporte fin de semana: 120 €.",
      "Entrega y recogida incluidas según documento.",
    ],

    commercialConditions: {
      white_plastic_chair:
        1,

      folding_chair:
        2.5,

      weekday_transport:
        80,

      weekend_transport:
        120,
    },

    sourceFolderId:
      "1ojPyPOmieXyK1-dVIsLtdX4tGHXwG65B",

    sourceFileIds: [
      "1z90e_7MLScCZXjdlg8MjlFn6qF7TmtmmIL1nqDi5Xf4",
    ],
  },


  {
    key:
      "miguel-silla",

    aliases: [
      "Miguel Silla Ikea",
      "Miguel Sillas IKEA",
    ],

    canonicalName:
      "Miguel Silla Ikea",

    providerType:
      "furniture_provider",

    serviceCategories: [
      "chairs",
      "furniture",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Disponibilidad histórica documentada: recogida desde sábado por la tarde.",
      "Devolución indicada domingo por la tarde o sábado a las 07:00; el lunes necesita las sillas para el bar.",
    ],

    sourceFolderId:
      "1xSXkdVxZKjsVSzsSXzEChIJWZ1NoYbVU",

    sourceFileIds: [
      "1-zdIOEjb1R7M00Qrt_mqpU9ip_1ppylj736Arg_iDdQ",
    ],
  },


  {
    key:
      "antonio-albal",

    aliases: [
      "Antonio Albal Sillas",
      "Antonio Sillas Albal",
    ],

    canonicalName:
      "Antonio Albal Sillas",

    providerType:
      "furniture_provider",

    serviceCategories: [
      "chairs",
      "chair_covers",
      "furniture",
    ],

    replaceCategories:
      true,

    contactName:
      "Antonio",

    city:
      "Albal",

    province:
      "Valencia",

    factualNotes: [
      "Drive documenta conversación sobre fundas de silla y telas.",
      "Documento contiene referencias de precio 10 € y mínimo 8 € según cantidades.",
      "Antonio también figura como dueño de local en Albal.",
    ],

    sourceFolderId:
      "1zafkxSRPL291BTTomgYuGwItwT6ePAKL",

    sourceFileIds: [
      "1yd8AyjbBoW7cPqzoG3vk-kugVN0EEo0EL9dej4mQjWE",
    ],
  },


  /* ========================================================
     DECORACION
     ======================================================== */

  {
    key:
      "alejandra-decoracion",

    aliases: [
      "Alejandra",
      "Alejandra Decoraciones",
      "Alejandra Descoracines",
    ],

    canonicalName:
      "Alejandra Decoraciones",

    providerType:
      "decoration_provider",

    serviceCategories: [
      "decoration",
      "chair_covers",
    ],

    replaceCategories:
      true,

    factualNotes: [
      "Cumpleaños documentado a 200 €.",
      "Bautizo documentado a 230 €.",
      "Boda documentada a 300 €.",
      "15 años documentado a 250 €.",
      "Fundas con lazos documentadas a 1,50 €/unidad.",
      "Para servicios fuera de Valencia se documenta cobro de flete.",
    ],

    commercialRelationship:
      "Documento indica margen para Gala Valencia de 20–30 € añadido al precio.",

    commercialConditions: {
      birthday:
        200,

      baptism:
        230,

      wedding:
        300,

      quinceanera:
        250,

      chair_cover_unit:
        1.5,

      gala_markup_min:
        20,

      gala_markup_max:
        30,
    },

    sourceFolderId:
      "1sx8rn8laO0tlBv0rhhSB_rwe3Ddpf2St",

    sourceFileIds: [
      "1UvHhvcGp1z6lPgyTcbkzpae2gt8aTYTYIwcRm_e-zyk",
    ],
  },


  /* ========================================================
     TRANSPORTE
     ======================================================== */

  {
    key:
      "autocares-alegre",

    aliases: [
      "Autocares Alegre",
    ],

    canonicalName:
      "Autocares Alegre",

    providerType:
      "transport_provider",

    serviceCategories: [
      "bus",
      "minibus",
      "event_transport",
    ],

    replaceCategories:
      true,

    phone:
      "963831671",

    email:
      "autocaresalegre@autocaresalegre.com",

    factualNotes: [
      "Flota documentada de autocares y microbuses de distintas capacidades.",
      "Servicios para eventos, lanzaderas y desplazamientos de grupos.",
      "Flexibilidad horaria y conductores profesionales documentados.",
    ],

    sourceFolderId:
      "1Mo9MmxSDlbyxCzCScbEqCPx1DF0EpgrP",

    sourceFileIds: [
      "1sv2QKaA9H7RLYMsYPzqlUnU-Kuo9jiyWa0aOsjF2Djo",
    ],
  },


  {
    key:
      "massabus",

    aliases: [
      "Massabus",
    ],

    canonicalName:
      "Massabus",

    providerType:
      "transport_provider",

    serviceCategories: [
      "bus",
      "event_transport",
    ],

    replaceCategories:
      true,

    phone:
      "961443689",

    city:
      "Massamagrell",

    province:
      "Valencia",

    address:
      "Polígono Industrial El Bobalar, Calle dos, Parcela 7",

    postalCode:
      "46130",

    website:
      "https://www.massabus.com",

    factualNotes: [
      "Dirección y teléfono verificados en documentación de Drive.",
      "Documento histórico registra presupuesto de tres buses de 32 pax.",
      "La documentación registra anticipo para reserva y pago restante antes del evento.",
    ],

    sourceFolderId:
      "1cKGyZl8vX0AKxGmsA-wng9hfaW6zMEUl",

    sourceFileIds: [
      "1FpYCvPLepZR3YqoycvK8hdFVloIenCWNDmlfCsQi15I",
    ],
  },


  {
    key:
      "junito",

    aliases: [
      "Taxis 24 Horas Junito",
      "Junito",
      "Yunito Multiservicios",
    ],

    canonicalName:
      "Yunito Multiservicios",

    providerType:
      "transport_provider",

    serviceCategories: [
      "taxi",
      "transport",
      "multiservice",
    ],

    replaceCategories:
      true,

    phone:
      "+34665639565",

    factualNotes: [
      "Nombre y número verificados visualmente en captura de contacto de WhatsApp almacenada en Drive.",
      "La captura indica 'Solo llamadas urgentes'.",
    ],

    sourceFolderId:
      "1vfxugXtigweC7j_yzzNeYxRA9xyDwh0A",

    sourceFileIds: [
      "1dP7dUReig31KpgMGDsBVVUukWWCvl1ZQ",
    ],
  },


  {
    key:
      "eventscars",

    aliases: [
      "EVENTSCARS",
      "EventsCars",
      "Events Cars",
    ],

    canonicalName:
      "Events Cars",

    providerType:
      "transport_provider",

    serviceCategories: [
      "classic_cars",
      "wedding_transport",
      "event_transport",
    ],

    replaceCategories:
      true,

    website:
      "https://eventscars.com/category/eventos/",

    factualNotes: [
      "Alquiler profesional de coches clásicos para bodas y eventos.",
      "Drive indica más de 50 modelos disponibles.",
      "Tarifas indicadas desde 450 € para servicios completos de boda.",
    ],

    commercialConditions: {
      wedding_service_from:
        450,
    },

    sourceFolderId:
      "1eqZLceuzOep8Vc2bu_wUXw_znzWsF1e3",

    sourceFileIds: [
      "16ska55viirT9_GOdALGdMW5_vAnOJv-BAnmd3IRyv4o",
    ],
  },


  /* ========================================================
     CORRECCION DE CLASIFICACION: FOSATI
     ======================================================== */

  {
    key:
      "fosati",

    aliases: [
      "Fosati",
      "Empresa Fosati sillas",
      "Alejandro Alboraya",
    ],

    canonicalName:
      "Fosati",

    providerType:
      "sound_stage_provider",

    serviceCategories: [
      "sound",
      "stage",
      "event_equipment",
    ],

    replaceCategories:
      true,

    contactName:
      "Alejandro",

    phone:
      "+34629652431",

    website:
      "https://www.fosati.com",

    factualNotes: [
      "Clasificación corregida tras revisar directamente la captura almacenada en Drive: contacto asociado a empresa de sonido/escenario, no proveedor de sillas.",
    ],

    sourceFolderId:
      "1mB33Wy8v0fAkIhKFJvcVc9QWiNSRVrrH",

    sourceFileIds: [
      "1MW9ZRanI1a19mOf5oWBV8DC-oKSq71Ig",
    ],
  },
];


/* =========================================================
   HELPERS
   ========================================================= */

function normalize(
  value: unknown,
) {
  return String(
    value
    ?? "",
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}


function enc(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}


function nonEmpty(
  value: unknown,
) {
  if (
    value === null
    ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string"
  ) {
    return Boolean(
      value.trim(),
    );
  }

  return true;
}


function appendText(
  current: unknown,
  lines: string[],
) {
  const old =
    String(
      current
      ?? "",
    ).trim();

  const newLines =
    lines.filter(
      line =>
        line.trim()
        &&
        !old.includes(
          line.trim(),
        ),
    );

  if (
    !newLines.length
  ) {
    return old;
  }

  const block =
    [
      "[Drive verificado 2026-09-29]",
      ...newLines,
    ].join(
      "\n",
    );

  return old
    ? `${old}\n\n${block}`
    : block;
}


function existingColumns(
  row: DbRow | undefined,
) {
  return new Set(
    Object.keys(
      row
      ?? {},
    ),
  );
}


function setIfColumn(
  target: DbRow,
  columns: Set<string>,
  key: string,
  value: unknown,
) {
  if (
    columns.has(
      key,
    )
    &&
    value !== undefined
  ) {
    target[key] =
      value;
  }
}


function setIfEmpty(
  target: DbRow,
  row: DbRow,
  columns: Set<string>,
  key: string,
  value: unknown,
  conflicts: string[],
) {
  if (
    !columns.has(
      key,
    )
    ||
    !nonEmpty(
      value,
    )
  ) {
    return;
  }

  const existing =
    row[key];

  if (
    !nonEmpty(
      existing,
    )
  ) {
    target[key] =
      value;

    return;
  }

  if (
    normalize(
      existing,
    )
    !==
    normalize(
      value,
    )
  ) {
    conflicts.push(
      `${key}: CRM="${existing}" DRIVE="${value}"`,
    );
  }
}


function mergeArray(
  oldValue: unknown,
  values: string[],
) {
  const old =
    Array.isArray(
      oldValue,
    )
      ? oldValue
          .map(
            String,
          )
      : [];

  return [
    ...new Set([
      ...old,
      ...values,
    ]),
  ];
}


/* =========================================================
   MAIN
   ========================================================= */

async function main() {
  const integrations =
    (
      await readIntegrationSecrets()
    ) as Record<
      string,
      any
    >;

  const supabase =
    integrations
      ?.supabase;

  if (
    !supabase?.url
    ||
    !supabase?.serviceRoleKey
  ) {
    throw new Error(
      "SUPABASE_INTEGRATION_MISSING",
    );
  }

  process.env.SUPABASE_URL =
    String(
      supabase.url,
    );

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    String(
      supabase.serviceRoleKey,
    );


  console.log(
    `MODE=${APPLY ? "APPLY" : "DRY_RUN"}`,
  );

  console.log(
    `COMPANY_ID=${COMPANY_ID}`,
  );


  const providers =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_providers",

      query:
        `?select=*&company_id=eq.${enc(
          COMPANY_ID,
        )}`,
    });


  const profiles =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_provider_profiles",

      query:
        `?select=*&company_id=eq.${enc(
          COMPANY_ID,
        )}`,
    });


  const histories =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_entity_history",

      query:
        `?select=*&company_id=eq.${enc(
          COMPANY_ID,
        )}&limit=1`,
    });


  console.log(
    `PROVIDERS=${providers.length}`,
  );

  console.log(
    `PROFILES=${profiles.length}`,
  );


  const providerColumns =
    existingColumns(
      providers[0],
    );

  const profileColumns =
    existingColumns(
      profiles[0],
    );

  const historyColumns =
    existingColumns(
      histories[0],
    );


  const profileMap =
    new Map(
      profiles.map(
        profile => [
          String(
            profile.provider_id,
          ),
          profile,
        ],
      ),
    );


  const matches:
    {
      seed: VerifiedSeed;
      provider: DbRow;
      profile?: DbRow;
      providerPatch: DbRow;
      profilePatch: DbRow;
      conflicts: string[];
    }[] = [];


  const notFound:
    string[] = [];

  const ambiguous:
    string[] = [];


  for (
    const seed
    of verified
  ) {
    const aliases =
      new Set(
        seed.aliases.map(
          normalize,
        ),
      );


    if (
      seed.canonicalName
    ) {
      aliases.add(
        normalize(
          seed.canonicalName,
        ),
      );
    }


    const candidates =
      providers.filter(
        provider =>
          aliases.has(
            normalize(
              provider.name,
            ),
          ),
      );


    if (
      candidates.length === 0
    ) {
      notFound.push(
        seed.key,
      );

      console.log(
        `NOT_FOUND ${seed.key}`,
      );

      continue;
    }


    if (
      candidates.length > 1
    ) {
      ambiguous.push(
        seed.key,
      );

      console.log(
        `AMBIGUOUS ${seed.key} count=${candidates.length}`,
      );

      continue;
    }


    const provider =
      candidates[0];

    const profile =
      profileMap.get(
        String(
          provider.id,
        ),
      );


    const providerPatch:
      DbRow = {};

    const profilePatch:
      DbRow = {};

    const conflicts:
      string[] = [];


    /* ======================================================
       PROVIDER FIELDS
       ====================================================== */

    if (
      seed.canonicalName
      &&
      normalize(
        provider.name,
      )
      !==
      normalize(
        seed.canonicalName,
      )
    ) {
      setIfColumn(
        providerPatch,
        providerColumns,
        "name",
        seed.canonicalName,
      );
    }


    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "contact_name",
      seed.contactName,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "phone",
      seed.phone,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "whatsapp",
      seed.whatsapp,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "email",
      seed.email,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "city",
      seed.city,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "province",
      seed.province,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "address",
      seed.address,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "postal_code",
      seed.postalCode,
      conflicts,
    );

    setIfEmpty(
      providerPatch,
      provider,
      providerColumns,
      "website",
      seed.website,
      conflicts,
    );


    /* ======================================================
       PROFILE
       ====================================================== */

    const currentProfile =
      profile
      ?? {};


    if (
      profileColumns.has(
        "provider_type",
      )
    ) {
      profilePatch.provider_type =
        seed.providerType;
    }


    if (
      profileColumns.has(
        "service_categories",
      )
    ) {
      profilePatch.service_categories =
        seed.replaceCategories
          ? seed.serviceCategories
          : mergeArray(
              currentProfile
                .service_categories,
              seed.serviceCategories,
            );
    }


    if (
      profileColumns.has(
        "factual_notes",
      )
    ) {
      profilePatch.factual_notes =
        appendText(
          currentProfile
            .factual_notes,
          seed.factualNotes,
        );
    }


    if (
      seed.commercialRelationship
      &&
      profileColumns.has(
        "commercial_relationship",
      )
    ) {
      profilePatch.commercial_relationship =
        seed.commercialRelationship;
    }


    if (
      seed.commercialRelationship
      &&
      profileColumns.has(
        "relationship",
      )
      &&
      !profileColumns.has(
        "commercial_relationship",
      )
    ) {
      profilePatch.relationship =
        seed.commercialRelationship;
    }


    if (
      seed.commercialConditions
      &&
      profileColumns.has(
        "commercial_conditions",
      )
    ) {
      profilePatch.commercial_conditions = {
        ...(
          currentProfile
            .commercial_conditions
          &&
          typeof currentProfile
            .commercial_conditions
            === "object"
            ? currentProfile
                .commercial_conditions
            : {}
        ),

        ...seed
          .commercialConditions,
      };
    }


    if (
      profileColumns.has(
        "source_metadata",
      )
    ) {
      const existing =
        currentProfile
          .source_metadata
        &&
        typeof currentProfile
          .source_metadata
          === "object"
          ? currentProfile
              .source_metadata
          : {};


      profilePatch.source_metadata = {
        ...existing,

        verified_drive_sync: {
          verified_at:
            "2026-09-29",

          folder_id:
            seed.sourceFolderId
            ?? null,

          file_ids:
            seed.sourceFileIds,

          verification:
            "Direct manual review of Google Drive source by assistant.",
        },
      };
    }


    if (
      profileColumns.has(
        "factual_summary",
      )
      &&
      !nonEmpty(
        currentProfile
          .factual_summary,
      )
    ) {
      profilePatch.factual_summary =
        `${seed.canonicalName ?? provider.name}: información factual verificada desde Google Drive.`;
    }


    matches.push({
      seed,
      provider,
      profile,
      providerPatch,
      profilePatch,
      conflicts,
    });
  }


  /* ========================================================
     BACKUP
     ======================================================== */

  const backup = {
    generated_at:
      new Date()
        .toISOString(),

    providers:
      matches.map(
        item =>
          item.provider,
      ),

    profiles:
      matches
        .map(
          item =>
            item.profile,
        )
        .filter(
          Boolean,
        ),
  };


  const backupFile =
    path.join(
      "/var/www/control/backups/provider-verified-sync",
      `before-${Date.now()}.json`,
    );


  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      backup,
      null,
      2,
    ),
  );


  console.log(
    `BACKUP=${backupFile}`,
  );


  /* ========================================================
     REPORT DRY RUN
     ======================================================== */

  const reportFile =
    path.join(
      "/var/www/control/reports/provider-verified-sync",
      `report-${Date.now()}-${APPLY ? "apply" : "dry-run"}.json`,
    );


  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        apply:
          APPLY,

        matched:
          matches.map(
            item => ({
              key:
                item.seed.key,

              provider_id:
                item.provider.id,

              current_name:
                item.provider.name,

              provider_patch:
                item.providerPatch,

              profile_patch:
                item.profilePatch,

              conflicts:
                item.conflicts,

              source_folder:
                item.seed.sourceFolderId,

              source_files:
                item.seed.sourceFileIds,
            }),
          ),

        not_found:
          notFound,

        ambiguous,
      },
      null,
      2,
    ),
  );


  console.log(
    `REPORT=${reportFile}`,
  );


  console.log("");
  console.log(
    "============= PLAN =============",
  );

  console.log(
    `VERIFIED_SEEDS=${verified.length}`,
  );

  console.log(
    `MATCHED=${matches.length}`,
  );

  console.log(
    `NOT_FOUND=${notFound.length}`,
  );

  console.log(
    `AMBIGUOUS=${ambiguous.length}`,
  );

  console.log(
    `CONFLICTS=${matches.reduce(
      (
        total,
        item,
      ) =>
        total
        +
        item.conflicts.length,
      0,
    )}`,
  );


  for (
    const item
    of matches
  ) {
    console.log("");
    console.log(
      `--- ${item.provider.name} ---`,
    );

    console.log(
      "PROVIDER_PATCH=",
      JSON.stringify(
        item.providerPatch,
      ),
    );

    console.log(
      "PROFILE_TYPE=",
      item.profilePatch
        .provider_type,
    );

    console.log(
      "CATEGORIES=",
      JSON.stringify(
        item.profilePatch
          .service_categories,
      ),
    );

    if (
      item.conflicts.length
    ) {
      console.log(
        "CONFLICTS=",
        JSON.stringify(
          item.conflicts,
        ),
      );
    }
  }


  if (
    !APPLY
  ) {
    console.log("");
    console.log(
      "DRY_RUN_COMPLETE=1",
    );

    return;
  }


  /* ========================================================
     APPLY
     ======================================================== */

  let updated =
    0;

  let profilesCreated =
    0;

  let failed =
    0;

  let historyCreated =
    0;


  for (
    const item
    of matches
  ) {
    try {
      const providerId =
        String(
          item.provider.id,
        );


      if (
        Object.keys(
          item.providerPatch,
        ).length
      ) {
        await supabaseRequest({
          table:
            "crm_providers",

          method:
            "PATCH",

          query:
            `?id=eq.${enc(
              providerId,
            )}`,

          body:
            item.providerPatch,
        });
      }


      if (
        item.profile
      ) {
        if (
          Object.keys(
            item.profilePatch,
          ).length
        ) {
          await supabaseRequest({
            table:
              "crm_provider_profiles",

            method:
              "PATCH",

            query:
              `?provider_id=eq.${enc(
                providerId,
              )}`,

            body:
              item.profilePatch,
          });
        }
      }
      else {
        const body:
          DbRow = {
          company_id:
            COMPANY_ID,

          provider_id:
            providerId,
        };


        for (
          const [
            key,
            value,
          ]
          of Object.entries(
            item.profilePatch,
          )
        ) {
          if (
            profileColumns.has(
              key,
            )
          ) {
            body[key] =
              value;
          }
        }


        await supabaseRequest({
          table:
            "crm_provider_profiles",

          method:
            "POST",

          body,
        });


        profilesCreated++;
      }


      /* ----------------------------------------------------
         HISTORY — only once per provider/key
         ---------------------------------------------------- */

      try {
        const title =
          `Drive verificado: ${item.seed.key}`;


        const oldHistory =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_entity_history",

            query:
              [
                `?select=id`,
                `company_id=eq.${enc(
                  COMPANY_ID,
                )}`,
                `provider_id=eq.${enc(
                  providerId,
                )}`,
                `history_type=eq.drive_verified_enrichment`,
                `title=eq.${enc(
                  title,
                )}`,
                `limit=1`,
              ].join(
                "&",
              ),
          });


        if (
          oldHistory.length
          === 0
        ) {
          const body:
            DbRow = {};


          setIfColumn(
            body,
            historyColumns,
            "company_id",
            COMPANY_ID,
          );

          setIfColumn(
            body,
            historyColumns,
            "entity_type",
            "provider",
          );

          setIfColumn(
            body,
            historyColumns,
            "provider_id",
            providerId,
          );

          setIfColumn(
            body,
            historyColumns,
            "history_type",
            "drive_verified_enrichment",
          );

          setIfColumn(
            body,
            historyColumns,
            "title",
            title,
          );

          setIfColumn(
            body,
            historyColumns,
            "description",
            "Datos del proveedor revisados directamente contra sus fuentes originales de Google Drive.",
          );

          setIfColumn(
            body,
            historyColumns,
            "confidence",
            "source",
          );

          setIfColumn(
            body,
            historyColumns,
            "metadata",
            {
              source:
                "google_drive_verified",

              folder_id:
                item.seed
                  .sourceFolderId
                ?? null,

              file_ids:
                item.seed
                  .sourceFileIds,

              provider_patch:
                item
                  .providerPatch,
            },
          );


          await supabaseRequest({
            table:
              "crm_entity_history",

            method:
              "POST",

            body,
          });


          historyCreated++;
        }
      }
      catch (
        historyError
      ) {
        console.warn(
          `HISTORY_WARNING ${item.seed.key}`,
          historyError,
        );
      }


      updated++;

      console.log(
        `UPDATED_OK ${item.seed.key}`,
      );
    }
    catch (
      error
    ) {
      failed++;

      console.error(
        `UPDATED_FAIL ${item.seed.key}`,
        error,
      );
    }
  }


  console.log("");
  console.log(
    "============= RESULTADO =============",
  );

  console.log(
    `UPDATED=${updated}`,
  );

  console.log(
    `PROFILES_CREATED=${profilesCreated}`,
  );

  console.log(
    `HISTORY_CREATED=${historyCreated}`,
  );

  console.log(
    `FAILED=${failed}`,
  );

  console.log(
    `NOT_FOUND=${notFound.length}`,
  );

  console.log(
    `AMBIGUOUS=${ambiguous.length}`,
  );

  console.log(
    `APPLY_COMPLETE=${failed === 0 ? 1 : 0}`,
  );
}


main()
  .catch(
    error => {
      console.error(
        "FATAL",
        error,
      );

      process.exitCode =
        1;
    },
  );
