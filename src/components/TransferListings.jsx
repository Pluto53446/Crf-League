import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'
import { useManagerAuth } from '../hooks/useManagerAuth'
import { 
  ShoppingCart, 
  Plus, 
  X, 
  Save, 
  Trash2,
  Tag,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Gavel,
  Loader2
} from 'lucide-react'

function TransferListings() {
  const [listings, setListings] = useState([])
  const [players, setPlayers] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddListing, setShowAddListing] = useState(false)
  const [showBidModal, setShowBidModal] = useState(null)
  const [showBidsModal, setShowBidsModal] = useState(null)
  const [bidAmount, setBidAmount] = useState('')
  const [message, setMessage] = useState(null)

  const { isAdmin } = useAuth()
  const { manager } = useManagerAuth()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: listingsData }, { data: playersData }, { data: bidsData }] = await Promise.all([
      supabase.from('transfer_listings').select('*, player:players(*)').order('created_at', { ascending: false }),
      supabase.from('players').select('*').order('roblox_username'),
      supabase.from('bids').select('*').order('created_at', { ascending: false })
    ])
    setListings(listingsData || [])
    setPlayers(playersData || [])
    setBids(bidsData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const subscription = supabase
      .channel('transfer_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_listings' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, fetchData)
      .subscribe()
    return () => subscription.unsubscribe()
  }, [fetchData])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleAddListing = async (formData) => {
    const player = players.find(p => p.id === formData.player_id)
    if (!player) return

    const { error } = await supabase.from('transfer_listings').insert([{
      player_id: formData.player_id,
      asking_price: parseFloat(formData.asking_price) || 0,
      current_club: player.club || 'Free Agent',
      position: player.position,
      description: formData.description || null,
    }])

    if (error) showMessage('Failed to create listing', 'error')
    else { showMessage('Transfer listing created!'); setShowAddListing(false) }
  }

  const handleDeleteListing = async (id) => {
    if (!confirm('Remove this player from the transfer list?')) return
    const { error } = await supabase.from('transfer_listings').delete().eq('id', id)
    if (error) showMessage('Failed to remove listing', 'error')
    else showMessage('Listing removed!')
  }

  const handlePlaceBid = async (listing) => {
    const amount = parseFloat(bidAmount)
    if (!amount || amount <= 0) {
      showMessage('Please enter a valid bid amount', 'error')
      return
    }

    try {
      // Check manager budget
      const { data: budget } = await supabase
        .from('club_budgets')
        .select('*')
        .eq('club_name', manager.club)
        .single()

      const remaining = budget ? budget.budget - budget.spent + budget.earned : 100000000
      if (amount > remaining) {
        showMessage(`Insufficient budget. You have $${remaining.toLocaleString()} remaining.`, 'error')
        return
      }

      // Check if already bid on this listing
      const { data: existingBid } = await supabase
        .from('bids')
        .select('*')
        .eq('transfer_listing_id', listing.id)
        .eq('manager_id', manager.id)
        .single()

      if (existingBid) {
        // Update existing bid
        const { error } = await supabase
          .from('bids')
          .update({ bid_amount: amount, status: 'pending' })
          .eq('id', existingBid.id)
        if (error) throw error
        showMessage('Bid updated!')
      } else {
        // Create new bid
        const { error } = await supabase.from('bids').insert([{
          transfer_listing_id: listing.id,
          manager_id: manager.id,
          manager_username: manager.username,
          club: manager.club,
          bid_amount: amount,
          status: 'pending',
        }])
        if (error) throw error
        showMessage('Bid placed successfully!')
      }

      // Log the action
      await supabase.from('manager_logs').insert([{
        manager_id: manager.id,
        manager_username: manager.username,
        club: manager.club,
        action: 'bid_placed',
        player_name: listing.player?.roblox_username,
        amount: amount,
        details: { type: 'bid_placed', listing_id: listing.id },
      }])

      setShowBidModal(null)
      setBidAmount('')
    } catch (err) {
      showMessage('Failed to place bid: ' + err.message, 'error')
    }
  }

  const handleAcceptBid = async (bid, listing) => {
    try {
      // Get buyer budget
      const { data: buyerBudget } = await supabase
        .from('club_budgets')
        .select('*')
        .eq('club_name', bid.club)
        .single()

      if (!buyerBudget) throw new Error('Buyer club budget not found')

      const buyerRemaining = buyerBudget.budget - buyerBudget.spent + buyerBudget.earned
      if (bid.bid_amount > buyerRemaining) {
        showMessage('Buyer no longer has sufficient budget', 'error')
        return
      }

      // Get seller budget (listing manager's club)
      const { data: sellerBudget } = await supabase
        .from('club_budgets')
        .select('*')
        .eq('club_name', listing.current_club)
        .single()

      // Update buyer budget (deduct)
      await supabase
        .from('club_budgets')
        .update({ spent: buyerBudget.spent + bid.bid_amount })
        .eq('id', buyerBudget.id)

      // Update seller budget (add to earned) if seller has budget record
      if (sellerBudget) {
        await supabase
          .from('club_budgets')
          .update({ earned: sellerBudget.earned + bid.bid_amount })
          .eq('id', sellerBudget.id)
      }

      // Move player to buyer club
      await supabase
        .from('players')
        .update({ club: bid.club })
        .eq('id', listing.player_id)

      // Update bid status
      await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bid.id)

      // Reject other bids on this listing
      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('transfer_listing_id', listing.id)
        .neq('id', bid.id)

      // Remove listing
      await supabase.from('transfer_listings').delete().eq('id', listing.id)

      // Log for buyer
      await supabase.from('manager_logs').insert([{
        manager_id: bid.manager_id,
        manager_username: bid.manager_username,
        club: bid.club,
        action: 'player_signed',
        player_name: listing.player?.roblox_username,
        amount: bid.bid_amount,
        details: { type: 'transfer_purchase', from_club: listing.current_club },
      }])

      // Log for seller (if manager exists)
      const { data: sellerManager } = await supabase
        .from('managers')
        .select('*')
        .eq('club', listing.current_club)
        .eq('status', 'approved')
        .single()

      if (sellerManager) {
        await supabase.from('manager_logs').insert([{
          manager_id: sellerManager.id,
          manager_username: sellerManager.username,
          club: listing.current_club,
          action: 'player_transferred',
          player_name: listing.player?.roblox_username,
          amount: bid.bid_amount,
          details: { type: 'transfer_sale', to_club: bid.club },
        }])
      }

      showMessage(`Bid accepted! ${listing.player?.roblox_username} transferred to ${bid.club} for $${bid.bid_amount.toLocaleString()}`)
      setShowBidsModal(null)
    } catch (err) {
      showMessage('Failed to accept bid: ' + err.message, 'error')
    }
  }

  const handleRejectBid = async (bid) => {
    try {
      const { error } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('id', bid.id)
      if (error) throw error
      showMessage('Bid rejected')
    } catch (err) {
      showMessage('Failed to reject bid: ' + err.message, 'error')
    }
  }

  const getListingBids = (listingId) => bids.filter(b => b.transfer_listing_id === listingId)
  const getMyBid = (listingId) => bids.find(b => b.transfer_listing_id === listingId && b.manager_id === manager?.id)
  const isMyListing = (listing) => manager && listing.current_club === manager.club

  return (
    <div className="animate-fade-in">
      {message && (
        <div style={{
          position: 'fixed', top: '80px', right: '24px', zIndex: 1000,
          padding: '16px 20px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontWeight: 600, fontSize: '0.875rem',
          animation: 'slideIn 0.3s ease-out',
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          color: message.type === 'error' ? '#ef4444' : '#22c55e',
        }}>
          {message.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
          {message.text}
        </div>
      )}

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
            Transfer Listings
          </h2>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            {listings.length} players available for transfer
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddListing(true)}
            className="crf-btn crf-btn-primary"
          >
            <Plus size={18} />
            List Player
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="crf-card">
              <div className="skeleton" style={{ height: '80px' }} />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="crf-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: '#a0a0a0' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Transfer Listings</h3>
          <p style={{ color: '#a0a0a0' }}>Players listed for transfer will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {listings.map(listing => {
            const listingBids = getListingBids(listing.id)
            const myBid = getMyBid(listing.id)
            const myListing = isMyListing(listing)
            const pendingBids = listingBids.filter(b => b.status === 'pending')

            return (
              <div key={listing.id} className="crf-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <img
                  src={listing.player?.roblox_avatar_url || `https://placehold.co/80x80/1e1e3f/666?text=${listing.player?.roblox_username?.charAt(0)}`}
                  alt={listing.player?.roblox_username}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '2px solid #2a2a4a',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    e.target.src = `https://placehold.co/80x80/1e1e3f/666?text=${listing.player?.roblox_username?.charAt(0)}`
                  }}
                />

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                      {listing.player?.roblox_username}
                    </h3>
                    <span style={{
                      background: 'rgba(233, 69, 96, 0.1)',
                      color: '#e94560',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {listing.current_club || 'Free Agent'}
                    </span>
                    <span style={{
                      background: 'rgba(15, 52, 96, 0.5)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}>
                      {listing.position}
                    </span>
                    {myListing && (
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}>
                        YOUR LISTING
                      </span>
                    )}
                  </div>

                  {listing.description && (
                    <p style={{ color: '#a0a0a0', fontSize: '0.875rem', marginBottom: '8px' }}>
                      <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      {listing.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#a0a0a0' }}>
                    <span>{listing.player?.goals || 0} Goals</span>
                    <span>{listing.player?.assists || 0} Assists</span>
                    <span>{listing.player?.yellow_cards || 0}YC {listing.player?.red_cards || 0}RC</span>
                    {pendingBids.length > 0 && (
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                        <Gavel size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {pendingBids.length} bid{pendingBids.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    fontFamily: 'Oswald, sans-serif',
                    color: '#22c55e',
                    lineHeight: 1,
                  }}>
                    ${listing.asking_price?.toLocaleString() || '0'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Asking Price
                  </div>

                  {/* Manager Actions */}
                  {manager && !myListing && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {myBid ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: myBid.status === 'pending' ? 'rgba(59, 130, 246, 0.15)' : myBid.status === 'accepted' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: myBid.status === 'pending' ? '#3b82f6' : myBid.status === 'accepted' ? '#22c55e' : '#ef4444',
                          }}>
                            Your Bid: ${myBid.bid_amount?.toLocaleString()} ({myBid.status})
                          </span>
                          <button
                            onClick={() => { setShowBidModal(listing); setBidAmount(String(myBid.bid_amount)) }}
                            className="crf-btn crf-btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                          >
                            <Send size={10} /> Update
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowBidModal(listing); setBidAmount(String(listing.asking_price || '')) }}
                          className="crf-btn crf-btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          <Send size={12} /> Place Bid
                        </button>
                      )}
                    </div>
                  )}

                  {/* Listing Manager - View Bids */}
                  {myListing && pendingBids.length > 0 && (
                    <button
                      onClick={() => setShowBidsModal(listing)}
                      className="crf-btn crf-btn-sm"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                    >
                      <Gavel size={12} /> Review {pendingBids.length} Bid{pendingBids.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="crf-btn crf-btn-sm crf-btn-danger"
                      style={{ marginTop: '4px' }}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bid Modal */}
      {showBidModal && (
        <div className="modal-overlay" onClick={() => { setShowBidModal(null); setBidAmount(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--crf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Oswald, sans-serif' }}>Place Bid</h2>
              <button onClick={() => { setShowBidModal(null); setBidAmount(''); }} style={{ background: 'none', border: 'none', color: 'var(--crf-text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <img src={showBidModal.player?.roblox_avatar_url || `https://placehold.co/40x40/1e1e3f/666?text=${showBidModal.player?.roblox_username?.charAt(0)}`} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{showBidModal.player?.roblox_username}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--crf-text-muted)' }}>Asking: ${showBidModal.asking_price?.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--crf-text-muted)' }}>Your Bid ($)</label>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="crf-input"
                  placeholder="Enter bid amount"
                  min="1"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => handlePlaceBid(showBidModal)} className="crf-btn crf-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  <Send size={14} /> Place Bid
                </button>
                <button onClick={() => { setShowBidModal(null); setBidAmount(''); }} className="crf-btn crf-btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Bids Modal (for listing manager) */}
      {showBidsModal && (
        <div className="modal-overlay" onClick={() => setShowBidsModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--crf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Oswald, sans-serif' }}>Review Bids</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--crf-text-muted)', margin: '4px 0 0 0' }}>{showBidsModal.player?.roblox_username}</p>
              </div>
              <button onClick={() => setShowBidsModal(null)} style={{ background: 'none', border: 'none', color: 'var(--crf-text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {getListingBids(showBidsModal.id).filter(b => b.status === 'pending').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--crf-text-muted)', padding: '20px' }}>No pending bids.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getListingBids(showBidsModal.id)
                    .filter(b => b.status === 'pending')
                    .sort((a, b) => b.bid_amount - a.bid_amount)
                    .map(bid => (
                      <div key={bid.id} className="crf-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{bid.manager_username}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--crf-text-muted)' }}>{bid.club}</div>
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Oswald, sans-serif', color: '#22c55e' }}>
                          ${bid.bid_amount?.toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAcceptBid(bid, showBidsModal)}
                            className="crf-btn crf-btn-sm"
                            style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '6px 12px' }}
                          >
                            <CheckCircle size={12} /> Accept
                          </button>
                          <button
                            onClick={() => handleRejectBid(bid)}
                            className="crf-btn crf-btn-sm crf-btn-danger"
                            style={{ padding: '6px 12px' }}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Listing Modal */}
      {showAddListing && (
        <div className="modal-overlay" onClick={() => setShowAddListing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #2a2a4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>List Player for Transfer</h2>
              <button onClick={() => setShowAddListing(false)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target
                handleAddListing({
                  player_id: form.player_id.value,
                  asking_price: form.asking_price.value,
                  description: form.description.value,
                })
              }}
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                    Select Player *
                  </label>
                  <select name="player_id" className="crf-select" required>
                    <option value="">Choose a player...</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.roblox_username} ({player.position} · {player.club || 'Free Agent'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                    Asking Price ($)
                  </label>
                  <input
                    type="number"
                    name="asking_price"
                    className="crf-input"
                    placeholder="e.g. 5000000"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: '#a0a0a0' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    className="crf-input"
                    placeholder="e.g. Young prospect with high potential..."
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="crf-btn crf-btn-primary">
                  <Tag size={16} />
                  List for Transfer
                </button>
                <button type="button" onClick={() => setShowAddListing(false)} className="crf-btn crf-btn-secondary">
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

export default TransferListings
