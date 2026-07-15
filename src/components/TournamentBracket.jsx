import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Trophy, Swords } from 'lucide-react'

const TournamentBracket = ({ 
  title, 
  logo, 
  rounds, 
  matches,
  themeColor = '#e94560',
  accentColor = '#ffd700'
}) => {
  const [expandedRounds, setExpandedRounds] = useState(() => {
    // Expand all rounds by default
    const initial = {}
    rounds.forEach(r => { initial[r.key] = true })
    return initial
  })

  const [selectedMatch, setSelectedMatch] = useState(null)

  const toggleRound = (roundKey) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundKey]: !prev[roundKey]
    }))
  }

  const getRoundMatches = (roundKey) => {
    return matches.filter(m => m.round === roundKey).sort((a, b) => (a.match_order || 0) - (b.match_order || 0))
  }

  const getWinner = (match) => {
    if (match.home_score === null || match.away_score === null) return null
    if (match.home_score > match.away_score) return match.home_team
    if (match.away_score > match.home_score) return match.away_team
    // Draw — check penalties
    if (match.home_penalties !== null && match.away_penalties !== null) {
      if (match.home_penalties > match.away_penalties) return match.home_team
      if (match.away_penalties > match.home_penalties) return match.away_team
    }
    return null
  }

  const getLoser = (match) => {
    if (match.home_score === null || match.away_score === null) return null
    if (match.home_score > match.away_score) return match.away_team
    if (match.away_score > match.home_score) return match.home_team
    // Draw — check penalties
    if (match.home_penalties !== null && match.away_penalties !== null) {
      if (match.home_penalties > match.away_penalties) return match.away_team
      if (match.away_penalties > match.home_penalties) return match.home_team
    }
    return null
  }

  return (
    <div style={{
      background: 'var(--crf-card)',
      borderRadius: '16px',
      border: `1px solid ${themeColor}40`,
      overflow: 'hidden',
      marginBottom: '32px',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}10 100%)`,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: `1px solid ${themeColor}30`,
      }}>
        {logo && (
          <img 
            src={logo} 
            alt={title}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
            }}
          />
        )}
        <div>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            {title}
          </h2>
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--crf-text-muted)',
            margin: '4px 0 0 0',
          }}>
            Knockout Stage
          </p>
        </div>
        <Trophy size={24} style={{ 
          color: accentColor, 
          marginLeft: 'auto',
          filter: 'drop-shadow(0 0 8px ' + accentColor + '40)',
        }} />
      </div>

      {/* Bracket Rounds */}
      <div style={{ padding: '20px' }}>
        {rounds.map((round, roundIndex) => {
          const roundMatches = getRoundMatches(round.key)
          const isExpanded = expandedRounds[round.key] !== false
          const isFinal = round.key === 'final'

          return (
            <div 
              key={round.key}
              style={{
                marginBottom: roundIndex < rounds.length - 1 ? '16px' : '0',
              }}
            >
              {/* Round Header */}
              <button
                onClick={() => toggleRound(round.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: isFinal 
                    ? `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}15 100%)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isFinal ? themeColor + '50' : 'var(--crf-border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isFinal 
                    ? `linear-gradient(135deg, ${themeColor}40 0%, ${themeColor}25 100%)`
                    : 'rgba(255,255,255,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isFinal 
                    ? `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}15 100%)`
                    : 'rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isFinal && (
                    <Trophy size={18} style={{ color: accentColor }} />
                  )}
                  <span style={{
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: isFinal ? accentColor : 'white',
                  }}>
                    {round.label}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--crf-text-muted)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 10px',
                    borderRadius: '20px',
                  }}>
                    {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp size={18} style={{ color: 'var(--crf-text-muted)' }} />
                ) : (
                  <ChevronDown size={18} style={{ color: 'var(--crf-text-muted)' }} />
                )}
              </button>

              {/* Round Matches */}
              {isExpanded && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '12px',
                  padding: '12px 0 0 0',
                }}>
                  {roundMatches.length === 0 ? (
                    <div style={{
                      gridColumn: '1 / -1',
                      textAlign: 'center',
                      padding: '32px',
                      color: 'var(--crf-text-muted)',
                      fontSize: '0.85rem',
                    }}>
                      <Swords size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                      <p>No matches scheduled for this round yet.</p>
                    </div>
                  ) : (
                    roundMatches.map((match, matchIndex) => {
                      const winner = getWinner(match)
                      const isComplete = match.home_score !== null && match.away_score !== null

                      return (
                        <div
                          key={match.id}
                          onClick={() => setSelectedMatch(selectedMatch === match.id ? null : match.id)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isComplete ? themeColor + '30' : 'var(--crf-border)'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = themeColor + '50'
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isComplete ? themeColor + '30' : 'var(--crf-border)'
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          }}
                        >
                          {/* Match Number & Status */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                          }}>
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'var(--crf-text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                            }}>
                              Match {matchIndex + 1}
                            </span>
                            {match.status === 'live' && (
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: '#ef4444',
                                background: 'rgba(239, 68, 68, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                animation: 'pulse 2s infinite',
                              }}>
                                LIVE
                              </span>
                            )}
                            {match.status === 'completed' && (
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: '#22c55e',
                                background: 'rgba(34, 197, 94, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                              }}>
                                FT
                              </span>
                            )}
                            {match.status === 'postponed' && (
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                              }}>
                                PPD
                              </span>
                            )}
                            {match.match_date && match.status === 'scheduled' && (
                              <span style={{
                                fontSize: '0.7rem',
                                color: 'var(--crf-text-muted)',
                              }}>
                                {match.match_date}
                              </span>
                            )}
                          </div>

                          {/* Teams */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Home Team */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: winner === match.home_team 
                                ? `${themeColor}15`
                                : getLoser(match) === match.home_team
                                  ? 'rgba(255,255,255,0.02)'
                                  : 'rgba(255,255,255,0.04)',
                              border: winner === match.home_team 
                                ? `1px solid ${themeColor}40`
                                : '1px solid transparent',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {match.home_team_logo && (
                                  <img 
                                    src={match.home_team_logo} 
                                    alt=""
                                    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                  />
                                )}
                                <span style={{
                                  fontSize: '0.9rem',
                                  fontWeight: winner === match.home_team ? 700 : 500,
                                  color: winner === match.home_team ? 'white' : getLoser(match) === match.home_team ? '#666' : 'var(--crf-text)',
                                }}>
                                  {match.home_team || 'TBD'}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: match.home_score !== null ? 'white' : '#555',
                                fontFamily: 'Oswald, sans-serif',
                                minWidth: '24px',
                                textAlign: 'center',
                              }}>
                                {match.home_score !== null ? match.home_score : '-'}
                              </span>
                            </div>

                            {/* Away Team */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: winner === match.away_team 
                                ? `${themeColor}15`
                                : getLoser(match) === match.away_team
                                  ? 'rgba(255,255,255,0.02)'
                                  : 'rgba(255,255,255,0.04)',
                              border: winner === match.away_team 
                                ? `1px solid ${themeColor}40`
                                : '1px solid transparent',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {match.away_team_logo && (
                                  <img 
                                    src={match.away_team_logo} 
                                    alt=""
                                    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                  />
                                )}
                                <span style={{
                                  fontSize: '0.9rem',
                                  fontWeight: winner === match.awayTeam ? 700 : 500,
                                  color: winner === match.away_team ? 'white' : getLoser(match) === match.away_team ? '#666' : 'var(--crf-text)',
                                }}>
                                  {match.away_team || 'TBD'}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: match.away_score !== null ? 'white' : '#555',
                                fontFamily: 'Oswald, sans-serif',
                                minWidth: '24px',
                                textAlign: 'center',
                              }}>
                                {match.away_score !== null ? match.away_score : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Winner Badge */}
                          {winner && (
                            <div style={{
                              marginTop: '10px',
                              padding: '6px 12px',
                              background: `${themeColor}20`,
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              <Trophy size={12} style={{ color: accentColor }} />
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: accentColor,
                              }}>
                                Winner: {winner}
                              </span>
                            </div>
                          )}

                          {/* Extra Time / Penalties */}
                          {match.extra_time && (
                            <div style={{
                              marginTop: '8px',
                              fontSize: '0.7rem',
                              color: 'var(--crf-text-muted)',
                              textAlign: 'center',
                            }}>
                              AET {match.home_penalties !== null && match.away_penalties !== null && `(Pens: ${match.home_penalties}-${match.away_penalties})`}
                            </div>
                          )}

                          {/* Notes */}
                          {match.notes && (
                            <div style={{
                              marginTop: '8px',
                              fontSize: '0.7rem',
                              color: 'var(--crf-text-muted)',
                              fontStyle: 'italic',
                              textAlign: 'center',
                            }}>
                              {match.notes}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TournamentBracket
