/**
 * POST /api/auth/change-password
 * Utilizatorul logat (admin sau profesor) își schimbă propria parolă.
 * Cere parola curentă, ca o sesiune furată să nu poată prelua contul.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/security/argon2'
import { createAuditLog, SEVERITY } from '@/lib/security/audit.js'

const MIN_LENGTH_STAFF = 8

function validateNewPassword(password, role) {
  // Administratorii au politica strictă; profesorii — una mai blândă
  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    const result = validatePasswordStrength(password)
    return result.valid ? null : result.errors.join('. ')
  }
  if (password.length < MIN_LENGTH_STAFF) return `Parola trebuie să aibă cel puțin ${MIN_LENGTH_STAFF} caractere`
  if (password.length > 128) return 'Parola nu poate depăși 128 de caractere'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Parola trebuie să conțină litere și cifre'
  return null
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const ip = getClientIP(request)
    const rate = checkRateLimit(`change-password:${session.user.email}`, 5, 15 * 60 * 1000)
    if (!rate.success) {
      const minutes = Math.ceil(rate.resetIn / 60000)
      return NextResponse.json(
        { error: `Prea multe încercări. Așteaptă ${minutes} minute.` },
        { status: 429 }
      )
    }

    const { currentPassword, newPassword } = await request.json()
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Completează parola curentă și parola nouă' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Cont inexistent sau inactiv' }, { status: 404 })
    }
    if (!user.password) {
      return NextResponse.json({ error: 'Contul nu are parolă setată' }, { status: 400 })
    }

    const currentOk = await verifyPassword(user.password, currentPassword)
    if (!currentOk) {
      await createAuditLog({
        action: 'change_password_failed',
        actorId: user.id,
        targetId: user.id,
        targetType: 'user',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        severity: SEVERITY.WARNING,
        success: false,
      })
      return NextResponse.json({ error: 'Parola curentă este greșită' }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Parola nouă trebuie să fie diferită de cea curentă' }, { status: 400 })
    }

    const problem = validateNewPassword(newPassword, user.role)
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    await createAuditLog({
      action: 'change_password',
      actorId: user.id,
      targetId: user.id,
      targetType: 'user',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
      details: { email: user.email },
      severity: SEVERITY.INFO,
      success: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Eroare de server' }, { status: 500 })
  }
}
