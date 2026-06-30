/**
 * auth.spec.ts — Google-only auth flow and unauthenticated redirect guards.
 *
 * 로그인/회원가입은 Google OAuth 전용이다. 이메일/비밀번호 경로는 제거되었고,
 * /signup 은 /login 으로 통합(리다이렉트)된다.
 *
 * These tests run without a pre-existing session (no storageState).
 * Server-side middleware redirect tests rely on no valid session cookie being
 * present, which is guaranteed because no storageState is set for this project.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Login (Google only)
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test('renders the Google sign-in button', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  })

  test('no longer renders email / password fields', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('#email')).toHaveCount(0)
    await expect(page.locator('#password')).toHaveCount(0)
  })

  test('Google button starts the OAuth flow with the callback redirect', async ({ page }) => {
    // signInWithOAuth navigates to Supabase's authorize endpoint. Intercept it so
    // the browser doesn't leave for Google, and assert the OAuth params.
    let authorizeUrl: string | null = null
    await page.route('**/auth/v1/authorize*', async (route) => {
      authorizeUrl = route.request().url()
      await route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' })
    })

    await page.goto('/login')
    await page.getByRole('button', { name: /Google/ }).click()

    await expect.poll(() => authorizeUrl).toContain('provider=google')
    expect(decodeURIComponent(authorizeUrl!)).toContain('/api/auth/callback')
  })
})

// ---------------------------------------------------------------------------
// Signup is consolidated into login
// ---------------------------------------------------------------------------

test.describe('Signup page', () => {
  test('/signup redirects to /login', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Redirect guards (no session present)
// ---------------------------------------------------------------------------

test.describe('Unauthenticated redirect', () => {
  test('/learn redirects to /login', async ({ page }) => {
    await page.goto('/learn')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('/learn redirect includes the original path', async ({ page }) => {
    await page.goto('/learn')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('redirect')
  })

  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('/errors redirects to /login', async ({ page }) => {
    await page.goto('/errors')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
