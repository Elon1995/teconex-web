export type UserRole = 'client' | 'tasker' | 'both' | 'admin'
export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Profile {
  id: string
  full_name: string
  avatar_url?: string
  phone?: string
  whatsapp?: string
  zone?: string
  bio?: string
  role: UserRole
  tier: Tier
  completion_rate: number
  avg_rating: number
  total_reviews: number
  total_completed: number
  is_verified: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  image_url?: string
}

export interface Task {
  id: string
  poster_id: string
  title: string
  description?: string
  category_id?: string
  budget?: number
  location_text?: string
  location_zone?: string
  is_remote: boolean
  date_type: 'specific' | 'before' | 'flexible'
  task_date?: string
  images: string[]
  status: TaskStatus
  offers_count: number
  views_count: number
  created_at: string
  profiles?: Profile
  categories?: Category
}

export interface Offer {
  id: string
  task_id: string
  tasker_id: string
  price: number
  message?: string
  estimated_time?: string
  status: OfferStatus
  created_at: string
  profiles?: Profile
}

export const TIER_FEES: Record<Tier, number> = {
  bronze: 20,
  silver: 18.5,
  gold: 14.9,
  platinum: 12.5,
}
