import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'
import { useManagerAuth } from '../hooks/useManagerAuth'
import BudgetDisplay from './BudgetDisplay'
import { 
  Shield, 
  Plus, 
  Users, 
  X, 
  Save, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Wallet,
  Edit2,
  DollarSign
} from 'lucide-react'

function ClubRosters() {
  const [clubs, setClubs] = useState([])
  const [players, setPlayers] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedClub, setExpandedClub] = useState(null)
  const [showAddClub, setShowAddClub] = useState(false)
  const [showBudgetEdit, setShowBudgetEdit] = useState(null)
  const [editingBudgetValue, setEditingBudgetValue] = useState('')
  const { isAdmin } = useAuth()
  const { manager } = useManagerAuth()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: clubsData }, { data: playersData }, { data: budgetsData }] = await Promise.all([
      supabase.from('clubs').select('*').order('name'),
      supabase.from('players').select('*'),
      supabase.from('club_budgets').select('*')
    ])
    setClubs(clubsData || [])
    setPlayers(playersData || [])
    setBudgets(budgetsData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const subscription = supabase
      .channel('club_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_budgets' }, fetchData)
      .subscribe()
    return () => subscription.unsubscribe()
  }, [fetchData])

  const getClubPlayers = (clubName) => {
    return players.filter(p => p.club === clubName)
  }

  const getClubBudget = (clubName) => budgets.find(b => b.club_name === clubName)

  const handleAddClub = async (name) => {
    const { error } = await supabase.from('clubs').insert([{ name }])
    if (error) alert('Failed to create club')
    else {
      // Auto-init budget
      await supabase.from('club_budgets').upsert(
        { club_name: name, budget: 100000000, spent: 0, earned: 0 },
        { onConflict: 'club_name' }
      )
      setShowAddClub(false)
    }
  }

  const handleDeleteClub = async (id) => {
    if (!confirm('Delete this club? Players will become free agents.')) return
    const club = clubs.find(c => c.id === id)
    const { error } = await supabase.from('clubs').delete().eq('id', id)
    if (error) alert('Failed to delete club')
    else {
      if (club) {
        await supabase.from('club_budgets').delete().eq('club_name', club.name)
      }
    }
  }

  const handleBudgetEdit = async (budgetId) => {
    try {
      const { error } = await supabase
        .from('club_budgets')
        .update({ budget: parseInt(editingBudgetValue) })
        .eq('id', budgetId)
      if (error) throw error

      const budget = budgets.find(b => b.id === budgetId)
      await supabase.from('manager_logs').insert([{
        manager_username: 'Admin',
        club: budget?.club_name,
        action: 'budget_adjusted',
        amount: parseInt(editingBudgetValue),
        details: { type: 'admin_budget_edit', previous_budget: budget?.budget },
      }])

      setShowBudgetEdit(null)
      setEditingBudgetValue('')
    } catch (err) {
      alert('Failed to update budget: ' + err.message)
    }
  }

  // Manager view: only show their club
  const visibleClubs = manager && !isAdmin
    ? clubs.filter(c => c.name === manager.club)
    : clubs

  return (
    <div className="animate-fade-in">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '4px' }}>
            {manager && !isAdmin ? `${manager.club} - Squad` : 'Club Rosters'}
          </h2>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            {visibleClubs.length} clubs · {players.filter(p => p.club).length} players assigned
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddClub(true)}
            className="crf-btn crf-btn-primary"
          >
            <Plus size={18} />
            Create Club
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="crf-card">
              <div className="skeleton" style={{ height: '24px', width: '200px' }} />
            </div>
          ))}
        </div>
      ) : visibleClubs.length === 0 ? (
        <div className="crf-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: '#a0a0a0' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Clubs Yet</h3>
          <p style={{ color: '#a0a0a0' }}>Create your first club roster to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {visibleClubs.map(club => {
            const clubPlayers = getClubPlayers(club.name)
            const budget = getClubBudget(club.name)
            const isExpanded = expandedClub === club.id || (manager && !isAdmin)
            const isFull = clubPlayers.length >= 21

            return (
              <div key={club.id} className="crf-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Club Header */}
                <div
                  onClick={() => !manager || isAdmin ? setExpandedClub(isExpanded ? null : club.id) : null}
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: !manager || isAdmin ? 'pointer' : 'default',
                    background: isExpanded ? 'rgba(233, 69, 96, 0.05)' : 'transparent',
                    transition: 'background 0.2s',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '200px' }}>
                    {/* Club Logo */}
                    {club.logo_url ? (
                      <img
                        src={club.logo_url}
                        alt={club.name}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'contain',
                          background: 'white',
                          padding: '4px',
                          border: '2px solid #2a2a4a',
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #e94560, #c73e54)',
                      display: club.logo_url ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Shield size={24} color="white" />
                    </div>

                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '2px' }}>
                        {club.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#a0a0a0' }}>
                        <Users size={14} />
                        {clubPlayers.length}/21 players
                        {isFull && (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}>
                            FULL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Budget Display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {budget && (
                      <BudgetDisplay budget={budget.budget} spent={budget.spent} earned={budget.earned} compact />
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowBudgetEdit(budget); setEditingBudgetValue(String(budget?.budget || 100000000)) }}
                        className="crf-btn crf-btn-sm crf-btn-secondary"
                        style={{ padding: '6px' }}
                        title="Edit Budget"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClub(club.id) }}
                        className="crf-btn crf-btn-sm crf-btn-danger"
                        style={{ padding: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {(!manager || isAdmin) && (
                      isExpanded ? <ChevronUp size={20} color="#a0a0a0" /> : <ChevronDown size={20} color="#a0a0a0" />
                    )}
                  </div>
                </div>

                {/* Roster */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #2a2a4a', padding: '16px 24px' }}>
                    {/* Budget Full Display for expanded view */}
                    {budget && (
                      <div style={{ marginBottom: '20px' }}>
                        <BudgetDisplay budget={budget.budget} spent={budget.spent} earned={budget.earned} />
                      </div>
                    )}

                    {clubPlayers.length === 0 ? (
                      <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '20px' }}>
                        No players assigned to this club yet.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {clubPlayers.map(player => (
                          <div key={player.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            border: '1px solid #2a2a4a',
                          }}>
                            <img
                              src={player.roblox_avatar_url || `https://placehold.co/36x36/1e1e3f/666?text=${player.roblox_username?.charAt(0)}`}
                              alt={player.roblox_username}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.target.src = `https://placehold.co/36x36/1e1e3f/666?text=${player.roblox_username?.charAt(0)}`
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {player.roblox_username}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>
                                {player.position} · {player.goals}G {player.assists}A
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Budget Edit Modal */}
      {showBudgetEdit && (
        <div className="modal-overlay" onClick={() => { setShowBudgetEdit(null); setEditingBudgetValue(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--crf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wallet size={20} style={{ color: '#22c55e' }} />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Oswald, sans-serif' }}>Edit Budget: {showBudgetEdit.club_name}</h2>
              </div>
              <button onClick={() => { setShowBudgetEdit(null); setEditingBudgetValue(''); }} style={{ background: 'none', border: 'none', color: 'var(--crf-text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleBudgetEdit(showBudgetEdit.id); }} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--crf-text-muted)' }}>Total Budget ($)</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--crf-text-muted)' }} />
                  <input
                    type="number"
                    value={editingBudgetValue}
                    onChange={(e) => setEditingBudgetValue(e.target.value)}
                    className="crf-input"
                    min="0"
                    required
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--crf-text-muted)', marginTop: '4px' }}>
                  Current: ${showBudgetEdit.budget?.toLocaleString()} · Spent: ${showBudgetEdit.spent?.toLocaleString()} · Earned: ${showBudgetEdit.earned?.toLocaleString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="crf-btn crf-btn-primary"><Save size={16} /> Save</button>
                <button type="button" onClick={() => { setShowBudgetEdit(null); setEditingBudgetValue(''); }} className="crf-btn crf-btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Club Modal */}
      {showAddClub && (
        <div className="modal-overlay" onClick={() => setShowAddClub(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #2a2a4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Create New Club</h2>
              <button onClick={() => setShowAddClub(false)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const name = e.target.clubName.value.trim()
                if (name) handleAddClub(name)
              }}
              style={{ padding: '24px' }}
            >
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                Club Name
              </label>
              <input
                type="text"
                name="clubName"
                className="crf-input"
                placeholder="e.g. Manchester United"
                required
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className="crf-btn crf-btn-primary">
                  <Save size={16} />
                  Create Club
                </button>
                <button type="button" onClick={() => setShowAddClub(false)} className="crf-btn crf-btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubRosters
