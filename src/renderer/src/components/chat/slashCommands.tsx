import {
  Activity,
  Server,
  ClipboardCheck,
  GitBranch,
  Target,
  ListChecks,
  FolderOpen,
  Trash2,
  Eraser,
  FileSearch,
  Wand2,
  Diff,
  SearchCode,
  ShieldAlert,
  MessageCircle,
  Play,
  BadgeCheck,
  FileCog,
  Brain,
  Archive,
  type LucideIcon
} from 'lucide-react'
import type { TKey } from '../../i18n/translations'

export interface SlashCommand {
  name: string
  titleKey: TKey
  descKey: TKey
  icon: LucideIcon
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'diff', titleKey: 'slash.diff.title', descKey: 'slash.diff.desc', icon: Diff },
  { name: 'code-review', titleKey: 'slash.codeReview.title', descKey: 'slash.codeReview.desc', icon: SearchCode },
  { name: 'security-review', titleKey: 'slash.securityReview.title', descKey: 'slash.securityReview.desc', icon: ShieldAlert },
  { name: 'review', titleKey: 'slash.review.title', descKey: 'slash.review.desc', icon: ClipboardCheck },
  { name: 'run', titleKey: 'slash.run.title', descKey: 'slash.run.desc', icon: Play },
  { name: 'verify', titleKey: 'slash.verify.title', descKey: 'slash.verify.desc', icon: BadgeCheck },
  { name: 'init', titleKey: 'slash.init.title', descKey: 'slash.init.desc', icon: FileCog },
  { name: 'memory', titleKey: 'slash.memory.title', descKey: 'slash.memory.desc', icon: Brain },
  { name: 'context', titleKey: 'slash.context.title', descKey: 'slash.context.desc', icon: FileSearch },
  { name: 'compact', titleKey: 'slash.compact.title', descKey: 'slash.compact.desc', icon: Archive },
  { name: 'btw', titleKey: 'slash.btw.title', descKey: 'slash.btw.desc', icon: MessageCircle },
  { name: 'skill-creator', titleKey: 'slash.skillCreator.title', descKey: 'slash.skillCreator.desc', icon: Wand2 },
  { name: 'plan', titleKey: 'slash.plan.title', descKey: 'slash.plan.desc', icon: ListChecks },
  { name: 'goal', titleKey: 'slash.goal.title', descKey: 'slash.goal.desc', icon: Target },
  { name: 'worktree', titleKey: 'slash.worktree.title', descKey: 'slash.worktree.desc', icon: GitBranch },
  { name: 'mcp', titleKey: 'slash.mcp.title', descKey: 'slash.mcp.desc', icon: Server },
  { name: 'status', titleKey: 'slash.status.title', descKey: 'slash.status.desc', icon: Activity },
  { name: 'project', titleKey: 'slash.project.title', descKey: 'slash.project.desc', icon: FolderOpen },
  { name: 'clear', titleKey: 'slash.clear.title', descKey: 'slash.clear.desc', icon: Eraser },
  { name: 'delete', titleKey: 'slash.delete.title', descKey: 'slash.delete.desc', icon: Trash2 }
]
