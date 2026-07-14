import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../hooks/useSupabase'
import { X, Mail, Lock, AlertCircle, Key } from 'lucide-react'

const ADMIN_PASSWORD = 'feztir-zeSbyf-mysbo6'

function LoginModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const waitForAuthUser = async (targetEmail, maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email === targetEmail) {
        return user
      }
      await new Promise(r => setTimeout(r, 500))
    }
    throw new Error('Could not verify user creation. Please try signing in instead.')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (adminPassword !== ADMIN_PASSWORD) {
          throw new Error('Invalid admin password. Access denied.')
        }

        const { data, error: signUpError } = await signUp(email, password)
        if (signUpError) throw signUpError

        if (!data?.user) {
          throw new Error('Sign up failed. Please try again.')
        }

        // Wait for auth user to be fully created, then sign in
        await new Promise(r => setTimeout(r, 1000))

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError

        // Now insert into admins as authenticated user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Authentication failed after sign up.')

        const { error: adminError } = await supabase
          .from('admins')
          .insert([{ user_id: user.id, email: user.email }])

        if (adminError) {
          console.error('Admin insert error:', adminError)
          throw new Error('Account created but admin assignment failed. Contact support.')
        }

        setError('Account created! You are now an admin.')
        setTimeout(() => onClose(), 1500)
      } else {
        const { error: signInError } = await signIn(email, password)
        if (signInError) throw signInError
        onClose()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
            {isSignUp ? 'Create Admin Account' : 'Admin Login'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a0a0a0',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: error.includes('created') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${error.includes('created') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: error.includes('created') ? '#22c55e' : '#ef4444',
              fontSize: '0.875rem',
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#a0a0a0',
              }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a0a0a0',
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="crf-input"
                  style={{ paddingLeft: '44px' }}
                  placeholder="admin@crfleague.com"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: isSignUp ? '16px' : '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#a0a0a0',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a0a0a0',
                }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="crf-input"
                  style={{ paddingLeft: '44px' }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {isSignUp && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#e94560',
                }}>
                  Admin Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <Key size={18} style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#e94560',
                  }} />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="crf-input"
                    style={{ paddingLeft: '44px', borderColor: '#e94560' }}
                    placeholder="Enter admin secret password"
                    required
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '4px' }}>
                  This password is required to create an admin account.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="crf-btn crf-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Admin Account' : 'Sign In')}
            </button>
          </form>

          <p style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '0.875rem',
            color: '#a0a0a0',
          }}>
            {isSignUp ? 'Already have an account?' : "Need an admin account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setAdminPassword('') }}
              style={{
                background: 'none',
                border: 'none',
                color: '#e94560',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
