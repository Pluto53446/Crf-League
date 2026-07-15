import React, { useState, useEffect } from 'react'
import { supabase } from '../hooks/useSupabase'
import TournamentBracket from './TournamentBracket'
import { Trophy, Swords, Loader2 } from 'lucide-react'

const Competitions = () => {
  const [activeTab, setActiveTab] = useState('ucl')
  const [matches, setMatches] = useState({})
  const [loading, setLoading] = useState(true)

  // UCL Rounds
  const uclRounds = [
    { key: 'ro16', label: 'Round of 16' },
    { key: 'quarter', label: 'Quarter-finals' },
    { key: 'semi', label: 'Semi-finals' },
    { key: 'final', label: 'Final' },
  ]

  // UEL Rounds
  const uelRounds = [
    { key: 'ro16', label: 'Round of 16' },
    { key: 'quarter', label: 'Quarter-finals' },
    { key: 'semi', label: 'Semi-finals' },
    { key: 'final', label: 'Final' },
  ]

  // FA Cup Rounds
  const faCupRounds = [
    { key: 'preliminary', label: 'Preliminary Round' },
    { key: 'ro16', label: 'Round of 16' },
    { key: 'quarter', label: 'Quarter-finals' },
    { key: 'semi', label: 'Semi-finals' },
    { key: 'final', label: 'Final' },
  ]

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .in('competition', ['ucl', 'uel', 'fa_cup'])
        .order('match_order', { ascending: true })

      if (error) throw error

      const organized = { ucl: [], uel: [], fa_cup: [] }
      data?.forEach(match => {
        if (organized[match.competition]) {
          organized[match.competition].push(match)
        }
      })

      setMatches(organized)
    } catch (err) {
      console.error('Error fetching matches:', err)
      setMatches({ ucl: [], uel: [], fa_cup: [] })
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: 'ucl', label: 'UEFA Champions League', icon: Trophy },
    { key: 'uel', label: 'UEFA Europa League', icon: Swords },
    { key: 'fa_cup', label: 'FA Cup', icon: Trophy },
  ]

  const getThemeColor = (tab) => {
    switch(tab) {
      case 'ucl': return '#1e40af'
      case 'uel': return '#f97316'
      case 'fa_cup': return '#dc2626'
      default: return '#e94560'
    }
  }

  const getAccentColor = (tab) => {
    switch(tab) {
      case 'ucl': return '#60a5fa'
      case 'uel': return '#fb923c'
      case 'fa_cup': return '#fbbf24'
      default: return '#ffd700'
    }
  }

  const getLogo = (tab) => {
    switch(tab) {
      case 'ucl': return 'https://cdn.discordapp.com/attachments/1323742382650425415/1526814595853979778/IMG_5022.png?ex=6a586466&is=6a5712e6&hm=bc94727cbd0f950b205fd21c08a77f150b1f8f9dd6bdafb024ab07c9cbf58a6c&'
      case 'uel': return 'https://cdn.discordapp.com/attachments/1323742382650425415/1526814815736041472/IMG_7134.png?ex=6a58649a&is=6a57131a&hm=dbefd1dc6b2bba002c4e5e22413bf795f235650a368392d4797062c65d30322a&'
      case 'fa_cup': return 'https://cdn.discordapp.com/attachments/1497655691521953832/1526618896281505802/MagicEraser_260601_184652.png?ex=6a57ae24&is=6a565ca4&hm=d771b722d7571874f184b47451062fd24b4cfea55789a8076e9c2badf654e8ab&'
      default: return ''
    }
  }

  const getRounds = (tab) => {
    switch(tab) {
      case 'ucl': return uclRounds
      case 'uel': return uelRounds
      case 'fa_cup': return faCupRounds
      default: return []
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <Loader2 size={40} style={{ color: 'var(--crf-gold)', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--crf-text-muted)', fontSize: '0.9rem' }}>Loading competitions...</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: '2rem',
          fontWeight: 700,
          color: 'white',
          margin: '0 0 8px 0',
          letterSpacing: '0.05em',
        }}>
          Competitions
        </h1>
        <p style={{
          color: 'var(--crf-text-muted)',
          fontSize: '0.9rem',
          margin: 0,
        }}>
          Tournament brackets and knockout stages
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        flexWrap: 'wrap',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '0.03em',
                transition: 'all 0.2s ease',
                background: isActive 
                  ? `linear-gradient(135deg, ${getThemeColor(tab.key)}40 0%, ${getThemeColor(tab.key)}20 100%)`
                  : 'rgba(255,255,255,0.03)',
                color: isActive ? 'white' : 'var(--crf-text-muted)',
                borderBottom: isActive ? `3px solid ${getThemeColor(tab.key)}` : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = 'var(--crf-text)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.color = 'var(--crf-text-muted)'
                }
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active Bracket */}
      <TournamentBracket
        title={tabs.find(t => t.key === activeTab)?.label}
        logo={getLogo(activeTab)}
        rounds={getRounds(activeTab)}
        matches={matches[activeTab] || []}
        themeColor={getThemeColor(activeTab)}
        accentColor={getAccentColor(activeTab)}
      />
    </div>
  )
}

export default Competitions
