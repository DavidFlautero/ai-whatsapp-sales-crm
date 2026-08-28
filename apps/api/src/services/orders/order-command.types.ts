export type OrderCommandDomain =
  | "order_query"
  | "order_create"
  | "order_modify"
  | "order_cancel"
  | "payment"
  | "catalog"
  | "conversation"
  | "unknown";

export type OrderCommandAction =
  | "add_item"
  | "increase_quantity"
  | "set_quantity"
  | "decrease_quantity"
  | "remove_item"
  | "replace_variant"
  | "confirm"
  | "reject"
  | "correct_pending_action"
  | "select_order"
  | "request_clarification"
  | "unknown";

export type RelativeOrderReference =
  | "active"
  | "latest"
  | "today"
  | "yesterday"
  | "cancelled"
  | "pending_payment";

export type SemanticProductReference = {
  name?: string;
  category?: string;
  sku?: string;
  color?: string;
  size?: string;

  /**
   * Referencias como:
   * - ese
   * - esos
   * - el anterior
   * - los negros
   * - el que te dije
   */
  contextualReference?: string;
};

export type SemanticOrderReference = {
  number?: string;
  relative?: RelativeOrderReference;
  contextualReference?: string;
};

export type InterpretedOrderCommand = {
  domain: OrderCommandDomain;
  action: OrderCommandAction;

  orderReference?: SemanticOrderReference;

  currentProduct?: SemanticProductReference;
  replacementProduct?: SemanticProductReference;

  /**
   * Cantidad absoluta o cantidad involucrada en la operación.
   */
  quantity?: number;

  /**
   * Para frases como:
   * - tres más
   * - sacame dos
   */
  quantityMode?:
    | "absolute"
    | "increment"
    | "decrement"
    | "all"
    | "unspecified";

  /**
   * Texto corto que resume lo que la IA entendió.
   * Sólo para diagnóstico y confirmación, nunca para ejecutar.
   */
  interpretation: string;

  /**
   * Entre 0 y 1.
   */
  confidence: number;

  requiresClarification: boolean;

  clarificationReason?: string;
  clarificationQuestion?: string;

  /**
   * true cuando la frase depende de mensajes anteriores:
   * "sumale tres más", "cambialos por 40", etc.
   */
  usesConversationContext: boolean;

  /**
   * true cuando parece estar corrigiendo una acción pendiente:
   * "no, mejor en 40", "en realidad eran tres".
   */
  correctsPendingAction: boolean;
};

export type OrderInterpreterContext = {
  companyId: string;
  phone: string;

  message: string;
  conversationHistory: string;

  pendingWorkflow?: {
    status?: string;
    summary?: string;
    orderNumber?: string;
    operations?: unknown[];
  } | null;

  activeOrders: Array<{
    id: string;
    number: string;
    version: number;
    commercialStatus: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    reservationStatus: string;

    items: Array<{
      id: string;
      productName?: string;
      sku?: string;
      color?: string;
      size?: string;
      quantity: number;
    }>;
  }>;

  catalog: Array<{
    productId: string;
    variantId?: string;
    sku: string;
    name: string;
    category?: string;
    color?: string;
    size?: string;
    stock: number;
    price: number;
    currency: string;
  }>;
};
