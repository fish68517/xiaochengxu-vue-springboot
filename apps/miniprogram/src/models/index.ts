export interface User {
  id: number
  username: string
  nickname: string
  role: 'USER' | 'ADMIN'
  enabled: boolean
  level: number
  points: number
}

export interface Category {
  id: number
  name: string
  sort_order: number
  enabled: boolean
}

export interface Product {
  id: number
  category_id: number | null
  name: string
  category: string
  subtitle: string
  price: string
  original_price: string | null
  sales: number
  stock: number
  image_key: string
  cover_url: string | null
  detail_images: string[]
  badge: string | null
  tags: string[]
  species: string | null
  age: string | null
  health: string | null
  size: string | null
  gender: string | null
  care_advice: string | null
  is_active: boolean
}

export interface CartItem {
  id: number
  quantity: number
  product: Product
  line_amount: string
}

export interface Address {
  id: number
  receiver_name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  is_default: boolean
}

export interface Coupon {
  user_coupon_id: number
  coupon_id: number
  name: string
  threshold_amount: string
  discount_amount: string
  end_at: string
  status: string
}

export interface OrderPreviewItem {
  cart_item_id: number
  product_id: number
  product_name: string
  image_key: string
  cover_url: string | null
  unit_price: string
  quantity: number
  line_amount: string
}

export interface OrderPreview {
  items: OrderPreviewItem[]
  address: Address
  subtotal: string
  discount: string
  shipping_fee: string
  total_amount: string
  user_coupon_id: number | null
}

export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  product_image_url: string | null
  unit_price: string
  quantity: number
  line_amount: string
}

export interface Order {
  id: number
  order_no: string
  user_id: number
  product_id: number
  product_name: string
  unit_price: string
  quantity: number
  discount: string
  shipping_fee: string
  total_amount: string
  status: string
  payment_status: string
  address_name: string
  address_phone: string
  address_detail: string
  remark: string | null
  created_at: string
  paid_at: string | null
  shipping_company: string | null
  tracking_no: string | null
  shipped_at: string | null
  items: OrderItem[]
}

export interface Payment {
  id: number
  payment_no: string
  order_id: number
  provider: string
  amount: string
  status: string
  provider_transaction_id: string | null
  confirmed_at: string | null
  created_at: string
}

export interface LotteryActivity {
  id: number
  title: string
  subtitle: string
  registration_start_at: string
  registration_end_at: string
  draw_at: string
  status: string
  participant_count: number
  prizes: Array<{ id?: number; level: string; name: string; quantity: number; icon: string }>
  rules: string[]
  joined: boolean
}

export interface LotteryResult {
  activity_id: number
  title: string
  status: string
  draw_at: string
  participant_count: number
  my_result: { won: boolean; message: string; points: number; prize?: string }
  winners: Array<{ nickname: string; level: string; prize: string }>
  prizes: LotteryActivity['prizes']
}

export interface Profile {
  id: number
  username: string
  nickname: string
  level: number
  points: number
  coupon_count: number
  favorite_count: number
  order_counts: Record<string, number>
}
