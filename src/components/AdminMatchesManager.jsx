import React, { useState, useEffect } from 'react'
import { supabase } from '../hooks/useSupabase'
import { 
  Trophy, 
  Swords, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock
} from 'lucide-react'

const AdminMatchesManager = () => {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeCompetition, setActiveCompetition] = useState('ucl')
  const [activeRound, setActiveRound] = useState('ro16')

  const competitions = [
    { key: 'ucl', label: 'UEFA Champions League', icon: Trophy },
    { key: 'uel', label: 'UEFA Europa League', icon: Swords },
    { key: 'fa_cup', label: 'FA Cup', icon: Trophy },
  ]

  const rounds = {
    ucl: [
      { key: 'ro16', label: 'Round of 16' },
      { key: 'quarter', label: 'Quarter-finals' },
      { key: 'semi', label: 'Semi-finals' },
      { key: 'final', label: 'Final' },
    ],
    uel: [
      { key: 'ro16', label: 'Round of 16' },
      { key: 'quarter', label: 'Quarter-finals' },
      { key: 'semi', label: 'Semi-finals' },
      { key: 'final', label: 'Final' },
    ],
    fa_cup: [
      { key: 'preliminary', label: 'Preliminary Round' },
      { key: 'ro16', label: 'Round of 16' },
      { key: 'quarter', label: 'Quarter-finals' },
      { key: 'semi', label: 'Semi-finals' },
      { key: 'final', label: 'Final' },
    ],
  }

  useEffect(() => {
    fetchMatches()
  }, [activeCompetition, activeRound])

  useEffect(() => {
    const defaultRound = rounds[activeCompetition][0].key
    setActiveRound(defaultRound)
  }, [activeCompetition])

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('competition', activeCompetition)
        .eq('round', activeRound)
        .order('match_order', { ascending: true })

      if (error) throw error
      setMatches(data || [])
    } catch (err) {
      console.error('Error fetching matches:', err)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const addMatch = () => {
    const newMatch = {
      id: `temp_${Date.now()}`,
      competition: activeCompetition,
      round: activeRound,
      match_order: matches.length + 1,
      home_team: '',
      away_team: '',
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      match_date: '',
      status: 'scheduled',
      extra_time: false,
      notes: '',
      isNew: true,
    }
    setMatches([...matches, newMatch])
  }

  const updateMatch = (id, field, value) => {
    setMatches(matches.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ))
  }

  const deleteMatch = async (id) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return

    const match = matches.find(m => m.id === id)
    if (match?.isNew) {
      setMatches(matches.filter(m => m.id !== id))
      return
    }

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMatches(matches.filter(m => m.id !== id))
      showMessage('Match deleted successfully', 'success')
    } catch (err) {
      console.error('Error deleting match:', err)
      showMessage('Failed to delete match', 'error')
    }
  }

  const saveMatches = async () => {
    setSaving(true)
    try {
      const newMatches = matches.filter(m => m.isNew)
      const existingMatches = matches.filter(m => !m.isNew)

      // Insert new matches
      if (newMatches.length > 0) {
        const insertData = newMatches.map(m => {
          const { id, isNew, ...rest } = m
          return rest
        })

        const { error: insertError } = await supabase
          .from('matches')
          .insert(insertData)

        if (insertError) throw insertError
      }

      // Update existing matches
      for (const match of existingMatches) {
        const { error: updateError } = await supabase
          .from('matches')
          .update({
            home_team: match.home_team,
            away_team: match.away_team,
            home_score: match.home_score,
            away_score: match.away_score,
            home_penalties: match.home_penalties,
            away_penalties: match.away_penalties,
            match_date: match.match_date,
            status: match.status,
            extra_time: match.extra_time,
            notes: match.notes,
            match_order: match.match_order,
          })
          .eq('id', match.id)

        if (updateError) throw updateError
      }

      showMessage('All matches saved successfully!', 'success')
      await fetchMatches()
    } catch (err) {
      console.error('Error saving matches:', err)
      showMessage('Failed to save matches: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#22c55e'
      case 'live': return '#ef4444'
      case 'scheduled': return '#3b82f6'
      case 'postponed': return '#f59e0b'
      default: return 'var(--crf-text-muted)'
    }
  }

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'completed': return { background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }
      case 'live': return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }
      case 'scheduled': return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }
      case 'postponed': return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }
      default: return { background: 'rgba(255,255,255,0.05)', color: 'var(--crf-text-muted)', border: '1px solid var(--crf-border)' }
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          margin: '0 0 8px 0',
          fontFamily: 'Oswald, sans-serif',
        }}>
          Tournament Matches Manager
        </h2>
        <p style={{ color: 'var(--crf-text-muted)', fontSize: '0.85rem', margin: 0 }}>
          Add, edit, and manage knockout stage matches for all competitions
        </p>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 1000,
          padding: '16px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '0.875rem',
          animation: 'slideIn 0.3s ease-out',
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          color: message.type === 'error' ? '#ef4444' : '#22c55e',
        }}>
          {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {message.text}
        </div>
      )}

      {/* Competition Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        {competitions.map((comp) => {
          const Icon = comp.icon
          const isActive = activeCompetition === comp.key
          return (
            <button
              key={comp.key}
              onClick={() => setActiveCompetition(comp.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: isActive ? 'rgba(233, 69, 96, 0.2)' : 'rgba(255,255,255,0.03)',
                color: isActive ? '#e94560' : 'var(--crf-text-muted)',
                borderBottom: isActive ? '2px solid #e94560' : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              <span>{comp.label}</span>
            </button>
          )
        })}
      </div>

      {/* Round Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        {rounds[activeCompetition].map((round) => {
          const isActive = activeRound === round.key
          return (
            <button
              key={round.key}
              onClick={() => setActiveRound(round.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: isActive ? 'rgba(233, 69, 96, 0.15)' : 'rgba(255,255,255,0.02)',
                color: isActive ? '#e94560' : 'var(--crf-text-muted)',
                border: isActive ? '1px solid rgba(233, 69, 96, 0.3)' : '1px solid var(--crf-border)',
                transition: 'all 0.2s ease',
              }}
            >
              {round.label}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <span style={{ color: 'var(--crf-text-muted)', fontSize: '0.85rem' }}>
          {matches.length} match{matches.length !== 1 ? 'es' : ''} in this round
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={addMatch}
            className="crf-btn crf-btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
          >
            <Plus size={16} />
            Add Match
          </button>
          <button
            onClick={saveMatches}
            disabled={saving}
            className="crf-btn"
            style={{
              padding: '8px 16px',
              fontSize: '0.8rem',
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            Save All
          </button>
        </div>
      </div>

      {/* Matches Table */}
      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}>
          <Loader2 size={32} style={{ color: 'var(--crf-gold)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : matches.length === 0 ? (
        <div className="crf-card" style={{
          textAlign: 'center',
          padding: '60px',
          color: 'var(--crf-text-muted)',
        }}>
          <Swords size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>No matches in this round yet. Click "Add Match" to create one.</p>
        </div>
      ) : (
        <div style={{
          background: 'var(--crf-card)',
          border: '1px solid var(--crf-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="crf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Home Team</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th>Away Team</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>ET</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match, index) => (
                  <tr key={match.id}>
                    <td style={{ fontWeight: 600, color: 'var(--crf-text-muted)' }}>
                      {index + 1}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={match.home_team || ''}
                        onChange={(e) => updateMatch(match.id, 'home_team', e.target.value)}
                        placeholder="Home Team"
                        className="crf-input"
                        style={{ minWidth: '140px', padding: '8px 10px', fontSize: '0.8rem' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <input
                          type="number"
                          value={match.home_score ?? ''}
                          onChange={(e) => updateMatch(match.id, 'home_score', e.target.value === '' ? null : parseInt(e.target.value))}
                          placeholder="-"
                          className="crf-input"
                          style={{ width: '50px', padding: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }}
                        />
                        <span style={{ color: 'var(--crf-text-muted)', fontWeight: 700 }}>:</span>
                        <input
                          type="number"
                          value={match.away_score ?? ''}
                          onChange={(e) => updateMatch(match.id, 'away_score', e.target.value === '' ? null : parseInt(e.target.value))}
                          placeholder="-"
                          className="crf-input"
                          style={{ width: '50px', padding: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }}
                        />
                      </div>
                      {/* Penalties row */}
                      {(match.home_score === match.away_score && match.home_score !== null) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--crf-text-muted)' }}>Pens:</span>
                          <input
                            type="number"
                            value={match.home_penalties ?? ''}
                            onChange={(e) => updateMatch(match.id, 'home_penalties', e.target.value === '' ? null : parseInt(e.target.value))}
                            placeholder="-"
                            className="crf-input"
                            style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                          />
                          <span style={{ color: 'var(--crf-text-muted)', fontSize: '0.75rem' }}>:</span>
                          <input
                            type="number"
                            value={match.away_penalties ?? ''}
                            onChange={(e) => updateMatch(match.id, 'away_penalties', e.target.value === '' ? null : parseInt(e.target.value))}
                            placeholder="-"
                            className="crf-input"
                            style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                          />
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={match.away_team || ''}
                        onChange={(e) => updateMatch(match.id, 'away_team', e.target.value)}
                        placeholder="Away Team"
                        className="crf-input"
                        style={{ minWidth: '140px', padding: '8px 10px', fontSize: '0.8rem' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'var(--crf-text-muted)', flexShrink: 0 }} />
                        <input
                          type="date"
                          value={match.match_date || ''}
                          onChange={(e) => updateMatch(match.id, 'match_date', e.target.value)}
                          className="crf-input"
                          style={{ padding: '8px', fontSize: '0.75rem', minWidth: '130px' }}
                        />
                      </div>
                    </td>
                    <td>
                      <select
                        value={match.status}
                        onChange={(e) => updateMatch(match.id, 'status', e.target.value)}
                        className="crf-select"
                        style={{ 
                          padding: '8px 28px 8px 10px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          minWidth: '110px',
                          ...getStatusBadgeStyle(match.status)
                        }}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="completed">Completed</option>
                        <option value="postponed">Postponed</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={match.extra_time}
                        onChange={(e) => updateMatch(match.id, 'extra_time', e.target.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#e94560',
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={match.notes || ''}
                        onChange={(e) => updateMatch(match.id, 'notes', e.target.value)}
                        placeholder="Notes..."
                        className="crf-input"
                        style={{ minWidth: '100px', padding: '8px 10px', fontSize: '0.75rem' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => deleteMatch(match.id)}
                        className="crf-btn crf-btn-sm crf-btn-danger"
                        style={{ padding: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMatchesManager
