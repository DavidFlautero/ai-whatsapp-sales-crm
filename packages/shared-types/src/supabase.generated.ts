export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      commerce_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      commerce_business_settings: {
        Row: {
          allow_partial_payments: boolean
          company_id: string
          created_at: string
          currency: string
          metadata: Json
          order_prefix: string
          require_payment_before_picking: boolean
          reservation_hours: number
          updated_at: string
        }
        Insert: {
          allow_partial_payments?: boolean
          company_id: string
          created_at?: string
          currency?: string
          metadata?: Json
          order_prefix?: string
          require_payment_before_picking?: boolean
          reservation_hours?: number
          updated_at?: string
        }
        Update: {
          allow_partial_payments?: boolean
          company_id?: string
          created_at?: string
          currency?: string
          metadata?: Json
          order_prefix?: string
          require_payment_before_picking?: boolean
          reservation_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_business_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_companies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commerce_customers: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          company_id: string
          created_at: string
          customer_code: string | null
          customer_type: string
          email: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          province: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          customer_code?: string | null
          customer_type?: string
          email?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          province?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          customer_code?: string | null
          customer_type?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          province?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_fulfillment_scans: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          quantity: number
          sku: string
        }
        Insert: {
          action?: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          quantity?: number
          sku: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          quantity?: number
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_fulfillment_scans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_fulfillment_scans_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_fulfillment_scans_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "commerce_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_fulfillments: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          packing_completed_at: string | null
          packing_started_at: string | null
          picking_completed_at: string | null
          picking_started_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          packing_completed_at?: string | null
          packing_started_at?: string | null
          picking_completed_at?: string | null
          picking_started_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          packing_completed_at?: string | null
          packing_started_at?: string | null
          picking_completed_at?: string | null
          picking_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_fulfillments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_label_prints: {
        Row: {
          company_id: string
          id: string
          label_type: string
          metadata: Json
          order_id: string
          package_id: string | null
          print_count: number
          printed_at: string
          printed_by: string | null
          voided_at: string | null
        }
        Insert: {
          company_id: string
          id?: string
          label_type?: string
          metadata?: Json
          order_id: string
          package_id?: string | null
          print_count?: number
          printed_at?: string
          printed_by?: string | null
          voided_at?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          label_type?: string
          metadata?: Json
          order_id?: string
          package_id?: string | null
          print_count?: number
          printed_at?: string
          printed_by?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_label_prints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_label_prints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_label_prints_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "commerce_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_counters: {
        Row: {
          company_id: string
          last_value: number
          period: string
        }
        Insert: {
          company_id: string
          last_value?: number
          period: string
        }
        Update: {
          company_id?: string
          last_value?: number
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          company_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          order_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          order_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_items: {
        Row: {
          color_name_snapshot: string | null
          company_id: string
          cost_snapshot: number
          created_at: string
          discount_percent: number
          final_unit_price: number
          id: string
          metadata: Json
          order_id: string
          packed_quantity: number
          picked_quantity: number
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          size_snapshot: string | null
          sku_snapshot: string
          subtotal: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          color_name_snapshot?: string | null
          company_id: string
          cost_snapshot?: number
          created_at?: string
          discount_percent?: number
          final_unit_price: number
          id?: string
          metadata?: Json
          order_id: string
          packed_quantity?: number
          picked_quantity?: number
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          size_snapshot?: string | null
          sku_snapshot: string
          subtotal: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          color_name_snapshot?: string | null
          company_id?: string
          cost_snapshot?: number
          created_at?: string
          discount_percent?: number
          final_unit_price?: number
          id?: string
          metadata?: Json
          order_id?: string
          packed_quantity?: number
          picked_quantity?: number
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          size_snapshot?: string | null
          sku_snapshot?: string
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_items_company_order_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_order_items_company_product_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_order_items_company_variant_fkey"
            columns: ["company_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_orders: {
        Row: {
          commercial_status: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          discount: number
          fulfillment_status: string
          id: string
          notes: string | null
          number: string
          paid_amount: number
          payment_method: string | null
          payment_status: string
          price_list_code: string | null
          reservation_status: string
          shipping_address: string | null
          shipping_cost: number
          shipping_method: string | null
          source: string
          subtotal: number
          total: number
          tracking_token: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          commercial_status?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount?: number
          fulfillment_status?: string
          id?: string
          notes?: string | null
          number: string
          paid_amount?: number
          payment_method?: string | null
          payment_status?: string
          price_list_code?: string | null
          reservation_status?: string
          shipping_address?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          subtotal?: number
          total?: number
          tracking_token?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          commercial_status?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount?: number
          fulfillment_status?: string
          id?: string
          notes?: string | null
          number?: string
          paid_amount?: number
          payment_method?: string | null
          payment_status?: string
          price_list_code?: string | null
          reservation_status?: string
          shipping_address?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          source?: string
          subtotal?: number
          total?: number
          tracking_token?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commerce_orders_company_customer_fkey"
            columns: ["company_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "commerce_customers"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "commerce_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_packages: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          dimensions: string | null
          id: string
          label_token: string
          order_id: string
          package_number: number
          package_type: string | null
          total_packages: number
          weight_kg: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          dimensions?: string | null
          id?: string
          label_token?: string
          order_id: string
          package_number: number
          package_type?: string | null
          total_packages: number
          weight_kg?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          dimensions?: string | null
          id?: string
          label_token?: string
          order_id?: string
          package_number?: number
          package_type?: string | null
          total_packages?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_packages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_payments: {
        Row: {
          actor_id: string | null
          amount: number
          company_id: string
          created_at: string
          id: string
          metadata: Json
          method: string
          order_id: string
          reference: string | null
          status: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json
          method: string
          order_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          method?: string
          order_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_price_lists: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          currency: string
          customer_type: string | null
          id: string
          minimum_quantity: number
          name: string
          payment_method: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          currency?: string
          customer_type?: string | null
          id?: string
          minimum_quantity?: number
          name: string
          payment_method?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          currency?: string
          customer_type?: string | null
          id?: string
          minimum_quantity?: number
          name?: string
          payment_method?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_prices: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          price_list_id: string
          product_id: string
          variant_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_list_id: string
          product_id: string
          variant_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_list_id?: string
          product_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_prices_company_price_list_fkey"
            columns: ["company_id", "price_list_id"]
            isOneToOne: false
            referencedRelation: "commerce_price_lists"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_product_prices_company_product_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_product_prices_company_variant_fkey"
            columns: ["company_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "commerce_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_variants: {
        Row: {
          active: boolean
          barcode: string | null
          color_hex: string | null
          color_name: string | null
          company_id: string
          cost_override: number | null
          created_at: string
          id: string
          metadata: Json
          price_override: number | null
          product_id: string
          size: string | null
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          color_hex?: string | null
          color_name?: string | null
          company_id: string
          cost_override?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          price_override?: number | null
          product_id: string
          size?: string | null
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          color_hex?: string | null
          color_name?: string | null
          company_id?: string
          cost_override?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          price_override?: number | null
          product_id?: string
          size?: string | null
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_variants_company_product_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_products: {
        Row: {
          active: boolean
          base_sku: string
          category: string | null
          company_id: string
          cost: number
          created_at: string
          currency: string
          default_price: number
          description: string | null
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_sku: string
          category?: string | null
          company_id: string
          cost?: number
          created_at?: string
          currency?: string
          default_price?: number
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_sku?: string
          category?: string | null
          company_id?: string
          cost?: number
          created_at?: string
          currency?: string
          default_price?: number
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_reservation_items: {
        Row: {
          company_id: string
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          reservation_id: string
          stock_balance_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          reservation_id: string
          stock_balance_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          reservation_id?: string
          stock_balance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_reservation_items_company_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_company_order_item_fkey"
            columns: ["company_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "commerce_order_items"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_company_reservation_fkey"
            columns: ["company_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "commerce_reservations"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_company_stock_fkey"
            columns: ["company_id", "stock_balance_id"]
            isOneToOne: false
            referencedRelation: "commerce_stock_balances"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "commerce_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "commerce_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_reservation_items_stock_balance_id_fkey"
            columns: ["stock_balance_id"]
            isOneToOne: false
            referencedRelation: "commerce_stock_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_reservations: {
        Row: {
          company_id: string
          consumed_at: string | null
          converted_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          consumed_at?: string | null
          converted_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          consumed_at?: string | null
          converted_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_reservations_company_order_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_schema_migrations: {
        Row: {
          description: string
          installed_at: string
          version: string
        }
        Insert: {
          description: string
          installed_at?: string
          version: string
        }
        Update: {
          description?: string
          installed_at?: string
          version?: string
        }
        Relationships: []
      }
      commerce_shipments: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          delivered_at: string | null
          handed_to_carrier_at: string | null
          id: string
          metadata: Json
          order_id: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          delivered_at?: string | null
          handed_to_carrier_at?: string | null
          id?: string
          metadata?: Json
          order_id: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          handed_to_carrier_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_stock_balances: {
        Row: {
          available: number | null
          committed: number
          company_id: string
          id: string
          on_hand: number
          reorder_point: number
          reserved: number
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          available?: number | null
          committed?: number
          company_id: string
          id?: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          available?: number | null
          committed?: number
          company_id?: string
          id?: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_stock_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_stock_balances_company_variant_fkey"
            columns: ["company_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_stock_balances_company_warehouse_fkey"
            columns: ["company_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "commerce_warehouses"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_stock_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "commerce_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_stock_movements: {
        Row: {
          actor_id: string | null
          balance_after: number | null
          company_id: string
          created_at: string
          id: string
          metadata: Json
          movement_type: string
          order_id: string | null
          quantity: number
          reason: string | null
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          actor_id?: string | null
          balance_after?: number | null
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json
          movement_type: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          variant_id: string
          warehouse_id: string
        }
        Update: {
          actor_id?: string | null
          balance_after?: number | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          movement_type?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_company_order_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_company_variant_fkey"
            columns: ["company_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_company_warehouse_fkey"
            columns: ["company_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "commerce_warehouses"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "commerce_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_warehouses: {
        Row: {
          active: boolean
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "commerce_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commerce_create_order: {
        Args: {
          p_actor?: Json
          p_company_id: string
          p_customer: Json
          p_lines: Json
          p_options?: Json
        }
        Returns: Json
      }
      commerce_next_order_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      commerce_record_payment: {
        Args: {
          p_actor?: Json
          p_amount: number
          p_method: string
          p_order_id: string
          p_reference?: string
        }
        Returns: Json
      }
      commerce_release_expired_reservations: {
        Args: { p_limit?: number }
        Returns: number
      }
      commerce_transition_fulfillment: {
        Args: {
          p_action: string
          p_actor?: Json
          p_order_id: string
          p_payload?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
