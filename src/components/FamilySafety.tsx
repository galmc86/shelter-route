import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';
import {
  getGroup,
  createGroup,
  joinGroup,
  setImSafe,
  leaveGroup,
  getShareLink,
  subscribeToFamilyGroupChanges,
  type FamilyGroup,
} from '../services/familySafetyService';

interface FamilySafetyProps {
  initialGroupCode?: string | null;
  presentation?: 'accordion' | 'section';
}

export function FamilySafety({
  initialGroupCode,
  presentation = 'accordion',
}: FamilySafetyProps) {
  const { t } = useLanguage();
  const [group, setGroup] = useState<FamilyGroup | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [setupMode, setSetupMode] = useState<'create' | 'join'>(initialGroupCode ? 'join' : 'create');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(presentation === 'section');

  // Load existing group on mount
  useEffect(() => {
    const existing = getGroup();
    if (existing) {
      queueMicrotask(() => setGroup(existing));
    } else if (initialGroupCode) {
      queueMicrotask(() => {
        setSetupMode('join');
        setCodeInput(initialGroupCode);
        setIsExpanded(true);
      });
    }
  }, [initialGroupCode]);

  useEffect(() => {
    return subscribeToFamilyGroupChanges(() => {
      setGroup(getGroup());
    });
  }, []);

  useEffect(() => {
    if (presentation === 'section') {
      setIsExpanded(true);
    }
  }, [presentation]);

  const handleCreate = useCallback(() => {
    if (!nameInput.trim()) return;
    const g = createGroup(nameInput.trim());
    setGroup(g);
    setNameInput('');
  }, [nameInput]);

  const handleJoin = useCallback(() => {
    if (!nameInput.trim() || !codeInput.trim()) return;
    const g = joinGroup(codeInput.trim(), nameInput.trim());
    setGroup(g);
    setNameInput('');
    setCodeInput('');
    setSetupMode('create');
  }, [nameInput, codeInput]);

  const handleImSafe = useCallback(() => {
    const updated = setImSafe();
    if (updated) setGroup({ ...updated });
  }, []);

  const handleLeave = useCallback(() => {
    leaveGroup();
    setGroup(null);
  }, []);

  const handleShare = useCallback(async () => {
    const link = getShareLink();
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
  }, [t]);

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

  const currentMember = group?.members.find((m) => m.name === group.memberName);
  const isSafe = currentMember?.isSafe ?? false;
  const safeMembersCount = group?.members.filter((member) => member.isSafe).length ?? 0;
  const waitingMembersCount = group ? Math.max(0, group.members.length - safeMembersCount) : 0;

  const content = (
    <div className="family-safety-content">
          {!group ? (
            <div className="family-safety-setup">
              <p className="family-safety-desc">{t('family.description')}</p>
              <p className="family-safety-local-note">{t('family.localNote')}</p>

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
