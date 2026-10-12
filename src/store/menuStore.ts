import { create } from "zustand"
import type { ReactNode } from "react"

export interface MenuItem {
  id: string
  label?: string
  icon?: ReactNode
  onSelect?: () => void
  disabled?: boolean
  separator?: boolean
  danger?: boolean
  checked?: boolean
  shortcut?: string
  children?: MenuItem[]
}

interface MenuStore {
  open: boolean
  x: number
  y: number
  items: MenuItem[]
  title?: string
  show: (
    point: { clientX: number; clientY: number },
    items: MenuItem[],
    title?: string,
  ) => void
  hide: () => void
}

export const useMenuStore = create<MenuStore>()((set) => ({
  open: false,
  x: 0,
  y: 0,
  items: [],
  title: undefined,
  show: ({ clientX, clientY }, items, title) =>
    set({ open: true, x: clientX, y: clientY, items, title }),
  hide: () => set({ open: false, items: [], title: undefined }),
}))