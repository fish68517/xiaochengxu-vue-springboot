export interface Product {
  id: number
  name: string
  category: '爬宠' | '用品' | '套餐'
  subtitle: string
  price: string
  original_price: string | null
  sales: number
  stock: number
  image_key: string
  badge: string | null
  tags: string[]
  species: string | null
  age: string | null
  health: string | null
  size: string | null
  gender: string | null
  care_advice: string | null
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
  prizes: Array<{ level: string; name: string; quantity: number; icon: string }>
  rules: string[]
  joined: boolean
}

export interface LotteryResult {
  activity_id: number
  title: string
  status: string
  draw_at: string
  participant_count: number
  my_result: { won: boolean; message: string; points: number }
  winners: Array<{ nickname: string; level: string; prize: string }>
  prizes: LotteryActivity['prizes']
}

export interface Order {
  id: number
  order_no: string
  product_id: number
  product_name: string
  unit_price: string
  quantity: number
  discount: string
  shipping_fee: string
  total_amount: string
  status: string
}

export interface Profile {
  nickname: string
  level: number
  points: number
  coupons: number
  favorites: number
  pets: Array<{ name: string; age: string; health: string; imageKey: string }>
  reminders: Array<{ pet: string; task: string; time: string }>
  order_counts: Record<string, number>
}
