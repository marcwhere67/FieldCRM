'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search, Plus, Download, Upload,
  Phone, Mail, MapPin, MoreHorizontal, Users
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  lead:     { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  prospect: { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  active:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  inactive: { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  archived: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
  { bg: 'rgba(217,119,6,0.08)',   color: '#b45309' },
]

const SOURCE_LABELS: Record<string, string> = {
  facebook_ad: 'Facebook',
  google_ad: 'Google',
  referral: 'Referral',
  website_form: 'Website',
  manual: 'Manual',
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  suburb: string | null
  state: string | null
  status: string
  source: string | null
  tags: string[]
  lifetime_value: number
  last_contacted_at: string | null
  created_at: string
  users: { full_name: string }[] | { full_name: string } | null
  pipeline_stages: { name: string; color: string }[] | { name: string; color: string } | null
}

interface Props {
  contacts: Contact[]
  teamMembers: { id: string; full_name: string }[]
  campaigns: { id: string; name: string }[]
  userRole: string
  filters: { q?: string; status?: string; source?: string; assigned?: string; archived?: string }
  total?: number
}

export function ContactsTable({ contacts, teamMembers, campaigns, userRole, filters, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState(filters.q ?? '')
  const [bulkMenu, setBulkMenu] = useState<'assign' | 'campaign' | null>(null)

  function updateFilter(key: string, value: string | null) {
    const p = new URLSearchParams()
    if (filters.q) p.set('q', filters.q)
    if (filters.status) p.set('status', filters.status)
    if (filters.source) p.set('source', filters.source)
    if (filters.assigned) p.set('assigned', filters.assigned)
    if (filters.archived) p.set('archived', filters.archived)
    if (value && value !== 'all') { p.set(key, value) } else { p.delete(key) }
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  const viewingArchived = filters.archived === '1'

  async function handleRestore() {
    const n = selected.size
    const { error } = await supabase.from('contacts').update({ archived_at: null }).in('id', [...selected])
    if (error) { toast.error(`Failed to restore: ${error.message}`); return }
    toast.success(`Restored ${n} contact${n === 1 ? '' : 's'}`)
    setSelected(new Set())
    router.refresh()
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (filters.status) params.set('status', filters.status)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function toggleAll() {
    setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)))
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function handleAddTag() {
    const tag = window.prompt('Tag to add to selected contacts:')?.trim()
    if (!tag) return
    const ids = [...selected]
    for (const id of ids) {
      const contact = contacts.find(c => c.id === id)
      if (!contact || contact.tags.includes(tag)) continue
      await supabase.from('contacts').update({ tags: [...contact.tags, tag] }).eq('id', id)
    }
    toast.success(`Tag added to ${ids.length} contact${ids.length === 1 ? '' : 's'}`)
    setSelected(new Set())
    router.refresh()
  }

  async function handleAssign(userId: string) {
    setBulkMenu(null)
    const { error } = await supabase.from('contacts').update({ assigned_to: userId }).in('id', [...selected])
    if (error) { toast.error('Failed to assign contacts'); return }
    toast.success(`Assigned ${selected.size} contact${selected.size === 1 ? '' : 's'}`)
    setSelected(new Set())
    router.refresh()
  }

  async function handleAddToCampaign(campaignId: string) {
    setBulkMenu(null)
    const { error } = await supabase.from('contacts').update({ source_campaign_id: campaignId }).in('id', [...selected])
    if (error) { toast.error('Failed to add contacts to campaign'); return }
    toast.success(`Added ${selected.size} contact${selected.size === 1 ? '' : 's'} to campaign`)
    setSelected(new Set())
    router.refresh()
  }

  async function handleDelete() {
    const n = selected.size
    if (!confirm(`Delete ${n} contact${n === 1 ? '' : 's'}? Contacts with quotes, jobs or invoices are archived (hidden but kept); leads with no history are permanently deleted.`)) return
    const res = await fetch('/api/contacts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(result.error ?? 'Failed to delete contacts'); return }
    const parts = []
    if (result.deleted) parts.push(`${result.deleted} deleted`)
    if (result.archived) parts.push(`${result.archived} archived (had history)`)
    toast.success(parts.join(' · ') || 'Done')
    setSelected(new Set())
    router.refresh()
  }

  const hasFilters = filters.q || filters.status || filters.source || filters.assigned

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Header */}
      <div className="flex items-end justify-between pb-5" style={{ borderBottom: '1px solid rgba(44,62,80,0.1)' }}>
        <div>
          <p style={{ color: '#76A58F', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Directory</p>
          <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50' }} className="text-3xl font-light">Contacts</h1>
          <p style={{ color: '#8A9BA6' }} className="text-xs mt-1">
            {(total ?? contacts.length)} total
            {(total ?? 0) > contacts.length && <> · showing most recent {contacts.length}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', backgroundColor: '#fff', letterSpacing: '0.08em' }} className="text-xs uppercase font-normal">
            <Upload className="w-3.5 h-3.5 mr-1.5" />Import
          </Button>
          <Button variant="outline" size="sm" style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', backgroundColor: '#fff', letterSpacing: '0.08em' }} className="text-xs uppercase font-normal">
            <Download className="w-3.5 h-3.5 mr-1.5" />Export
          </Button>
          <Link href="/contacts/new">
            <Button size="sm" style={{ backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em' }} className="text-xs uppercase font-normal">
              <Plus className="w-3.5 h-3.5 mr-1.5" />New Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#1C2A35' }}
            className="pl-9 text-sm placeholder:text-[#8A9BA6]"
          />
        </form>

        {[
          { key: 'status', value: filters.status ?? 'all', placeholder: 'all', options: [
            { value: 'all', label: 'All statuses' },
            { value: 'lead', label: 'Lead' },
            { value: 'prospect', label: 'Prospect' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'archived', label: 'Archived' },
          ]},
          { key: 'source', value: filters.source ?? 'all', placeholder: 'all', options: [
            { value: 'all', label: 'All sources' },
            { value: 'facebook_ad', label: 'Facebook' },
            { value: 'google_ad', label: 'Google' },
            { value: 'referral', label: 'Referral' },
            { value: 'website_form', label: 'Website' },
            { value: 'manual', label: 'Manual' },
          ]},
        ].map(f => (
          <Select key={f.key} value={f.value} onValueChange={v => updateFilter(f.key, v)}>
            <SelectTrigger style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65' }} className="w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
              {f.options.map(o => (
                <SelectItem key={o.value} value={o.value} style={{ color: '#1C2A35' }} className="text-sm">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        <Select value={filters.assigned ?? 'all'} onValueChange={v => updateFilter('assigned', v)}>
          <SelectTrigger style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65' }} className="w-40 text-sm">
            <SelectValue placeholder="All team" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
            <SelectItem value="all" style={{ color: '#1C2A35' }} className="text-sm">All team</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.id} value={m.id} style={{ color: '#1C2A35' }} className="text-sm">{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            style={{ color: '#8A9BA6' }}
            className="text-xs hover:text-[#2C3E50] transition-colors px-2"
            onClick={() => { setSearch(''); startTransition(() => router.push(pathname)) }}
          >
            Clear
          </button>
        )}

        <button
          style={{ color: viewingArchived ? '#2C3E50' : '#8A9BA6' }}
          className="text-xs hover:text-[#2C3E50] transition-colors px-2 ml-auto"
          onClick={() => startTransition(() => router.push(viewingArchived ? pathname : `${pathname}?archived=1`))}
        >
          {viewingArchived ? '← Back to active' : 'View archived'}
        </button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: 'rgba(118,165,143,0.08)', border: '1px solid rgba(118,165,143,0.2)' }}>
          <span style={{ color: '#5d8c76' }} className="text-xs">{selected.size} selected</span>
          <button onClick={handleAddTag} style={{ color: '#5d8c76' }} className="text-xs hover:text-[#2C3E50] transition-colors">Add tag</button>

          <DropdownMenu open={bulkMenu === 'assign'} onOpenChange={o => setBulkMenu(o ? 'assign' : null)}>
            <DropdownMenuTrigger>
              <div style={{ color: '#5d8c76' }} className="text-xs hover:text-[#2C3E50] transition-colors cursor-pointer">Assign</div>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
              {teamMembers.map(m => (
                <DropdownMenuItem key={m.id} onClick={() => handleAssign(m.id)} style={{ color: '#1C2A35' }} className="text-sm">{m.full_name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu open={bulkMenu === 'campaign'} onOpenChange={o => setBulkMenu(o ? 'campaign' : null)}>
            <DropdownMenuTrigger>
              <div style={{ color: '#5d8c76' }} className="text-xs hover:text-[#2C3E50] transition-colors cursor-pointer">Add to campaign</div>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
              {campaigns.length === 0 && <DropdownMenuItem disabled style={{ color: '#8A9BA6' }} className="text-sm">No campaigns yet</DropdownMenuItem>}
              {campaigns.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => handleAddToCampaign(c.id)} style={{ color: '#1C2A35' }} className="text-sm">{c.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {viewingArchived ? (
            <button onClick={handleRestore} style={{ color: '#5d8c76' }} className="text-xs hover:text-[#2C3E50] transition-colors ml-auto">Restore</button>
          ) : userRole === 'admin' && (
            <button onClick={handleDelete} style={{ color: '#dc2626' }} className="text-xs hover:opacity-70 transition-opacity ml-auto">Delete</button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid rgba(44,62,80,0.1)', boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.06)' }} className="overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(44,62,80,0.1)', backgroundColor: '#F5F0EB' }}>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === contacts.length && contacts.length > 0}
                    onChange={toggleAll}
                    style={{ accentColor: '#76A58F' }}
                  />
                </th>
                {['Name', 'Contact', 'Location', 'Status', 'Source', 'Assigned', 'Value', ''].map((h, i) => (
                  <th key={i} style={{ color: '#8A9BA6', letterSpacing: '0.15em' }}
                    className={`text-left px-4 py-3 text-[9px] uppercase font-normal ${i === 1 ? 'hidden md:table-cell' : ''} ${i === 2 ? 'hidden lg:table-cell' : ''} ${[4,5].includes(i) ? 'hidden xl:table-cell' : ''} ${i === 6 ? 'text-right hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isPending ? 'opacity-50 pointer-events-none' : ''}>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
                      <p style={{ color: '#8A9BA6' }} className="text-xs">No contacts found</p>
                      <Link href="/contacts/new">
                        <button style={{ color: '#76A58F', letterSpacing: '0.1em' }} className="text-[10px] uppercase hover:opacity-70 transition-opacity mt-1">
                          Add your first contact →
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : contacts.map((contact, i) => {
                const initials = `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase()
                const name = `${contact.first_name} ${contact.last_name}`
                const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
                const badge = STATUS_BADGE[contact.status] ?? STATUS_BADGE.inactive
                const isSelected = selected.has(contact.id)
                return (
                  <tr
                    key={contact.id}
                    style={{
                      backgroundColor: isSelected ? 'rgba(118,165,143,0.06)' : i % 2 === 0 ? '#fff' : '#FAFAF8',
                      borderBottom: '1px solid rgba(44,62,80,0.06)',
                    }}
                    className="group transition-colors hover:bg-[#F0EDE8]"
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(contact.id)}
                        style={{ accentColor: '#76A58F' }}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.color, width: 30, height: 30, flexShrink: 0 }}
                          className="flex items-center justify-center text-[11px] font-medium"
                        >
                          {initials}
                        </div>
                        <div>
                          <p style={{ color: '#1C2A35' }} className="font-medium text-sm group-hover:text-[#2C3E50] transition-colors">{name}</p>
                          {contact.company_name && (
                            <p style={{ color: '#8A9BA6' }} className="text-xs">{contact.company_name}</p>
                          )}
                          {contact.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {contact.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ color: '#4A5A65', backgroundColor: '#EDE8E2', fontSize: '10px', letterSpacing: '0.05em' }} className="px-1.5 py-px">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-1">
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4A5A65' }}>
                            <Phone className="w-3 h-3" style={{ color: '#8A9BA6' }} />
                            {contact.phone}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4A5A65' }}>
                            <Mail className="w-3 h-3" style={{ color: '#8A9BA6' }} />
                            <span className="truncate max-w-40">{contact.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 hidden lg:table-cell">
                      {contact.suburb && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4A5A65' }}>
                          <MapPin className="w-3 h-3" style={{ color: '#8A9BA6' }} />
                          {contact.suburb}, {contact.state}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, letterSpacing: '0.08em' }}
                        className="inline-flex items-center px-2 py-0.5 text-[9px] uppercase font-normal"
                      >
                        {contact.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span style={{ color: '#8A9BA6' }} className="text-xs">
                        {contact.source ? (SOURCE_LABELS[contact.source] ?? contact.source) : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span style={{ color: '#4A5A65' }} className="text-xs">
                        {contact.users
                          ? (Array.isArray(contact.users) ? contact.users[0]?.full_name : contact.users.full_name)
                          : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50' }} className="text-base font-normal">
                        {contact.lifetime_value > 0 ? formatCurrency(contact.lifetime_value) : <span style={{ color: '#8A9BA6' }} className="text-xs font-sans">—</span>}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="w-7 h-7 flex items-center justify-center transition-colors hover:bg-[#EDE8E2]" style={{ color: '#8A9BA6' }}>
                            <MoreHorizontal className="w-4 h-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)', borderRadius: 0 }} className="shadow-lg">
                          {['View record', 'Send message', 'New quote', 'Book job'].map(item => (
                            <DropdownMenuItem
                              key={item}
                              style={{ color: '#1C2A35', fontSize: '13px' }}
                              className="cursor-pointer hover:bg-[#F5F0EB]"
                              onClick={item === 'View record' ? () => router.push(`/contacts/${contact.id}`) : undefined}
                            >
                              {item}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
