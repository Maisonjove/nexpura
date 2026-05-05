/**
 * Tests for the C-06 RSC-skew deploy-version detection mechanism.
 *
 * Coverage:
 *  - Unit: `installDeployMismatchInterceptor` triggers `onMismatch`
 *    exactly when `x-deployment-id` differs from the client build ID.
 *  - Unit: empty client build ID is a no-op (preview-without-SHA case).
 *  - Unit: latch fires onMismatch only once per session.
 *  - Integration: simulating a build-ID change between two consecutive
 *    fetches surfaces the banner + schedules a reload via
 *    `window.location.reload`.
 *  - Dev-mode no-op: when `NODE_ENV !== 'production'`, the banner
 *    renders nothing and never installs an interceptor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  installDeployMismatchInterceptor,
  __resetSkewLatchForTests,
} from '../DeployVersionBanner';

// We intentionally do NOT mock @sentry/nextjs — the production-only
// gating in DeployVersionBanner means the dev-mode tests never reach
// Sentry calls. The two production-mode integration tests below mock
// Sentry inline before importing the component.

function makeResponseWithHeader(value: string | null): Response {
  const headers = new Headers();
  if (value !== null) headers.set('x-deployment-id', value);
  return new Response(null, { status: 200, headers });
}

describe('installDeployMismatchInterceptor', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    __resetSkewLatchForTests();
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    __resetSkewLatchForTests();
  });

  it('triggers onMismatch when x-deployment-id differs from clientBuildId', async () => {
    window.fetch = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-newdeploy12'));
    const onMismatch = vi.fn();

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: 'build-olddeploy12',
      onMismatch,
    });

    await window.fetch('/anything');

    expect(onMismatch).toHaveBeenCalledOnce();
    expect(onMismatch).toHaveBeenCalledWith('build-newdeploy12');
    teardown();
  });

  it('does NOT trigger onMismatch when x-deployment-id matches', async () => {
    window.fetch = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-same12345678'));
    const onMismatch = vi.fn();

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: 'build-same12345678',
      onMismatch,
    });

    await window.fetch('/anything');

    expect(onMismatch).not.toHaveBeenCalled();
    teardown();
  });

  it('does NOT trigger onMismatch when x-deployment-id is absent', async () => {
    window.fetch = vi.fn().mockResolvedValue(makeResponseWithHeader(null));
    const onMismatch = vi.fn();

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: 'build-anyclientid12',
      onMismatch,
    });

    await window.fetch('/anything');

    expect(onMismatch).not.toHaveBeenCalled();
    teardown();
  });

  it('is a no-op when clientBuildId is empty (preview-without-SHA case)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-newdeploy12'));
    window.fetch = fetchSpy;
    const onMismatch = vi.fn();

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: '',
      onMismatch,
    });

    // The interceptor should not have wrapped fetch; same fn reference.
    expect(window.fetch).toBe(fetchSpy);
    await window.fetch('/anything');
    expect(onMismatch).not.toHaveBeenCalled();
    teardown();
  });

  it('fires onMismatch exactly once even on repeated mismatched fetches (session latch)', async () => {
    window.fetch = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-newdeploy12'));
    const onMismatch = vi.fn();

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: 'build-olddeploy12',
      onMismatch,
    });

    await window.fetch('/a');
    await window.fetch('/b');
    await window.fetch('/c');

    expect(onMismatch).toHaveBeenCalledOnce();
    teardown();
  });

  it('teardown restores the original fetch', async () => {
    const originalSpy = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-newdeploy12'));
    window.fetch = originalSpy;

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: 'build-olddeploy12',
      onMismatch: vi.fn(),
    });

    expect(window.fetch).not.toBe(originalSpy);
    teardown();
    expect(window.fetch).toBe(originalSpy);
  });
});

describe('DeployVersionBanner — dev-mode no-op', () => {
  it('renders nothing in development (no banner, no badge)', async () => {
    // The component reads NODE_ENV at module load. In test runs jsdom
    // sets NODE_ENV to 'test', which the IS_PROD check treats as
    // not-production → dormant.
    const { DeployVersionBanner } = await import('../DeployVersionBanner');
    const { container } = render(<DeployVersionBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DeployVersionBanner — integration (production mode)', () => {
  let originalFetch: typeof window.fetch;
  let originalNodeEnv: string | undefined;
  let originalBuildId: string | undefined;
  let originalReload: () => void;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetSkewLatchForTests();
    originalFetch = window.fetch;
    originalNodeEnv = process.env.NODE_ENV;
    originalBuildId = process.env.NEXT_PUBLIC_BUILD_ID;

    // Force production gating + a known client build ID. Direct
    // assignment works on Node 20+ where process.env entries are
    // writable string properties; defineProperty fails because the
    // backing handler in Node refuses non-data descriptors here.
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_BUILD_ID = 'build-clientold12';

    // jsdom's window.location is sealed — defineProperty on `reload`
    // throws "Cannot redefine property". The reliable cross-version
    // workaround is to swap the entire `location` object for a stub
    // (delete first, then assign).
    originalReload = window.location.reload;
    reloadSpy = vi.fn();
    const stubLocation = {
      ...window.location,
      reload: reloadSpy,
      pathname: '/test/route',
    };
    // @ts-expect-error -- intentional override for test seam
    delete window.location;
    // @ts-expect-error -- restoring with a stub
    window.location = stubLocation;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.fetch = originalFetch;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalBuildId === undefined) {
      delete process.env.NEXT_PUBLIC_BUILD_ID;
    } else {
      process.env.NEXT_PUBLIC_BUILD_ID = originalBuildId;
    }
    // Restore reload on whatever location object is currently in
    // place. Test cleanup; not strictly needed since each test
    // re-stubs, but keeps subsequent files seeing a real reload.
    try {
      // @ts-expect-error -- best-effort restore
      window.location.reload = originalReload;
    } catch {
      // ignore — sealed location, nothing else relies on this.
    }
    __resetSkewLatchForTests();
    vi.resetModules();
  });

  it('shows the banner on mismatched x-deployment-id and schedules a reload', async () => {
    // Mock Sentry to swallow telemetry calls in the integration path.
    vi.doMock('@sentry/nextjs', () => ({
      addBreadcrumb: vi.fn(),
      captureMessage: vi.fn(),
    }));
    // Re-import the module so it picks up production NODE_ENV +
    // the fresh BUILD_ID env at evaluation time.
    vi.resetModules();
    const mod = await import('../DeployVersionBanner');

    window.fetch = vi
      .fn()
      .mockResolvedValue(makeResponseWithHeader('build-servernew12'));

    render(<mod.DeployVersionBanner />);

    // The badge always renders in prod mode.
    expect(screen.getByTestId('deploy-version-badge')).toBeInTheDocument();
    // The banner is hidden until a mismatch is detected.
    expect(screen.queryByTestId('deploy-version-banner')).toBeNull();

    // Trigger a fetch that exposes a different deploy ID.
    await act(async () => {
      await window.fetch('/_next/some-rsc-payload');
    });

    expect(screen.getByTestId('deploy-version-banner')).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();

    // After 2s, reload fires.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
