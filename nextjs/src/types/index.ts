export type UserRole = 'angel' | 'family_office'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  firmName: string
  aum?: string
  sectors: string[]
  stages: string[]
  geography: string[]
  checkSizeMin: number
  checkSizeMax: number
  createdAt: string
  updatedAt: string
}

export interface Candidate {
  id: string
  role: UserRole
  firmName: string
  aum?: string
  sectors: string[]
  stages: string[]
  geography: string[]
  checkSizeMin: number
  checkSizeMax: number
  bio: string
  linkedinUrl?: string
  isVerified: boolean
}

export interface MatchScore {
  total: number
  sector: number
  stage: number
  checkSize: number
  geography: number
  label: 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Low Fit'
}

export interface Deal {
  id: string
  title: string
  status: 'open' | 'closing' | 'closed'
  targetAmount: number
  committedAmount: number
  participants: string[]
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: 'new_match' | 'deal_update' | 'message' | 'document'
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}
