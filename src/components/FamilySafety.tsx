import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { useFamilyGroupState } from '../hooks/useFamilyGroupState';
import { useFamilyPushStatus } from '../hooks/useFamilyPushStatus';
import { useFamilySyncStatus } from '../hooks/useFamilySyncStatus';
import { syncFamilyPushSubscription } from '../services/familyPushNotificationService';
import { requestNotificationPermission } from '../services/pushNotificationService';

type FamilySyncTone = 'local' | 'active' | 'pending' | 'error';
type FamilyPushTone = 'active' | 'pending' | 'error' | 'neutral';

function getLocale(language: 'he' | 'en' | 'ar' | 'ru'): string {
  switch (language) {
    case 'he':
      return 'he-IL';
    case 'ar':
      return 'ar';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

function formatSyncTime(timestamp: string | null, language: 'he' | 'en' | 'ar' | 'ru'): string | null {
  if (!timestamp) {
    return null;
  }

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
}

interface FamilySafetyProps {
  initialGroupCode?: string | null;
  presentation?: 'accordion' | 'section';
}

export function FamilySafety({
  initialGroupCode,
  presentation = 'accordion',
}: FamilySafetyProps) {
  const { language, t } = useLanguage();
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [setupMode, setSetupMode] = useState<'create' | 'join'>(initialGroupCode ? 'join' : 'create');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(presentation === 'section');
  const { mode: syncMode, status: syncStatus } = useFamilySyncStatus();
  const pushStatus = useFamilyPushStatus();
  const {
    group,
    isCurrentMemberSafe,
    safeMembersCount,
    waitingMembersCount,
    shareLink,
    createFamilyGroup,
    joinFamilyGroup,
    markFamilySafe,
    retryFamilySync,
    leaveFamilyGroup,
  } = useFamilyGroupState();

  // Prefill the join state when the app was opened from a family invite link.
  useEffect(() => {
    if (!group && initialGroupCode) {
      queueMicrotask(() => {
        setSetupMode('join');
        setCodeInput(initialGroupCode);
        setIsExpanded(true);
      });
    }
  }, [group, initialGroupCode]);

  useEffect(() => {
    if (presentation === 'section') {
      setIsExpanded(true);
    }
  }, [presentation]);

  const handleCreate = useCallback(() => {
    if (!nameInput.trim()) return;
    const nextGroup = createFamilyGroup(nameInput.trim());
    if (nextGroup) {
      setNameInput('');
      void requestNotificationPermission().then((granted) => {
        if (granted) {
          void syncFamilyPushSubscription(nextGroup.groupCode);
        }
      });
    }
  }, [createFamilyGroup, nameInput]);

  const handleJoin = useCallback(() => {
    if (!nameInput.trim() || !codeInput.trim()) return;
    const nextGroup = joinFamilyGroup(codeInput.trim(), nameInput.trim());
    if (nextGroup) {
      setNameInput('');
      setCodeInput('');
      setSetupMode('create');
      void requestNotificationPermission().then((granted) => {
        if (granted) {
          void syncFamilyPushSubscription(nextGroup.groupCode);
        }
      });
    }
  }, [codeInput, joinFamilyGroup, nameInput]);

  const handleImSafe = useCallback(() => {
    markFamilySafe();
  }, [markFamilySafe]);

  const handleLeave = useCallback(() => {
    leaveFamilyGroup();
  }, [leaveFamilyGroup]);

  const handleRetrySync = useCallback(() => {
    retryFamilySync();
  }, [retryFamilySync]);

  const handleEnableNotifications = useCallback(() => {
    if (!group) {
      return;
    }

    void requestNotificationPermission().then((granted) => {
      if (granted) {
        void syncFamilyPushSubscription(group.groupCode);
      }
    });
  }, [group]);

  const handleRetryNotifications = useCallback(() => {
    if (!group) {
      return;
    }

    void syncFamilyPushSubscription(group.groupCode);
  }, [group]);

  const handleShare = useCallback(async () => {
    const link = shareLink ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('family.shareTitle'),
          text: t('family.shareText'),
          url: link,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [shareLink, t]);

  const handleCopyCode = useCallback(async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.groupCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [group]);

  const isSafe = isCurrentMemberSafe;
  const syncTimeLabel = formatSyncTime(syncStatus.lastSuccessAt, language);
  const syncState = (() => {
    if (syncMode === 'local') {
      return {
        tone: 'local' as FamilySyncTone,
        title: t('family.sync.localTitle'),
        body: t('family.sync.localBody'),
      };
    }

    if (syncStatus.pendingCount > 0 && syncStatus.lastError) {
      return {
        tone: 'error' as FamilySyncTone,
        title: t('family.sync.pausedTitle'),
        body: t('family.sync.pausedBody').replace('{{count}}', String(syncStatus.pendingCount)),
      };
    }

    if (syncStatus.pendingCount > 0) {
      return {
        tone: 'pending' as FamilySyncTone,
        title: t('family.sync.pendingTitle'),
        body: t('family.sync.pendingBody').replace('{{count}}', String(syncStatus.pendingCount)),
      };
    }

    if (syncTimeLabel) {
      return {
        tone: 'active' as FamilySyncTone,
        title: t('family.sync.activeTitle'),
        body: t('family.sync.activeBody').replace('{{time}}', syncTimeLabel),
      };
    }

    return {
      tone: 'active' as FamilySyncTone,
      title: t('family.sync.preparingTitle'),
      body: t('family.sync.preparingBody'),
    };
  })();
  const setupNoteKey = syncMode === 'hybrid' ? 'family.hybridNote' : 'family.localNote';
  const pushState = group && syncMode === 'hybrid'
    ? (() => {
        if (
          pushStatus.state === 'active'
          && pushStatus.registeredGroupCode === group.groupCode
        ) {
          return {
            tone: 'active' as FamilyPushTone,
            title: t('family.push.activeTitle'),
            body: t('family.push.activeBody'),
            actionLabel: null,
            onAction: null,
          };
        }

        if (pushStatus.environmentHint === 'ios_home_screen_required') {
          return {
            tone: 'neutral' as FamilyPushTone,
            title: t('family.push.homeScreenTitle'),
            body: t('family.push.homeScreenBody'),
            actionLabel: null,
            onAction: null,
          };
        }

        if (pushStatus.permission === 'denied') {
          return {
            tone: 'error' as FamilyPushTone,
            title: t('family.push.blockedTitle'),
            body: t('family.push.blockedBody'),
            actionLabel: null,
            onAction: null,
          };
        }

        if (pushStatus.permission === 'default' || pushStatus.state === 'needs_user_action') {
          return {
            tone: 'pending' as FamilyPushTone,
            title: t('family.push.enableTitle'),
            body: t('family.push.enableBody'),
            actionLabel: t('family.push.enable'),
            onAction: handleEnableNotifications,
          };
        }

        if (pushStatus.state === 'unsupported') {
          return {
            tone: 'neutral' as FamilyPushTone,
            title: t('family.push.unsupportedTitle'),
            body: t('family.push.unsupportedBody'),
            actionLabel: null,
            onAction: null,
          };
        }

        if (pushStatus.state === 'error') {
          return {
            tone: 'error' as FamilyPushTone,
            title: t('family.push.errorTitle'),
            body: t('family.push.errorBody'),
            actionLabel: t('family.push.retry'),
            onAction: handleRetryNotifications,
          };
        }

        return {
          tone: 'pending' as FamilyPushTone,
          title: t('family.push.preparingTitle'),
          body: t('family.push.preparingBody'),
          actionLabel: t('family.push.retry'),
          onAction: handleRetryNotifications,
        };
      })()
    : null;

  const content = (
    <div className="family-safety-content">
          {!group ? (
            <div className="family-safety-setup">
              <p className="family-safety-desc">{t('family.description')}</p>
              <p className="family-safety-local-note">{t(setupNoteKey)}</p>

              <div className="family-safety-setup-modes" role="tablist" aria-label={t('family.title')}>
                <button
                  type="button"
                  role="tab"
                  className={`family-safety-setup-tab ${setupMode === 'create' ? 'active' : ''}`}
                  aria-selected={setupMode === 'create'}
                  onClick={() => setSetupMode('create')}
                >
                  {t('family.mode.create')}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`family-safety-setup-tab ${setupMode === 'join' ? 'active' : ''}`}
                  aria-selected={setupMode === 'join'}
                  onClick={() => setSetupMode('join')}
                >
                  {t('family.mode.join')}
                </button>
              </div>

              {setupMode === 'join' && initialGroupCode && (
                <div className="family-safety-prefill-note">
                  {t('family.prefilledCodeHint')}
                </div>
              )}

              <input
                className="family-safety-input"
                type="text"
                placeholder={t('family.namePlaceholder')}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={30}
              />

              {setupMode === 'create' ? (
                <div className="family-safety-actions">
                  <button
                    className="family-safety-btn family-safety-btn-create"
                    onClick={handleCreate}
                    disabled={!nameInput.trim()}
                  >
                    {t('family.createGroup')}
                  </button>
                </div>
              ) : (
                <div className="family-safety-join">
                  <input
                    className="family-safety-input"
                    type="text"
                    placeholder={t('family.codePlaceholder')}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <div className="family-safety-actions">
                    <button
                      className="family-safety-btn family-safety-btn-create"
                      onClick={handleJoin}
                      disabled={!nameInput.trim() || codeInput.trim().length < 6}
                    >
                      {t('family.join')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="family-safety-group">
              <div className="family-safety-invite-card">
                <div className="family-safety-invite-copy">
                  <span className="family-safety-code-label">{t('family.inviteTitle')}</span>
                  <span className="family-safety-code-value">{group.groupCode}</span>
                  <span className="family-safety-invite-subtitle">{t('family.inviteSubtitle')}</span>
                </div>
                <div className="family-safety-invite-actions">
                  <button
                    className="family-safety-btn family-safety-btn-share"
                    onClick={handleShare}
                  >
                    {copied ? t('family.linkCopied') : t('family.shareWithFamily')}
                  </button>
                  <button
                    className="family-safety-btn family-safety-btn-copy"
                    onClick={handleCopyCode}
                  >
                    {codeCopied ? t('family.codeCopied') : t('family.copyCode')}
                  </button>
                </div>
              </div>

              <div
                className={`family-safety-sync family-safety-sync--${syncState.tone}`}
                role="status"
                aria-live="polite"
              >
                <span className={`family-safety-sync-indicator family-safety-sync-indicator--${syncState.tone}`} />
                <div className="family-safety-sync-copy">
                  <span className="family-safety-sync-title">{syncState.title}</span>
                  <span className="family-safety-sync-body">{syncState.body}</span>
                </div>
                {syncMode === 'hybrid' && (syncStatus.pendingCount > 0 || Boolean(syncStatus.lastError)) && (
                  <button
                    type="button"
                    className="family-safety-sync-action"
                    onClick={handleRetrySync}
                  >
                    {t('family.sync.retry')}
                  </button>
                )}
              </div>

              {pushState && (
                <div
                  className={`family-safety-push family-safety-push--${pushState.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className={`family-safety-push-indicator family-safety-push-indicator--${pushState.tone}`} />
                  <div className="family-safety-push-copy">
                    <span className="family-safety-push-title">{pushState.title}</span>
                    <span className="family-safety-push-body">{pushState.body}</span>
                  </div>
                  {pushState.actionLabel && pushState.onAction && (
                    <button
                      type="button"
                      className="family-safety-push-action"
                      onClick={pushState.onAction}
                    >
                      {pushState.actionLabel}
                    </button>
                  )}
                </div>
              )}

              <div className="family-safety-summary">
                <span className="family-safety-summary-chip family-safety-summary-chip-safe">
                  {t('family.safeCount').replace('{{count}}', String(safeMembersCount))}
                </span>
                <span className="family-safety-summary-chip family-safety-summary-chip-waiting">
                  {t('family.awaitingCount').replace('{{count}}', String(waitingMembersCount))}
                </span>
              </div>

              <div className="family-safety-members">
                <span className="family-safety-members-label">
                  {t('family.members')} ({group.members.length})
                </span>
                {group.members.map((m) => (
                  <div key={m.id} className="family-safety-member">
                    <span
                      className={`family-safety-status-dot ${m.isSafe ? 'safe' : 'unknown'}`}
                      title={m.isSafe ? t('family.statusSafe') : t('family.statusUnknown')}
                    />
                    <span className="family-safety-member-name">
                      {m.name}
                      {m.name === group.memberName ? ` (${t('family.you')})` : ''}
                    </span>
                    <span className={`family-safety-member-status ${m.isSafe ? 'safe' : 'unknown'}`}>
                      {m.isSafe ? t('family.statusSafe') : t('family.statusUnknown')}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className={`family-safety-btn-imsafe ${isSafe ? 'is-safe' : ''}`}
                onClick={handleImSafe}
              >
                {isSafe ? t('family.markedSafe') : t('family.imSafe')}
              </button>

              <div className="family-safety-group-actions">
                <button
                  className="family-safety-btn family-safety-btn-leave"
                  onClick={handleLeave}
                >
                  {t('family.leaveGroup')}
                </button>
              </div>
            </div>
          )}
    </div>
  );

  return (
    <div className={`family-safety${presentation === 'section' ? ' family-safety--section' : ''}`}>
      {presentation === 'accordion' && (
        <button
          className="family-safety-header"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className="family-safety-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </span>
          <span className="family-safety-header-title">{t('family.title')}</span>
          <span className={`family-safety-chevron ${isExpanded ? 'expanded' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </span>
        </button>
      )}

      {isExpanded && content}
    </div>
  );
}
