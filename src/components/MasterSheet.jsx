import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Filter,
  X,
  Save,
  User,
  Shield,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react'

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF']

function MasterSheet() {
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClub, setFilterClub] = useState('')
  const [filterPosition, setFilterPosition] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'goals', direction: 'desc' })
  const { isAdmin } = useAuth()

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [{ data: playersData }, { data: clubsData }] = await Promise.all([
      supabase.from('players').select('*').order('created_at', { ascending: false }),
      supabase.from('clubs').select('*').order('name')
    ])

    setPlayers(playersData || [])
    setClubs(clubsData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const subscription = supabase
      .channel('players_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchData)
      .subscribe()

    return () => subscription.unsubscribe()
  }, [fetchData])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  const sortedPlayers = [...players].sort((a, b) => {
    if (!sortConfig.key) return 0
    const aVal = a[sortConfig.key] || 0
    const bVal = b[sortConfig.key] || 0
    return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal
  })

  const filteredPlayers = sortedPlayers.filter(player => {
    const matchesSearch = player.roblox_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.club?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClub = !filterClub || player.club === filterClub
    const matchesPosition = !filterPosition || player.position === filterPosition
    return matchesSearch && matchesClub && matchesPosition
  })

  const getRobloxData = async (username) => {
    const cleanUsername = username.replace(/^@/, '').trim()

    if (!cleanUsername) {
      throw new Error('Please enter a Roblox username')
    }

    try {
      // Call Supabase Edge Function (bypasses CORS)
      const { data, error } = await supabase.functions.invoke('fetch-roblox-user', {
        body: { username: cleanUsername }
      })

      if (error) {
        throw new Error(`Edge function error: ${error.message}`)
      }

      if (data.error) {
        throw new Error(data.error)
      }

      return {
        userId: data.userId,
        username: data.username,
        avatarUrl: data.avatarUrl
      }
    } catch (err) {
      if (err.message.includes('not found')) {
        throw err
      }
      throw new Error(`Failed to fetch Roblox data: ${err.message}. Please try again.`)
    }
  }

  const handleAddPlayer = async (formData) => {
    try {
      const robloxData = await getRobloxData(formData.roblox_username)

      const { error } = await supabase.from('players').insert([{
        roblox_username: robloxData.username,
        roblox_user_id: String(robloxData.userId),
        roblox_avatar_url: robloxData.avatarUrl,
        club: formData.club || null,
        position: formData.position,
        goals: parseInt(formData.goals) || 0,
        assists: parseInt(formData.assists) || 0,
        tackles: formData.position === 'GK' ? 0 : (parseInt(formData.tackles) || 0),
        saves: formData.position === 'GK' ? (parseInt(formData.saves) || 0) : 0,
        yellow_cards: parseInt(formData.yellow_cards) || 0,
        red_cards: parseInt(formData.red_cards) || 0,
      }])

      if (error) throw error
      setShowAddModal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEditPlayer = async (formData) => {
    try {
      const updateData = {
        club: formData.club || null,
        position: formData.position,
        goals: parseInt(formData.goals) || 0,
        assists: parseInt(formData.assists) || 0,
        tackles: formData.position === 'GK' ? 0 : (parseInt(formData.tackles) || 0),
        saves: formData.position === 'GK' ? (parseInt(formData.saves) || 0) : 0,
        yellow_cards: parseInt(formData.yellow_cards) || 0,
        red_cards: parseInt(formData.red_cards) || 0,
      }

      if (formData.roblox_username !== editingPlayer.roblox_username) {
        const robloxData = await getRobloxData(formData.roblox_username)
        updateData.roblox_username = robloxData.username
        updateData.roblox_user_id = String(robloxData.userId)
        updateData.roblox_avatar_url = robloxData.avatarUrl
      }

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', editingPlayer.id)

      if (error) throw error
      setEditingPlayer(null)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeletePlayer = async (id) => {
    if (!confirm('Are you sure you want to delete this player?')) return

    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) alert('Failed to delete player')
  }

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ChevronUp size={14} style={{ opacity: 0.3 }} />
    return sortConfig.direction === 'desc' 
      ? <ChevronDown size={14} style={{ color: '#e94560' }} />
      : <ChevronUp size={14} style={{ color: '#e94560' }} />
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
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
            Master Sheet
          </h2>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            {players.length} players in database
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="crf-btn crf-btn-primary"
          >
            <Plus size={18} />
            Add Player
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#a0a0a0',
          }} />
          <input
            type="text"
            placeholder="Search players or clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crf-input"
            style={{ paddingLeft: '44px' }}
          />
        </div>

        <div style={{ position: 'relative', minWidth: '160px' }}>
          <Filter size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#a0a0a0',
            zIndex: 1,
          }} />
          <select
            value={filterClub}
            onChange={(e) => setFilterClub(e.target.value)}
            className="crf-select"
            style={{ paddingLeft: '44px' }}
          >
            <option value="">All Clubs</option>
            {clubs.map(club => (
              <option key={club.id} value={club.name}>{club.name}</option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', minWidth: '140px' }}>
          <Shield size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#a0a0a0',
            zIndex: 1,
          }} />
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="crf-select"
            style={{ paddingLeft: '44px' }}
          >
            <option value="">All Positions</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: '#1e1e3f',
        border: '1px solid #2a2a4a',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="crf-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Club</th>
                <th>Pos</th>
                <th onClick={() => handleSort('goals')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Goals <SortIcon column="goals" />
                  </div>
                </th>
                <th onClick={() => handleSort('assists')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Assists <SortIcon column="assists" />
                  </div>
                </th>
                <th onClick={() => handleSort('tackles')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Tackles <SortIcon column="tackles" />
                  </div>
                </th>
                <th onClick={() => handleSort('saves')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Saves <SortIcon column="saves" />
                  </div>
                </th>
                <th>Cards</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="skeleton" style={{ height: '20px', width: '200px', margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: '#a0a0a0' }}>
                    <User size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p>No players found</p>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map(player => (
                  <tr key={player.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={player.roblox_avatar_url || `https://placehold.co/40x40/1e1e3f/666?text=${player.roblox_username?.charAt(0) || '?'}`}
                          alt={player.roblox_username}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: '2px solid #2a2a4a',
                          }}
                          onError={(e) => {
                            e.target.src = `https://placehold.co/40x40/1e1e3f/666?text=${player.roblox_username?.charAt(0) || '?'}`
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{player.roblox_username}</div>
                          <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>
                            ID: {player.roblox_user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: 'rgba(233, 69, 96, 0.1)',
                        color: '#e94560',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}>
                        {player.club || 'Free Agent'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: 'rgba(15, 52, 96, 0.5)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}>
                        {player.position}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#22c55e' }}>{player.goals}</td>
                    <td style={{ fontWeight: 600 }}>{player.assists}</td>
                    <td style={{ fontWeight: 600 }}>{player.tackles || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{player.saves || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {player.yellow_cards > 0 && (
                          <span className="badge badge-yellow">{player.yellow_cards}</span>
                        )}
                        {player.red_cards > 0 && (
                          <span className="badge badge-red">{player.red_cards}</span>
                        )}
                        {player.yellow_cards === 0 && player.red_cards === 0 && (
                          <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>—</span>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setEditingPlayer(player)}
                            className="crf-btn crf-btn-sm crf-btn-secondary"
                            style={{ padding: '6px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="crf-btn crf-btn-sm crf-btn-danger"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingPlayer) && (
        <PlayerModal
          player={editingPlayer}
          clubs={clubs}
          onClose={() => { setShowAddModal(false); setEditingPlayer(null) }}
          onSubmit={editingPlayer ? handleEditPlayer : handleAddPlayer}
        />
      )}
    </div>
  )
}

function PlayerModal({ player, clubs, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    roblox_username: player?.roblox_username || '',
    club: player?.club || '',
    position: player?.position || 'ST',
    goals: player?.goals || 0,
    assists: player?.assists || 0,
    tackles: player?.tackles || 0,
    saves: player?.saves || 0,
    yellow_cards: player?.yellow_cards || 0,
    red_cards: player?.red_cards || 0,
  })
  const [submitting, setSubmitting] = useState(false)

  const isGoalkeeper = formData.position === 'GK'

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(formData)
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {player ? 'Edit Player' : 'Add New Player'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                Roblox Username *
              </label>
              <input
                type="text"
                name="roblox_username"
                value={formData.roblox_username}
                onChange={handleChange}
                className="crf-input"
                placeholder="Enter Roblox username (no @ needed)"
                required
                disabled={!!player}
              />
              {!player && (
                <p style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '4px' }}>
                  Avatar and User ID will be fetched automatically. Just type the username.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Club
                </label>
                <select name="club" value={formData.club} onChange={handleChange} className="crf-select">
                  <option value="">Free Agent</option>
                  {clubs.map(club => (
                    <option key={club.id} value={club.name}>{club.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Position *
                </label>
                <select name="position" value={formData.position} onChange={handleChange} className="crf-select" required>
                  {POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Goals
                </label>
                <input type="number" name="goals" value={formData.goals} onChange={handleChange} className="crf-input" min="0" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Assists
                </label>
                <input type="number" name="assists" value={formData.assists} onChange={handleChange} className="crf-input" min="0" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  {isGoalkeeper ? 'Saves' : 'Tackles'}
                </label>
                <input 
                  type="number" 
                  name={isGoalkeeper ? 'saves' : 'tackles'} 
                  value={isGoalkeeper ? formData.saves : formData.tackles} 
                  onChange={handleChange} 
                  className="crf-input" 
                  min="0" 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Yellow Cards
                </label>
                <input type="number" name="yellow_cards" value={formData.yellow_cards} onChange={handleChange} className="crf-input" min="0" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                  Red Cards
                </label>
                <input type="number" name="red_cards" value={formData.red_cards} onChange={handleChange} className="crf-input" min="0" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="crf-btn crf-btn-primary" disabled={submitting}>
              <Save size={16} />
              {submitting ? 'Saving...' : (player ? 'Update Player' : 'Add Player')}
            </button>
            <button type="button" onClick={onClose} className="crf-btn crf-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MasterSheet
