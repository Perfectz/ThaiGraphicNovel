/**
 * Barrel export for the modern design system primitives.
 *
 * Usage:
 *   import { Button, Modal, Chip, StatBar, MicButton, VerdictBadge } from '../ui';
 *
 * Anything imported from this barrel is part of the unified design system
 * documented at C:\Users\pzgam\.claude\plans\analysis-the-title-screen-keen-clarke.md.
 * Components inside `src/components/ui/` should not import legacy CSS classes
 * (.vn-*, .stage-one-*, .adventure-3d-*, .jrpg-intro-*).
 */

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export { Chip, type ChipProps, type ChipTone } from './Chip';
export { DialoguePanel, type DialoguePanelProps } from './DialoguePanel';
export { IconButton, type IconButtonProps } from './IconButton';
export { MicButton, type MicButtonProps } from './MicButton';
export { Modal, type ModalProps } from './Modal';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { StatBar, type StatBarProps, type StatBarTone, type StatBarFormat } from './StatBar';
export { VerdictBadge, type VerdictBadgeProps, type VerdictTone } from './VerdictBadge';
